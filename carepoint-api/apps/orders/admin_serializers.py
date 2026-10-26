from django.urls import reverse
from rest_framework import serializers

from .models import Order, Prescription
from .statuses import allowed_next


class AdminPrescriptionSerializer(serializers.ModelSerializer):
    number = serializers.IntegerField(source="id")
    fileUrl = serializers.SerializerMethodField()
    fileType = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at")

    class Meta:
        model = Prescription
        fields = ["id", "number", "fileUrl", "fileType", "createdAt"]

    def get_fileUrl(self, obj):
        # Admin-only download link. There is no public URL for prescription files.
        return reverse("admin-prescription-file", args=[obj.id])

    def get_fileType(self, obj):
        return "pdf" if obj.file.name.endswith(".pdf") else "image"


class PrescriptionSearchResultSerializer(AdminPrescriptionSerializer):
    """A search result, with the orders it was used in, so the pharmacist can judge
    whether it is the right one before attaching it."""

    usedIn = serializers.SerializerMethodField()

    class Meta(AdminPrescriptionSerializer.Meta):
        fields = AdminPrescriptionSerializer.Meta.fields + ["usedIn"]

    def get_usedIn(self, obj):
        return [
            {"orderId": o.id, "customerName": o.customer_name, "customerPhone": o.customer_phone, "createdAt": o.created_at}
            for o in sorted(obj.orders.all(), key=lambda o: o.created_at)
        ]


class AdminOrderSerializer(serializers.ModelSerializer):
    customerName = serializers.CharField(source="customer_name")
    customerPhone = serializers.CharField(source="customer_phone")
    orderType = serializers.CharField(source="order_type")
    deliveryAddress = serializers.CharField(source="delivery_address")
    createdAt = serializers.DateTimeField(source="created_at")
    updatedAt = serializers.DateTimeField(source="updated_at")
    prescriptions = AdminPrescriptionSerializer(many=True)
    nextStatuses = serializers.SerializerMethodField()
    warnings = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "customerName",
            "customerPhone",
            "orderType",
            "method",
            "deliveryAddress",
            "notes",
            "status",
            "nextStatuses",
            "warnings",
            "prescriptions",
            "createdAt",
            "updatedAt",
        ]
        read_only_fields = fields

    def get_nextStatuses(self, obj):
        return sorted(allowed_next(obj))

    def get_warnings(self, obj):
        """Things staff should check before preparing the order."""
        warnings = []
        prescriptions = list(obj.prescriptions.all())
        if obj.order_type == Order.Type.REFILL and not prescriptions:
            warnings.append(
                {
                    "code": "no_prescription",
                    "message": "No prescription attached. Find it by the customer's phone number, then attach it.",
                }
            )
        for p in prescriptions:
            # Uses the prefetched orders: no extra database query per prescription
            other_phones = sorted({o.customer_phone for o in p.orders.all() if o.customer_phone != obj.customer_phone})
            if other_phones:
                warnings.append(
                    {
                        "code": "phone_mismatch",
                        "message": f"Prescription {p.id} was ordered before from a different phone: "
                        + ", ".join(other_phones)
                        + ". Check with the customer before preparing it.",
                    }
                )
        return warnings


class StatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.Status.choices)
    # The status the admin's screen showed. If someone else changed it meanwhile, we refuse.
    expectedStatus = serializers.ChoiceField(choices=Order.Status.choices)


class LinkPrescriptionSerializer(serializers.Serializer):
    prescriptionNumber = serializers.IntegerField(min_value=1, error_messages={"invalid": "Enter the prescription number."})
