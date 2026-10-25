"""Create, send and check admin login codes."""

import hashlib
import hmac
import logging
import secrets
import threading
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import connections
from django.db.models import F, Sum
from django.utils import timezone

from .models import AdminLoginCode, User

CFG = settings.LOGIN_CODE
log = logging.getLogger(__name__)


def _hash(admin_id: int, code: str) -> str:
    # Keyed hash: a copy of the database alone is not enough to check guesses
    msg = f"{admin_id}:{code}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()


def find_admin(email: str) -> User | None:
    return User.objects.filter(email__iexact=email.strip(), is_active=True, is_staff=True).first()


def _send_code_email(email: str, code: str) -> None:
    send_mail(
        subject=f"Your CarePoint login code: {code}",
        message=(
            f"Your CarePoint admin login code is {code}\n\n"
            f"It works once and expires in {CFG['ttl_minutes']} minutes.\n"
            "If you didn't ask for this, you can ignore this email."
        ),
        from_email=None,
        recipient_list=[email],
    )


def _send_in_background(email: str, code: str) -> None:
    """Send without making the request wait, so admin and non-admin emails take the same
    time to answer (otherwise the delay would reveal which emails belong to admins)."""
    if not settings.EMAIL_ASYNC:
        _send_code_email(email, code)
        return

    def run():
        try:
            _send_code_email(email, code)
        except Exception:
            log.exception("Could not send login code email to %s", email)
        finally:
            connections.close_all()

    threading.Thread(target=run, daemon=True).start()


def issue_code(admin: User) -> bool:
    """Send a new code, unless this admin asked too often or already has a working code.

    A code that still works is never cancelled by a new request, so nobody can lock an
    admin out just by asking for codes in their name."""
    now = timezone.now()
    codes = AdminLoginCode.objects.filter(admin=admin)
    if codes.filter(created_at__gte=now - timedelta(hours=1)).count() >= CFG["max_per_hour"]:
        return False
    if codes.filter(created_at__gte=now - timedelta(seconds=CFG["resend_seconds"])).exists():
        return False
    if codes.filter(used_at__isnull=True, expires_at__gt=now, attempts__lt=CFG["max_attempts"]).exists():
        return False  # the code already in their inbox still works

    code = f"{secrets.randbelow(10 ** CFG['digits']):0{CFG['digits']}d}"
    AdminLoginCode.objects.create(
        admin=admin, code_hash=_hash(admin.id, code), expires_at=now + timedelta(minutes=CFG["ttl_minutes"])
    )
    _send_in_background(admin.email, code)
    return True


def check_code(admin: User, code: str) -> bool:
    """True if the code is right. Every try counts, a right code works only once, and
    an admin gets a limited number of wrong tries per day across all codes."""
    now = timezone.now()
    codes = AdminLoginCode.objects.filter(admin=admin)

    tries_today = codes.filter(created_at__gte=now - timedelta(days=1)).aggregate(n=Sum("attempts"))["n"] or 0
    if tries_today >= CFG["max_failed_per_day"]:
        log.warning("Login code guesses blocked for %s: too many tries today", admin.email)
        return False

    entry = codes.order_by("-created_at").first()
    if entry is None:
        return False

    # Claim this try in one database step BEFORE comparing, so many guesses sent at the
    # same moment can't all slip past the attempt limit
    claimed = AdminLoginCode.objects.filter(
        pk=entry.pk, used_at__isnull=True, expires_at__gt=now, attempts__lt=CFG["max_attempts"]
    ).update(attempts=F("attempts") + 1)
    if not claimed:
        return False

    if not hmac.compare_digest(entry.code_hash, _hash(admin.id, code.strip())):
        return False

    # Mark used only if nobody used it a split second earlier
    used = AdminLoginCode.objects.filter(pk=entry.pk, used_at__isnull=True).update(used_at=timezone.now())
    return used == 1
