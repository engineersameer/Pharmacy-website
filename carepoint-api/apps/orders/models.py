import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Order(models.Model):
    """One customer order, saved exactly as the customer typed it. Customers have no accounts,
    so their name, phone and address live on the order itself."""

    class Type(models.TextChoices):
        NEW_PRESCRIPTION = "new_prescription", "New prescription"
        REFILL = "refill", "Refill"

    class Method(models.TextChoices):
        PICKUP = "pickup", "Pickup"
        DELIVERY = "delivery", "Delivery"

    class Status(models.TextChoices):
        RECEIVED = "received", "Received"
        CONFIRMED = "confirmed", "Confirmed"
        READY = "ready", "Ready for pickup"
        OUT_FOR_DELIVERY = "out_for_delivery", "Out for delivery"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    # Counts up from 1001 (set in the migration); shown to the customer as the order number
    id = models.BigAutoField(primary_key=True)
    customer_name = models.CharField(max_length=120)
    customer_phone = models.CharField(max_length=16, db_index=True)  # +923XXXXXXXXX
    order_type = models.CharField(max_length=20, choices=Type.choices)
    method = models.CharField(max_length=10, choices=Method.choices)
    delivery_address = models.TextField(blank=True)  # empty for pickup
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RECEIVED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)  # live dashboard asks "changed since?"
    # Staff pressed Accept on the new-order alarm. Saved here (not in one browser) so the
    # alarm stops on every staff screen, and others can see who is handling it.
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    prescriptions = models.ManyToManyField("Prescription", through="OrderPrescription", related_name="orders")

    class Meta:
        db_table = "orders"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]
        constraints = [
            # Delivery orders must have an address, pickup orders must not
            models.CheckConstraint(
                condition=(Q(method="delivery") & ~Q(delivery_address=""))
                | (Q(method="pickup") & Q(delivery_address="")),
                name="order_address_matches_method",
            ),
        ]

    def __str__(self):
        return f"Order #{self.id}"


def prescription_upload_path(instance, filename):
    # Random file name: never trust or reuse the customer's file name
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    return f"prescriptions/{timezone.now():%Y/%m}/{uuid.uuid4().hex}.{ext}"


class Prescription(models.Model):
    """One uploaded prescription photo or PDF.

    Its id is the prescription number the customer uses for refills: 1, 2, 3, …"""

    id = models.BigAutoField(primary_key=True)
    file = models.FileField(upload_to=prescription_upload_path, max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "prescriptions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Prescription {self.id}"


class OrderPrescription(models.Model):
    """Links orders and prescriptions: one order can have several prescriptions,
    and one prescription can be refilled by many orders."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="order_prescriptions")
    # PROTECT: a prescription that was used in an order can't be deleted by accident
    prescription = models.ForeignKey(Prescription, on_delete=models.PROTECT, related_name="order_prescriptions")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "order_prescriptions"
        constraints = [models.UniqueConstraint(fields=["order", "prescription"], name="unique_order_prescription")]
