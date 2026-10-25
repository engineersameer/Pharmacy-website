from pathlib import Path

from django.conf import settings
from django.conf import settings as django_settings

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.throttling import SimpleRateThrottle

from apps.orders.models import Order, Prescription

from .helpers import BaseTest, pdf_file, png_file

BASE = {"name": "Sameer Ahmed", "phone": "0300 1234567", "method": "pickup"}


class RefillOrders(BaseTest):
    def setUp(self):
        super().setUp()
        self.prescription = Prescription.objects.create(file="prescriptions/x.png")

    def post(self, **data):
        return self.client.post("/api/refills", {**BASE, **data}, format="json")

    def test_refill_with_number_links_the_prescription(self):
        r = self.post(prescriptionNumber=str(self.prescription.id))
        self.assertEqual(r.status_code, 201, r.content)
        body = r.json()
        self.assertGreaterEqual(body["id"], 1001)
        order = Order.objects.get(pk=body["id"])
        self.assertEqual(order.order_type, "refill")
        self.assertEqual(order.customer_phone, "+923001234567")
        self.assertEqual(list(order.prescriptions.all()), [self.prescription])
        self.assertEqual(order.notes, "")

    def test_reply_contains_only_order_number_status_and_numbers(self):
        r = self.post(prescriptionNumber=str(self.prescription.id))
        self.assertEqual(set(r.json()), {"id", "status", "prescriptionNumbers"})

    def test_unknown_number_is_accepted_silently(self):
        unknown = str(self.prescription.id + 1000)
        r = self.post(prescriptionNumber=unknown)
        self.assertEqual(r.status_code, 201)
        order = Order.objects.get(pk=r.json()["id"])
        self.assertEqual(order.prescriptions.count(), 0)
        self.assertIn(unknown, order.notes)  # staff can see what the customer typed

    def test_reply_never_reveals_whether_a_number_exists(self):
        known = self.post(prescriptionNumber=str(self.prescription.id)).json()
        unknown = self.post(prescriptionNumber=str(self.prescription.id + 1000)).json()
        for body in (known, unknown):
            body.pop("id")
        self.assertEqual(known, unknown)

    def test_without_number_is_accepted(self):
        r = self.post()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["prescriptionNumbers"], [])

    def test_phone_formats_are_cleaned(self):
        for phone in ["03001234567", "+92 300 1234567", "923001234567", "0092-300-1234567", "300 1234567"]:
            with self.subTest(phone=phone):
                r = self.post(phone=phone)
                self.assertEqual(r.status_code, 201, r.content)
                self.assertEqual(Order.objects.get(pk=r.json()["id"]).customer_phone, "+923001234567")

    def test_bad_phone_is_refused(self):
        for phone in ["", "12345", "0421234567", "04235710000", "abc"]:
            with self.subTest(phone=phone):
                self.assertEqual(self.post(phone=phone).status_code, 400)

    def test_delivery_needs_an_address(self):
        r = self.post(method="delivery")
        self.assertEqual(r.status_code, 400)
        self.assertIn("deliveryAddress", r.json())

    def test_delivery_saves_address_as_typed(self):
        r = self.post(method="delivery", deliveryAddress="House 477F Eden Valley, Faisalabad.")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Order.objects.get().delivery_address, "House 477F Eden Valley, Faisalabad.")

    def test_pickup_never_keeps_an_address(self):
        r = self.post(method="pickup", deliveryAddress="Somewhere 123456")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Order.objects.get().delivery_address, "")

    def test_customer_cannot_choose_status_or_id(self):
        r = self.post(status="completed", id=5)
        order = Order.objects.get(pk=r.json()["id"])
        self.assertEqual(order.status, "received")
        self.assertNotEqual(order.id, 5)


