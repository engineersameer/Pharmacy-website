import re
from datetime import timedelta

from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import AdminLoginCode

from .helpers import BaseTest, make_admin

GENERIC = "If this email belongs to an admin, a login code has been sent."


def code_from_last_email():
    return re.search(r"\b(\d{6})\b", mail.outbox[-1].subject).group(1)


class RequestCode(BaseTest):
    def setUp(self):
        super().setUp()
        self.admin = make_admin()

    def test_admin_email_gets_a_code(self):
        r = self.client.post("/api/auth/request-code", {"email": "Ayesha@CarePoint.pk"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["detail"], GENERIC)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["ayesha@carepoint.pk"])

    def test_unknown_email_gets_the_same_answer_and_no_email(self):
        r = self.client.post("/api/auth/request-code", {"email": "stranger@example.com"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["detail"], GENERIC)
        self.assertEqual(len(mail.outbox), 0)

    def test_code_is_stored_hashed(self):
        self.client.post("/api/auth/request-code", {"email": self.admin.email}, format="json")
        code = code_from_last_email()
        stored = AdminLoginCode.objects.get()
        self.assertNotIn(code, stored.code_hash)
        self.assertEqual(len(stored.code_hash), 64)

    def test_cannot_ask_again_within_a_minute(self):
        self.client.post("/api/auth/request-code", {"email": self.admin.email}, format="json")
        self.client.post("/api/auth/request-code", {"email": self.admin.email}, format="json")
        self.assertEqual(len(mail.outbox), 1)

    def test_working_code_is_not_cancelled_by_a_new_request(self):
        # Someone asking for codes in the admin's name must not lock the admin out
        self.client.post("/api/auth/request-code", {"email": self.admin.email}, format="json")
        code = code_from_last_email()
        AdminLoginCode.objects.update(created_at=timezone.now() - timedelta(minutes=2))
        self.client.post("/api/auth/request-code", {"email": self.admin.email}, format="json")
        self.assertEqual(len(mail.outbox), 1)  # no second code while the first still works
        r = self.client.post("/api/auth/verify-code", {"email": self.admin.email, "code": code}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_new_code_once_the_old_one_expired(self):
        self.client.post("/api/auth/request-code", {"email": self.admin.email}, format="json")
        AdminLoginCode.objects.update(
            created_at=timezone.now() - timedelta(minutes=11), expires_at=timezone.now() - timedelta(minutes=1)
        )
        self.client.post("/api/auth/request-code", {"email": self.admin.email}, format="json")
        self.assertEqual(len(mail.outbox), 2)


class VerifyCode(BaseTest):
    def setUp(self):
        super().setUp()
        self.admin = make_admin()
        self.client.post("/api/auth/request-code", {"email": self.admin.email}, format="json")
        self.code = code_from_last_email()

    def verify(self, code, client=None):
        return (client or self.client).post(
            "/api/auth/verify-code", {"email": self.admin.email, "code": code}, format="json"
        )

    def wrong(self):
        return "000000" if self.code != "000000" else "111111"

    def test_right_code_logs_in_with_cookie(self):
        r = self.verify(self.code)
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.json())
        self.assertNotIn("refresh", r.json())  # refresh token only lives in the cookie
        cookie = r.cookies["cp_refresh"]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["path"], "/api/auth/")
        self.assertEqual(cookie["samesite"], "Strict")
        self.admin.refresh_from_db()
        self.assertIsNotNone(self.admin.last_login)

    def test_code_works_only_once(self):
        self.assertEqual(self.verify(self.code).status_code, 200)
        self.assertEqual(self.verify(self.code, APIClient()).status_code, 400)

    def test_wrong_code_counts_attempts(self):
        self.assertEqual(self.verify(self.wrong()).status_code, 400)
        self.assertEqual(AdminLoginCode.objects.get().attempts, 1)

    def test_five_wrong_tries_cancel_the_code(self):
        for _ in range(5):
            self.verify(self.wrong())
        self.assertEqual(self.verify(self.code).status_code, 400)

    def test_expired_code_fails(self):
        AdminLoginCode.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.verify(self.code).status_code, 400)

    def test_daily_limit_on_wrong_guesses(self):
        # 20 wrong guesses spread over several codes: after that, even a right code is refused today
        AdminLoginCode.objects.update(attempts=0)
        for _ in range(3):
            AdminLoginCode.objects.create(
                admin=self.admin, code_hash="x" * 64, expires_at=timezone.now() - timedelta(minutes=1), attempts=5
            )
        AdminLoginCode.objects.filter(code_hash="x" * 64).update(attempts=5)
        latest = AdminLoginCode.objects.exclude(code_hash="x" * 64).get()
        AdminLoginCode.objects.filter(pk=latest.pk).update(created_at=timezone.now(), attempts=4)
        # 3 x 5 + 4 = 19 tries today, so one more is allowed, and it is the right code
        self.assertEqual(self.verify(self.code).status_code, 200)

    def test_daily_limit_blocks_after_twenty(self):
        for _ in range(4):
            AdminLoginCode.objects.create(
                admin=self.admin, code_hash="x" * 64, expires_at=timezone.now() - timedelta(minutes=1), attempts=5
            )
        latest = AdminLoginCode.objects.exclude(code_hash="x" * 64).get()
        AdminLoginCode.objects.filter(pk=latest.pk).update(created_at=timezone.now())
        self.assertEqual(self.verify(self.code).status_code, 400)

    def test_right_code_still_counts_as_a_try(self):
        self.verify(self.code)
        self.assertEqual(AdminLoginCode.objects.get().attempts, 1)

    def test_removed_admin_cannot_use_code(self):
        self.admin.is_active = False
        self.admin.save()
        self.assertEqual(self.verify(self.code).status_code, 400)


class StayingLoggedIn(BaseTest):
    def login(self):
        admin = make_admin()
        client = APIClient()
        client.post("/api/auth/request-code", {"email": admin.email}, format="json")
        r = client.post("/api/auth/verify-code", {"email": admin.email, "code": code_from_last_email()}, format="json")
        return admin, client, r.cookies["cp_refresh"].value

    def test_refresh_gives_new_tokens_and_old_refresh_stops_working(self):
        _, client, first = self.login()
        r = client.post("/api/auth/refresh")
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.json())
        second = r.cookies["cp_refresh"].value
        self.assertNotEqual(first, second)

        thief = APIClient()
        thief.cookies["cp_refresh"] = first
        self.assertEqual(thief.post("/api/auth/refresh").status_code, 401)

    def test_new_access_token_works(self):
        _, client, _ = self.login()
        access = client.post("/api/auth/refresh").json()["access"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(client.get("/api/auth/me").status_code, 200)

    def test_logout_cancels_refresh(self):
        _, client, token = self.login()
        self.assertEqual(client.post("/api/auth/logout").status_code, 204)
        again = APIClient()
        again.cookies["cp_refresh"] = token
        self.assertEqual(again.post("/api/auth/refresh").status_code, 401)

    def test_removed_admin_cannot_refresh(self):
        admin, client, _ = self.login()
        admin.is_active = False
        admin.save()
        self.assertEqual(client.post("/api/auth/refresh").status_code, 401)

    def test_no_cookie_means_not_logged_in(self):
        self.assertEqual(APIClient().post("/api/auth/refresh").status_code, 401)
