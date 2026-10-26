from datetime import timedelta

from django.utils import timezone

from apps.orders.models import Order, OrderPrescription, Prescription

from .helpers import BaseTest, auth_client, make_admin, pdf_file, png_file


def make_order(**kw):
    data = {
        "customer_name": "Sameer Ahmed",
        "customer_phone": "+923001234567",
        "order_type": "refill",
        "method": "pickup",
    }
    data.update(kw)
    return Order.objects.create(**data)


class AdminOrders(BaseTest):
    def setUp(self):
        super().setUp()
        self.ayesha = auth_client(make_admin("ayesha@carepoint.pk"))
        self.bilal = auth_client(make_admin("bilal@carepoint.pk"))

    def test_list_filter_by_status(self):
        make_order()
        make_order(status="completed")
        r = self.ayesha.get("/api/admin/orders?status=received")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([o["status"] for o in r.json()["results"]], ["received"])

    def test_list_rejects_unknown_status(self):
        self.assertEqual(self.ayesha.get("/api/admin/orders?status=deleted").status_code, 400)

    def test_search_by_phone_in_any_format(self):
        make_order()
        make_order(customer_phone="+923331112222")
        r = self.ayesha.get("/api/admin/orders?q=0300 1234567")
        self.assertEqual(len(r.json()["results"]), 1)

    def test_search_by_order_number(self):
        o = make_order()
        r = self.ayesha.get(f"/api/admin/orders?q={o.id}")
        self.assertEqual([x["id"] for x in r.json()["results"]], [o.id])

    def test_detail_shows_customer_details_and_next_steps(self):
        o = make_order(method="delivery", delivery_address="House 477F Eden Valley, Faisalabad.")
        r = self.ayesha.get(f"/api/admin/orders/{o.id}").json()
        self.assertEqual(r["customerPhone"], "+923001234567")
        self.assertEqual(r["deliveryAddress"], "House 477F Eden Valley, Faisalabad.")
        self.assertEqual(r["nextStatuses"], ["cancelled", "confirmed"])

    def test_status_flow_for_delivery(self):
        o = make_order(method="delivery", delivery_address="House 477F Eden Valley, Faisalabad.")
        for expected, new in [("received", "confirmed"), ("confirmed", "out_for_delivery"), ("out_for_delivery", "completed")]:
            r = self.ayesha.post(f"/api/admin/orders/{o.id}/status", {"status": new, "expectedStatus": expected}, format="json")
            self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(Order.objects.get(pk=o.id).status, "completed")

    def test_pickup_order_cannot_go_out_for_delivery(self):
        o = make_order(status="confirmed")
        r = self.ayesha.post(f"/api/admin/orders/{o.id}/status", {"status": "out_for_delivery", "expectedStatus": "confirmed"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_cannot_skip_steps(self):
        o = make_order()
        r = self.ayesha.post(f"/api/admin/orders/{o.id}/status", {"status": "completed", "expectedStatus": "received"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_finished_orders_cannot_change(self):
        o = make_order(status="cancelled")
        r = self.ayesha.post(f"/api/admin/orders/{o.id}/status", {"status": "confirmed", "expectedStatus": "cancelled"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_first_click_wins(self):
        o = make_order()
        body = {"status": "confirmed", "expectedStatus": "received"}
        first = self.bilal.post(f"/api/admin/orders/{o.id}/status", body, format="json")
        second = self.ayesha.post(f"/api/admin/orders/{o.id}/status", body, format="json")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.json()["order"]["status"], "confirmed")

    def test_changes_returns_new_and_changed_orders(self):
        start = (timezone.now() - timedelta(seconds=1)).isoformat()
        old = make_order()
        Order.objects.filter(pk=old.pk).update(updated_at=timezone.now() - timedelta(hours=1))
        new = make_order()
        r = self.ayesha.get("/api/admin/orders/changes", {"since": start})
        self.assertEqual(r.status_code, 200)
        self.assertEqual([o["id"] for o in r.json()["orders"]], [new.id])
        self.assertIn("serverTime", r.json())

    def test_changes_sees_another_admins_status_change(self):
        o = make_order()
        since = self.ayesha.get("/api/admin/orders/changes", {"since": timezone.now().isoformat()}).json()["serverTime"]
        Order.objects.filter(pk=o.pk).update(updated_at=timezone.now() - timedelta(hours=1))
        self.bilal.post(f"/api/admin/orders/{o.id}/status", {"status": "confirmed", "expectedStatus": "received"}, format="json")
        changed = self.ayesha.get("/api/admin/orders/changes", {"since": since}).json()["orders"]
        self.assertEqual([(x["id"], x["status"]) for x in changed], [(o.id, "confirmed")])

    def test_server_time_works_unencoded_in_a_url(self):
        server_time = self.ayesha.get("/api/admin/orders/changes", {"since": "2026-01-01T00:00:00Z"}).json()["serverTime"]
        self.assertTrue(server_time.endswith("Z"))
        self.assertEqual(self.ayesha.get(f"/api/admin/orders/changes?since={server_time}").status_code, 200)

    def test_changes_needs_since(self):
        self.assertEqual(self.ayesha.get("/api/admin/orders/changes").status_code, 400)

    def test_attach_prescription_by_number(self):
        o = make_order()
        p = Prescription.objects.create(file="prescriptions/x.png")
        r = self.ayesha.post(f"/api/admin/orders/{o.id}/prescriptions", {"prescriptionNumber": p.id}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([x["number"] for x in r.json()["prescriptions"]], [p.id])

    def test_warning_when_refill_has_no_prescription(self):
        o = make_order()
        codes = [w["code"] for w in self.ayesha.get(f"/api/admin/orders/{o.id}").json()["warnings"]]
        self.assertEqual(codes, ["no_prescription"])

    def test_warning_when_phone_differs_from_earlier_orders(self):
        p = Prescription.objects.create(file="prescriptions/x.png")
        first = make_order(order_type="new_prescription")
        OrderPrescription.objects.create(order=first, prescription=p)
        other = make_order(customer_phone="+923339998888")
        OrderPrescription.objects.create(order=other, prescription=p)
        warnings = self.ayesha.get(f"/api/admin/orders/{other.id}").json()["warnings"]
        self.assertEqual([w["code"] for w in warnings], ["phone_mismatch"])
        self.assertIn("+923001234567", warnings[0]["message"])

    def test_no_warning_when_same_phone(self):
        p = Prescription.objects.create(file="prescriptions/x.png")
        for kind in ("new_prescription", "refill"):
            OrderPrescription.objects.create(order=make_order(order_type=kind), prescription=p)
        latest = Order.objects.order_by("-id").first()
        self.assertEqual(self.ayesha.get(f"/api/admin/orders/{latest.id}").json()["warnings"], [])

    def test_order_list_queries_do_not_grow_with_orders(self):
        p = Prescription.objects.create(file="prescriptions/x.png")
        for _ in range(5):
            OrderPrescription.objects.create(order=make_order(), prescription=p)
        with self.assertNumQueries(5):  # login user, count, orders, prescriptions, their orders
            self.ayesha.get("/api/admin/orders")

    def attach(self, order, p):
        return self.ayesha.post(f"/api/admin/orders/{order.id}/prescriptions", {"prescriptionNumber": p.id}, format="json")

    def remove(self, order, p):
        return self.ayesha.delete(f"/api/admin/orders/{order.id}/prescriptions/{p.id}")

    def test_remove_wrong_prescription_keeps_the_prescription(self):
        o = make_order()
        wrong = Prescription.objects.create(file="prescriptions/x.png")
        right = Prescription.objects.create(file="prescriptions/y.png")
        self.attach(o, wrong)
        self.attach(o, right)
        r = self.remove(o, wrong)
        self.assertEqual(r.status_code, 200)
        self.assertEqual([x["number"] for x in r.json()["prescriptions"]], [right.id])
        self.assertTrue(Prescription.objects.filter(pk=wrong.pk).exists())  # only the link is gone

    def test_remove_shows_up_on_other_screens(self):
        o = make_order()
        p = Prescription.objects.create(file="prescriptions/x.png")
        self.attach(o, p)
        since = (timezone.now() - timedelta(seconds=1)).isoformat()
        Order.objects.filter(pk=o.pk).update(updated_at=timezone.now() - timedelta(hours=1))
        self.remove(o, p)
        changed = self.bilal.get("/api/admin/orders/changes", {"since": since}).json()["orders"]
        self.assertEqual([(x["id"], x["prescriptions"]) for x in changed], [(o.id, [])])

    def test_remove_missing_link_is_404(self):
        o = make_order()
        p = Prescription.objects.create(file="prescriptions/x.png")
        self.assertEqual(self.remove(o, p).status_code, 404)

    def test_cannot_change_prescriptions_on_finished_orders(self):
        p = Prescription.objects.create(file="prescriptions/x.png")
        for status in ("completed", "cancelled"):
            o = make_order(status=status)
            OrderPrescription.objects.create(order=o, prescription=p)
            with self.subTest(status=status):
                self.assertEqual(self.remove(o, p).status_code, 400)
                other = Prescription.objects.create(file="prescriptions/z.png")
                self.assertEqual(self.attach(o, other).status_code, 400)

    def test_cannot_remove_customer_uploads(self):
        o = make_order(order_type="new_prescription")
        p = Prescription.objects.create(file="prescriptions/x.png")
        OrderPrescription.objects.create(order=o, prescription=p)
        self.assertEqual(self.remove(o, p).status_code, 400)

    def test_search_by_number_shows_where_it_was_used(self):
        first = make_order(order_type="new_prescription")
        p = Prescription.objects.create(file="prescriptions/x.png")
        OrderPrescription.objects.create(order=first, prescription=p)
        r = self.ayesha.get("/api/admin/prescriptions", {"number": p.id}).json()
        self.assertEqual(len(r), 1)
        self.assertEqual(r[0]["usedIn"][0]["orderId"], first.id)
        self.assertEqual(r[0]["usedIn"][0]["customerPhone"], "+923001234567")

    def test_search_by_unknown_number_finds_nothing(self):
        self.assertEqual(self.ayesha.get("/api/admin/prescriptions", {"number": 999999}).json(), [])

    def test_find_prescriptions_by_phone(self):
        o = make_order()
        p = Prescription.objects.create(file="prescriptions/x.png")
        OrderPrescription.objects.create(order=o, prescription=p)
        r = self.ayesha.get("/api/admin/prescriptions", {"phone": "03001234567"})
        self.assertEqual([x["number"] for x in r.json()], [p.id])

    def test_search_finds_orders_by_prescription_number(self):
        o = make_order()
        p = Prescription.objects.create(file="prescriptions/x.png")
        OrderPrescription.objects.create(order=o, prescription=p)
        r = self.ayesha.get(f"/api/admin/orders?q={p.id}")
        self.assertIn(o.id, [x["id"] for x in r.json()["results"]])


class PrescriptionFiles(BaseTest):
    def test_admin_can_open_file_and_customer_cannot(self):
        r = self.client.post(
            "/api/prescriptions",
            {"name": "Sameer", "phone": "03001234567", "method": "pickup", "files": [png_file()]},
            format="multipart",
        )
        self.assertEqual(r.status_code, 201, r.content)
        p = Prescription.objects.get()
        url = f"/api/admin/prescriptions/{p.id}/file"

        self.assertEqual(self.client.get(url).status_code, 401)

        res = auth_client(make_admin()).get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "image/png")
        self.assertEqual(res["Cache-Control"], "private, no-store")
        self.assertTrue(b"".join(res.streaming_content).startswith(b"\x89PNG"))
        self.assertIn("sandbox", res["Content-Security-Policy"])
        self.assertTrue(res["Content-Disposition"].startswith("inline"))

    def test_pdf_downloads_instead_of_opening(self):
        self.client.post(
            "/api/prescriptions",
            {"name": "Sameer", "phone": "03001234567", "method": "pickup", "files": [pdf_file()]},
            format="multipart",
        )
        p = Prescription.objects.get()
        res = auth_client(make_admin()).get(f"/api/admin/prescriptions/{p.id}/file")
        self.assertEqual(res["Content-Type"], "application/pdf")
        self.assertTrue(res["Content-Disposition"].startswith("attachment"))
