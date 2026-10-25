from django.core.management.base import BaseCommand, CommandError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from apps.accounts.models import User


class Command(BaseCommand):
    help = "Turn off an admin's access and log them out everywhere. Their history is kept."

    def add_arguments(self, parser):
        parser.add_argument("email")

    def handle(self, email, **options):
        user = User.objects.filter(email=email.strip().lower()).first()
        if user is None:
            raise CommandError(f"No admin with email {email}")
        user.is_active = False
        user.save(update_fields=["is_active"])
        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)
        self.stdout.write(self.style.SUCCESS(f"{user.email} can no longer log in."))
