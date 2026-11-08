from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """A pharmacy admin. Customers never have accounts.

    Admins log in with email + one-time code, so the password field is never used
    (it is set to "unusable" when an admin is created).
    """

    email = models.EmailField(unique=True)

    REQUIRED_FIELDS = ["email"]

    class Meta:
        db_table = "admin_users"

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        super().save(*args, **kwargs)


class AdminLoginCode(models.Model):
    """One row per login code sent to an admin. Codes are stored hashed, work once,
    expire after a few minutes, and are cancelled after too many wrong tries."""

    admin = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="login_codes")
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "admin_login_codes"
        indexes = [models.Index(fields=["admin", "-created_at"])]

    def is_usable(self) -> bool:
        return (
            self.used_at is None
            and self.expires_at > timezone.now()
            and self.attempts < settings.LOGIN_CODE["max_attempts"]
        )


class PushSubscription(models.Model):
    """One staff device (phone or computer browser) that turned on phone alerts.

    The browser gives us an address at its push service (Google, Apple, Mozilla) plus two
    keys. We send new-order alerts to that address, locked with the keys, so only that
    device can read them. It works even when the browser is closed."""

    admin = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subscriptions")
    endpoint = models.URLField(max_length=1000, unique=True)  # the device's address at its push service
    p256dh = models.CharField(max_length=200)  # the device's public key, to lock each message
    auth = models.CharField(max_length=100)  # a shared secret for the same
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "admin_push_subscriptions"

    def as_webpush(self) -> dict:
        return {"endpoint": self.endpoint, "keys": {"p256dh": self.p256dh, "auth": self.auth}}
