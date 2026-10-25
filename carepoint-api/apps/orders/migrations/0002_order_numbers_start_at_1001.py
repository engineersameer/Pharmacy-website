from django.db import migrations


def start_at_1001(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        # The next order gets id 1001, so the first customer sees "Order #1001", not "#1"
        cursor.execute("SELECT setval(pg_get_serial_sequence('orders', 'id'), 1000, true)")


class Migration(migrations.Migration):
    dependencies = [("orders", "0001_initial")]

    operations = [migrations.RunPython(start_at_1001, migrations.RunPython.noop)]
