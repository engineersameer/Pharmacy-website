from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.base import File
from django.db import transaction
from rest_framework import serializers

from .files import detect_extension
from .models import Order, OrderPrescription, Prescription
from .phone import normalize_pk_mobile

# ---------------------------------------------------------------------------
# Customer side (public)
# ---------------------------------------------------------------------------


class _CustomerFields(serializers.Serializer):
    """Fields every order has. Field names match the website's JSON (camelCase)."""

    name = serializers.CharField(max_length=120, trim_whitespace=True)
    phone = serializers.CharField(max_length=30)
    method = serializers.ChoiceField(choices=Order.Method.choices)
    deliveryAddress = serializers.CharField(max_length=500, required=False, allow_blank=True, trim_whitespace=True)

    def validate_name(self, value):
        if len(value) < 2:
            raise serializers.ValidationError("Please enter your name.")
        return value

    def validate_phone(self, value):
        try:
            return normalize_pk_mobile(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.messages[0])

    def validate(self, data):
        address = data.get("deliveryAddress", "")
        if data["method"] == Order.Method.DELIVERY:
            if len(address) < 10:
                raise serializers.ValidationError({"deliveryAddress": "Please enter your full delivery address."})
        else:
            data["deliveryAddress"] = ""  # pickup orders never keep an address
        return data

    def _order_fields(self, data, order_type, notes=""):
        return {
            "customer_name": data["name"],
            "customer_phone": data["phone"],
            "method": data["method"],
            "delivery_address": data["deliveryAddress"],
            "order_type": order_type,
            "notes": notes,
        }


class RefillCreateSerializer(_CustomerFields):
    """Returning customer. A known prescription number links the order to it.

    An unknown number is accepted silently: the customer gets the same reply either way,
    so nobody can use the form to find out which numbers exist. Staff see the number
    in the notes and a warning on the order."""

    prescriptionNumber = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate_prescriptionNumber(self, value):
        return "".join(ch for ch in value if ch.isdigit()) or None

    @transaction.atomic
    def create(self, data):
        number = data.get("prescriptionNumber")
        prescription = Prescription.objects.filter(prescription_number=number).first() if number else None
        notes = f"Customer entered prescription number {number}, not found." if number and not prescription else ""
        order = Order.objects.create(**self._order_fields(data, Order.Type.REFILL, notes))
        if prescription:
            OrderPrescription.objects.create(order=order, prescription=prescription)
        return order


class PrescriptionUploadSerializer(_CustomerFields):
    """New customer. Each uploaded file becomes one prescription with its own number."""

    files = serializers.ListField(child=serializers.FileField(allow_empty_file=False), allow_empty=False)
    notes = serializers.CharField(max_length=1000, required=False, allow_blank=True, trim_whitespace=True)

    def validate_files(self, files):
        if len(files) > settings.MAX_UPLOAD_FILES:
            raise serializers.ValidationError(f"You can upload up to {settings.MAX_UPLOAD_FILES} files.")
        checked = []
        for upload in files:
            ext = detect_extension(upload)  # raises if the file isn't a real image or PDF
            checked.append((upload, ext))
        return checked

    def create(self, data):
        saved = []  # files written so far, deleted again if anything fails
        try:
            with transaction.atomic():
                order = Order.objects.create(
                    **self._order_fields(data, Order.Type.NEW_PRESCRIPTION, data.get("notes", ""))
                )
                for upload, ext in data["files"]:
                    prescription = Prescription()
                    prescription.file.save(f"upload.{ext}", File(upload), save=False)
                    saved.append(prescription.file)
                    prescription.save()
                    OrderPrescription.objects.create(order=order, prescription=prescription)
            return order
        except Exception:
            for f in saved:
                f.storage.delete(f.name)
            raise


class OrderCreatedSerializer(serializers.ModelSerializer):
    """What the customer gets back: only their own order number, status and prescription numbers."""

    prescriptionNumbers = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ["id", "status", "prescriptionNumbers"]

    def get_prescriptionNumbers(self, order):
        # Only new uploads get numbers back. For refills we never echo a number, so the
        # reply can't reveal whether the number the customer typed exists.
        if order.order_type != Order.Type.NEW_PRESCRIPTION:
            return []
        return [p.prescription_number for p in order.prescriptions.order_by("created_at")]
