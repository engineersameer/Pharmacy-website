import io
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User

TEMP_MEDIA = tempfile.mkdtemp(prefix="carepoint-test-media-")


def png_file(name="rx.png"):
    buf = io.BytesIO()
    Image.new("RGB", (40, 60), "white").save(buf, "PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


def pdf_file(name="rx.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF", content_type="application/pdf")


def make_admin(email="ayesha@carepoint.pk", **kw):
    user = User(username=email, email=email, is_staff=True, **kw)
    user.set_unusable_password()
    user.save()
    return user


def auth_client(user):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return client


# Throttles off by default in tests; the throttle tests turn them back on.
NO_THROTTLE = {
    "orders": "10000/minute",
    "login_request": "10000/minute",
    "login_verify": "10000/minute",
}


@override_settings(MEDIA_ROOT=TEMP_MEDIA, EMAIL_ASYNC=False)
class BaseTest(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA, ignore_errors=True)

    def setUp(self):
        from django.core.cache import cache
        from rest_framework.settings import api_settings
        from rest_framework.throttling import SimpleRateThrottle

        cache.clear()
        self._rates = SimpleRateThrottle.THROTTLE_RATES
        SimpleRateThrottle.THROTTLE_RATES = {**api_settings.DEFAULT_THROTTLE_RATES, **NO_THROTTLE}
        self.client = APIClient()

    def tearDown(self):
        from rest_framework.throttling import SimpleRateThrottle

        SimpleRateThrottle.THROTTLE_RATES = self._rates