class UploadOrders(BaseTest):
    def post(self, files, **data):
        return self.client.post("/api/prescriptions", {**BASE, **data, "files": files}, format="multipart")

    def test_each_file_becomes_a_prescription_with_its_own_number(self):
        r = self.post([png_file(), pdf_file()], notes="Only the first two medicines")
        self.assertEqual(r.status_code, 201, r.content)
        numbers = r.json()["prescriptionNumbers"]
        self.assertEqual(len(numbers), 2)
        self.assertEqual(numbers[1], numbers[0] + 1)  # counting up
        order = Order.objects.get(pk=r.json()["id"])
        self.assertEqual(order.order_type, "new_prescription")
        self.assertEqual(order.notes, "Only the first two medicines")
        self.assertEqual(order.prescriptions.count(), 2)

    def test_files_get_random_names(self):
        self.post([png_file("my private name.png")])
        name = Prescription.objects.get().file.name
        self.assertNotIn("private", name)
        self.assertRegex(name, r"^prescriptions/\d{4}/\d{2}/[0-9a-f]{32}\.png$")

    def test_fake_image_is_refused(self):
        fake = SimpleUploadedFile("rx.jpg", b"<script>alert(1)</script>", content_type="image/jpeg")
        r = self.post([fake])
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Order.objects.count(), 0)

    def test_renamed_html_is_refused(self):
        fake = SimpleUploadedFile("rx.pdf", b"<html><body>hi</body></html>", content_type="application/pdf")
        self.assertEqual(self.post([fake]).status_code, 400)

    def test_heic_photo_is_accepted(self):
        heic = SimpleUploadedFile("IMG_0001.HEIC", b"\x00\x00\x00\x18ftypheic\x00\x00\x00\x00mif1heic", content_type="image/heic")
        r = self.post([heic])
        self.assertEqual(r.status_code, 201, r.content)
        self.assertTrue(Prescription.objects.get().file.name.endswith(".heic"))

    def test_more_than_three_files_is_refused(self):
        r = self.post([png_file(f"{i}.png") for i in range(4)])
        self.assertEqual(r.status_code, 400)

    def test_no_files_is_refused(self):
        r = self.client.post("/api/prescriptions", BASE, format="multipart")
        self.assertEqual(r.status_code, 400)

    @override_settings(MAX_UPLOAD_MB=0)
    def test_too_big_file_is_refused(self):
        self.assertEqual(self.post([png_file()]).status_code, 400)

    def test_nothing_is_saved_if_one_file_is_bad(self):
        bad = SimpleUploadedFile("b.png", b"nope", content_type="image/png")
        self.post([png_file(), bad])
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(Prescription.objects.count(), 0)


class OrderRateLimit(BaseTest):
    def test_too_many_orders_from_one_connection_are_refused(self):
        SimpleRateThrottle.THROTTLE_RATES = {**SimpleRateThrottle.THROTTLE_RATES, "orders": "3/hour"}
        codes = [self.client.post("/api/refills", BASE, format="json").status_code for _ in range(4)]
        self.assertEqual(codes, [201, 201, 201, 429])


class RateLimitBehindNginx(BaseTest):
    """On the server, Nginx sits in front of Django. With NUM_PROXIES=1 each visitor must
    get their own limit, based on the address Nginx passes on."""

    def test_each_visitor_has_their_own_limit(self):
        SimpleRateThrottle.THROTTLE_RATES = {**SimpleRateThrottle.THROTTLE_RATES, "orders": "1/hour"}
        with override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, "NUM_PROXIES": 1}):
            send = lambda ip: self.client.post("/api/refills", BASE, format="json", HTTP_X_FORWARDED_FOR=ip).status_code
            self.assertEqual(send("39.1.1.1"), 201)
            self.assertEqual(send("39.2.2.2"), 201)  # different visitor, own limit
            self.assertEqual(send("39.1.1.1"), 429)  # same visitor, limit reached


class FailedUploadCleanup(BaseTest):
    def test_files_are_deleted_if_the_order_fails(self):
        from unittest import mock

        from apps.orders import serializers as order_serializers

        real_create = order_serializers.OrderPrescription.objects.create
        calls = {"n": 0}

        def fail_second(*a, **kw):
            calls["n"] += 1
            if calls["n"] == 2:
                raise RuntimeError("disk full")
            return real_create(*a, **kw)

        with mock.patch.object(order_serializers.OrderPrescription.objects, "create", side_effect=fail_second):
            with self.assertRaises(RuntimeError):
                self.client.post(
                    "/api/prescriptions", {**BASE, "files": [png_file("a.png"), png_file("b.png")]}, format="multipart"
                )
        self.assertEqual(Prescription.objects.count(), 0)
        stored = [p for p in Path(django_settings.MEDIA_ROOT).rglob("*") if p.is_file()]
        self.assertEqual(stored, [])


class OrderNumbers(BaseTest):
    def test_order_numbers_count_up_from_1001(self):
        a = self.client.post("/api/refills", BASE, format="json").json()["id"]
        b = self.client.post("/api/refills", BASE, format="json").json()["id"]
        self.assertGreaterEqual(a, 1001)
        self.assertEqual(b, a + 1)

    def test_prescription_numbers_count_up(self):
        a = Prescription.objects.create(file="a.png")
        b = Prescription.objects.create(file="b.png")
        self.assertGreaterEqual(a.id, 1)
        self.assertEqual(b.id, a.id + 1)

    def test_number_typed_with_spaces_or_leading_zeros_still_matches(self):
        p = Prescription.objects.create(file="a.png")
        r = self.client.post("/api/refills", {**BASE, "prescriptionNumber": f" 00{p.id} "}, format="json")
        self.assertEqual(Order.objects.get(pk=r.json()["id"]).prescriptions.get(), p)

    def test_huge_number_is_handled(self):
        r = self.client.post("/api/refills", {**BASE, "prescriptionNumber": "9" * 15}, format="json")
        self.assertEqual(r.status_code, 201)
