"""Every admin URL must refuse anyone who isn't a logged-in, active admin."""

from apps.accounts.models import User

from .helpers import BaseTest, auth_client, make_admin

ADMIN_URLS = [
    ("get", "/api/auth/me"),
    ("get", "/api/admin/orders"),
    ("get", "/api/admin/orders/changes?since=2026-01-01T00:00:00Z"),
    ("get", "/api/admin/orders/1001"),
    ("post", "/api/admin/orders/1001/status"),
    ("post", "/api/admin/orders/1001/prescriptions"),
    ("get", "/api/admin/prescriptions?phone=03001234567"),
    ("get", "/api/admin/prescriptions/1/file"),
    ("get", "/api/admin/store"),
    ("patch", "/api/admin/store"),
    ("get", "/api/admin/hours"),
    ("put", "/api/admin/hours"),
]


class AdminUrlsAreLocked(BaseTest):
    def test_anonymous_gets_401(self):
        for method, url in ADMIN_URLS:
            with self.subTest(url=url, method=method):
                self.assertEqual(getattr(self.client, method)(url).status_code, 401)

    def test_logged_in_non_admin_gets_403(self):
        # A user account that is not staff (should never exist, but must not get in)
        user = User.objects.create(username="someone", email="someone@example.com", is_staff=False)
        client = auth_client(user)
        for method, url in ADMIN_URLS:
            with self.subTest(url=url, method=method):
                self.assertEqual(getattr(client, method)(url).status_code, 403)

    def test_removed_admin_is_locked_out_immediately(self):
        admin = make_admin()
        client = auth_client(admin)
        self.assertEqual(client.get("/api/admin/orders").status_code, 200)
        admin.is_active = False
        admin.save()
        self.assertEqual(client.get("/api/admin/orders").status_code, 401)

    def test_bad_token_gets_401(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")
        self.assertEqual(self.client.get("/api/admin/orders").status_code, 401)

    def test_no_public_url_for_uploaded_files(self):
        self.assertEqual(self.client.get("/media/prescriptions/2026/10/anything.png").status_code, 404)

    def test_django_admin_site_is_not_exposed(self):
        self.assertEqual(self.client.get("/admin/").status_code, 404)


class PublicUrlsStayPublic(BaseTest):
    def test_store_is_public(self):
        self.assertEqual(self.client.get("/api/store").status_code, 200)

    def test_public_order_urls_ignore_admin_tokens(self):
        # Sending a broken token to a public URL must not cause an error
        self.client.credentials(HTTP_AUTHORIZATION="Bearer junk")
        self.assertEqual(self.client.get("/api/store").status_code, 200)
