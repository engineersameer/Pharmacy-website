from django.core.management.base import BaseCommand

from apps.accounts.models import User


class Command(BaseCommand):
    help = "List pharmacy admins."

    def handle(self, **options):
        for u in User.objects.filter(is_staff=True).order_by("email"):
            state = "active" if u.is_active else "removed"
            last = u.last_login.strftime("%Y-%m-%d %H:%M") if u.last_login else "never"
            self.stdout.write(f"{u.email:40} {state:8} last login: {last}")
