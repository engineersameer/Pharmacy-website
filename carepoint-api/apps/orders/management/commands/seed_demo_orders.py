"""Create realistic dummy orders for trying out the staff dashboard (laptop only).

    manage.py seed_demo_orders

Each run adds a new set; it never deletes anything. Order numbers are the orders' own ids.
"""

import io
from datetime import timedelta

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from PIL import Image, ImageDraw

from apps.orders.models import Order, OrderPrescription, Prescription

# (name, phone, method, address, status, kind, extra, age in minutes, notes)
#   kind: "upload" (customer sends photos), "refill" (uses a prescription), "refill-none" (no number),
#         "refill-unknown" (number that doesn't exist)
DEMO = [
    ("Ayesha Khan", "+923214567890", "delivery", "House 12, Street 5, Model Town, Lahore. Near the park gate.", "received", "upload", 2, 4, "Please send the cough syrup too."),
    ("Bilal Hussain", "+923331112233", "pickup", "", "received", "upload-pdf", 1, 9, ""),
    ("Usman Ali", "+923007654321", "delivery", "Flat 3B, Gulshan-e-Iqbal Block 7, Karachi. Near Bahadurabad chowrangi.", "received", "refill-none", 0, 15, ""),
    ("Hina Javed", "+923122223344", "pickup", "", "received", "refill-unknown", 0, 22, ""),
    ("Kamran Sheikh", "+923459990011", "pickup", "", "received", "refill-of:Ayesha Khan", 0, 31, ""),
    ("Zain Malik", "+923015556677", "delivery", "House 477F Eden Valley, Faisalabad.", "confirmed", "upload", 1, 55, ""),
    ("Fatima Noor", "+923459876543", "pickup", "", "ready", "upload", 1, 95, ""),
    ("Omar Farooq", "+923218889900", "delivery", "Street 9, G-11/2, Islamabad. Blue gate, second floor.", "out_for_delivery", "upload", 1, 140, ""),
    ("Sana Riaz", "+923336667788", "pickup", "", "completed", "refill-of:Fatima Noor", 0, 60 * 26, ""),
    ("Nadia Aslam", "+923004443322", "delivery", "House 8, Satellite Town, Rawalpindi.", "cancelled", "upload", 1, 60 * 30, "Customer asked to cancel."),
]

MEDICINES = [
    ["Amoxicillin 500mg - 1 cap 3x daily - 5 days", "Paracetamol 500mg - 1 tab when needed"],
    ["Amlodipine 5mg - 1 tab daily", "Atorvastatin 10mg - 1 tab at night"],
    ["Metformin 500mg - 1 tab twice daily", "Vitamin D3 - 1 cap weekly"],
    ["Omeprazole 20mg - 1 cap before breakfast", "Domperidone 10mg - 1 tab 3x daily"],
    ["Cetirizine 10mg - 1 tab at night", "Salbutamol inhaler - 2 puffs when needed"],
]


def prescription_image(patient: str, n: int) -> bytes:
    """A simple fake prescription slip: clinic header, patient, medicines, signature."""
    img = Image.new("RGB", (600, 800), "white")
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 600, 90], fill=(15, 118, 110))
    d.text((30, 25), "City Health Clinic", fill="white", font_size=30)
    d.text((30, 62), "Dr. A. Rehman  MBBS, FCPS", fill="white", font_size=16)
    d.text((30, 120), f"Patient: {patient}", fill="black", font_size=20)
    d.text((30, 150), "Date: " + timezone.localdate().strftime("%d %b %Y"), fill="black", font_size=18)
    d.text((30, 200), "Rx", fill=(15, 118, 110), font_size=44)
    for i, line in enumerate(MEDICINES[n % len(MEDICINES)]):
        d.text((40, 270 + i * 45), f"{i + 1}. {line}", fill="black", font_size=18)
    d.line([360, 700, 560, 700], fill="black", width=2)
    d.text((400, 710), "Signature", fill="gray", font_size=16)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


class Command(BaseCommand):
    help = "Create realistic dummy orders for testing (only works with DEBUG on)."

    @transaction.atomic
    def handle(self, **options):
        if not settings.DEBUG:
            raise CommandError("Refusing to run: this command only works on a development laptop (DEBUG=true).")

        now = timezone.now()
        first_prescription_of: dict[str, Prescription] = {}
        created = []

        for i, (name, phone, method, address, status, kind, files, age, notes) in enumerate(DEMO):
            order_type = Order.Type.NEW_PRESCRIPTION if kind.startswith("upload") else Order.Type.REFILL
            if kind == "refill-unknown":
                notes = "Customer entered prescription number 99999, not found."
            order = Order.objects.create(
                customer_name=name,
                customer_phone=phone,
                method=method,
                delivery_address=address,
                order_type=order_type,
                status=status,
                notes=notes,
            )

            if kind.startswith("upload"):
                for f in range(files):
                    p = Prescription()
                    if kind == "upload-pdf":
                        buf = io.BytesIO()
                        Image.open(io.BytesIO(prescription_image(name, i + f))).save(buf, "PDF")
                        p.file.save("demo.pdf", ContentFile(buf.getvalue()), save=False)
                    else:
                        p.file.save("demo.png", ContentFile(prescription_image(name, i + f)), save=False)
                    p.save()
                    OrderPrescription.objects.create(order=order, prescription=p)
                    first_prescription_of.setdefault(name, p)
            elif kind.startswith("refill-of:"):
                OrderPrescription.objects.create(order=order, prescription=first_prescription_of[kind.split(":", 1)[1]])

            # Spread the orders out in time, like a real morning
            when = now - timedelta(minutes=age)
            Order.objects.filter(pk=order.pk).update(created_at=when, updated_at=when)
            created.append(order)

        for o in created:
            o.refresh_from_db()
            numbers = [p.id for p in o.prescriptions.order_by("id")]
            self.stdout.write(
                f"Order #{o.id}  {o.customer_name:15} {o.order_type:16} {o.method:8} {o.status:16} "
                f"prescriptions {numbers or '-'}"
            )
        self.stdout.write(self.style.SUCCESS(f"Created {len(created)} demo orders."))
