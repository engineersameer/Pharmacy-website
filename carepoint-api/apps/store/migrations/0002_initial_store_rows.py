from datetime import time

from django.db import migrations


def create_rows(apps, schema_editor):
    StoreSettings = apps.get_model("store", "StoreSettings")
    OpeningHours = apps.get_model("store", "OpeningHours")

    # Sample details; admins change these from the dashboard
    StoreSettings.objects.get_or_create(
        pk=1,
        defaults={
            "name": "CarePoint Pharmacy",
            "phone": "0300 0000000",
            "address": "Shop 12, Main Boulevard, Gulberg III\nLahore, Punjab",
            "years_serving": 18,
            "avg_refill_minutes": 15,
        },
    )
    hours = {
        0: (time(10), time(16)),  # Sunday
        6: (time(9), time(18)),  # Saturday
    }
    for day in range(7):
        opens, closes = hours.get(day, (time(8), time(21)))
        OpeningHours.objects.get_or_create(day_of_week=day, defaults={"opens_at": opens, "closes_at": closes})


class Migration(migrations.Migration):
    dependencies = [("store", "0001_initial")]

    operations = [migrations.RunPython(create_rows, migrations.RunPython.noop)]
