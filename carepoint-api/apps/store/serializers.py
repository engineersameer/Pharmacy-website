from rest_framework import serializers

from apps.orders.models import Order

from .models import OpeningHours, StoreSettings


class HoursSerializer(serializers.ModelSerializer):
    day = serializers.IntegerField(source="day_of_week", min_value=0, max_value=6)
    opensAt = serializers.TimeField(source="opens_at", format="%H:%M", allow_null=True, required=False)
    closesAt = serializers.TimeField(source="closes_at", format="%H:%M", allow_null=True, required=False)
    isClosed = serializers.BooleanField(source="is_closed")

    class Meta:
        model = OpeningHours
        fields = ["day", "opensAt", "closesAt", "isClosed"]

    def validate(self, data):
        if not data["is_closed"] and (data.get("opens_at") is None or data.get("closes_at") is None):
            raise serializers.ValidationError("Opening and closing times are required unless the day is closed.")
        if data["is_closed"]:
            data["opens_at"] = data["closes_at"] = None
        return data


class PublicStoreSerializer(serializers.ModelSerializer):
    """Everything the public website shows about the pharmacy."""

    phoneHref = serializers.SerializerMethodField()
    hours = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()

    class Meta:
        model = StoreSettings
        fields = ["name", "phone", "phoneHref", "address", "hours", "stats"]

    def get_phoneHref(self, obj):
        digits = "".join(ch for ch in obj.phone if ch.isdigit())
        if digits.startswith("0"):
            digits = "92" + digits[1:]
        return f"tel:+{digits}"

    def get_hours(self, obj):
        return HoursSerializer(OpeningHours.objects.all(), many=True).data

    def get_stats(self, obj):
        return {
            "avgRefillMinutes": obj.avg_refill_minutes,
            "yearsServing": obj.years_serving,
            # Counted from real data, never typed in by hand
            "ordersCompleted": Order.objects.filter(status=Order.Status.COMPLETED).count(),
        }


class AdminStoreSerializer(serializers.ModelSerializer):
    yearsServing = serializers.IntegerField(source="years_serving", min_value=0, max_value=200)
    avgRefillMinutes = serializers.IntegerField(source="avg_refill_minutes", min_value=1, max_value=600)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    updatedBy = serializers.EmailField(source="updated_by.email", read_only=True, default=None)

    class Meta:
        model = StoreSettings
        fields = ["name", "phone", "address", "yearsServing", "avgRefillMinutes", "updatedAt", "updatedBy"]
