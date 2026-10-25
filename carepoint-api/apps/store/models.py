from django.conf import settings
from django.db import models
from django.db.models import Q


class StoreSettings(models.Model):
    """The pharmacy's own details, shown on the website. Exactly one row (id = 1):
    admins only ever edit it, never add or delete."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20)
    address = models.TextField()
    years_serving = models.PositiveSmallIntegerField(default=0)
    avg_refill_minutes = models.PositiveSmallIntegerField(default=15)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "store_settings"
        constraints = [models.CheckConstraint(condition=Q(id=1), name="store_settings_single_row")]

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError("Store settings can't be deleted, only edited.")

    @classmethod
    def load(cls) -> "StoreSettings":
        return cls.objects.get(pk=1)


class OpeningHours(models.Model):
    """Seven rows, one per day. A closing time earlier than the opening time means
    "past midnight" (e.g. 09:00 to 02:00); the same time for both means open 24 hours."""

    class Day(models.IntegerChoices):
        SUNDAY = 0
        MONDAY = 1
        TUESDAY = 2
        WEDNESDAY = 3
        THURSDAY = 4
        FRIDAY = 5
        SATURDAY = 6

    day_of_week = models.PositiveSmallIntegerField(choices=Day.choices, unique=True)
    opens_at = models.TimeField(null=True, blank=True)
    closes_at = models.TimeField(null=True, blank=True)
    is_closed = models.BooleanField(default=False)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "opening_hours"
        ordering = ["day_of_week"]
        constraints = [
            models.CheckConstraint(condition=Q(day_of_week__gte=0, day_of_week__lte=6), name="opening_hours_valid_day"),
            # An open day needs both times
            models.CheckConstraint(
                condition=Q(is_closed=True) | (Q(opens_at__isnull=False) & Q(closes_at__isnull=False)),
                name="opening_hours_times_when_open",
            ),
        ]
