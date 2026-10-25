from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email

from apps.accounts.models import User


class Command(BaseCommand):
    help = "Add a pharmacy admin (there is no sign-up page). They log in with an emailed code."

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("--first-name", default="")
        parser.add_argument("--last-name", default="")

    def handle(self, email, first_name, last_name, **options):
        email = email.strip().lower()
        try:
            validate_email(email)
        except ValidationError:
            raise CommandError(f"Not a valid email: {email}")

        user = User.objects.filter(email=email).first()
        if user:
            user.is_active = user.is_staff = True
            user.save(update_fields=["is_active", "is_staff"])
            self.stdout.write(self.style.SUCCESS(f"{email} was already there; it is now an active admin."))
            return

        user = User(username=email, email=email, first_name=first_name, last_name=last_name, is_staff=True)
        user.set_unusable_password()  # login is by emailed code only
        user.save()
        self.stdout.write(self.style.SUCCESS(f"Added admin {email}"))
