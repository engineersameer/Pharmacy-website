import json
from types import SimpleNamespace
from unittest import mock

from django.test import override_settings
from pywebpush import WebPushException

from apps.accounts.models import PushSubscription

from .helpers import BaseTest, auth_client, make_admin

DEVICE = {
    "endpoint": "https://fcm.googleapis.com/fcm/send/device-1",
    "keys": {"p256dh": "BPublicKeyOfTheDevice", "auth": "secret123"},
}
REFILL = {"name": "Ayesha Khan", "phone": "0321 4567890", "method": "pickup"}
PUSH_ON = {"VAPID_PUBLIC_KEY": "BServerPublicKey", "VAPID_PRIVATE_KEY": "server-private-key", "PUSH_ASYNC": False}


@override_settings(**PUSH_ON)
class PhoneAlerts(BaseTest):
    def setUp(self):
        super().setUp()
        self.ayesha_user = make_admin("ayesha@carepoint.pk")
        self.ayesha = auth_client(self.ayesha_user)

    def place_order(self):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post("/api/refills", REFILL, format="json")

    def test_public_key_for_turning_alerts_on(self):
        self.assertEqual(self.ayesha.get("/api/admin/push/key").json(), {"publicKey": "BServerPublicKey"})

    @override_settings(VAPID_PRIVATE_KEY="")
    def test_no_key_when_alerts_are_off_on_the_server(self):
        self.assertEqual(self.ayesha.get("/api/admin/push/key").json(), {"publicKey": ""})

    def test_save_a_device_and_saving_again_keeps_one(self):
        self.assertEqual(self.ayesha.post("/api/admin/push/subscriptions", DEVICE, format="json").status_code, 201)
        self.ayesha.post("/api/admin/push/subscriptions", DEVICE, format="json")
        self.assertEqual(PushSubscription.objects.filter(admin=self.ayesha_user).count(), 1)

    def test_device_follows_the_last_staff_member_who_turned_it_on(self):
        self.ayesha.post("/api/admin/push/subscriptions", DEVICE, format="json")
        bilal = make_admin("bilal@carepoint.pk")
        auth_client(bilal).post("/api/admin/push/subscriptions", DEVICE, format="json")
        self.assertEqual(PushSubscription.objects.get().admin, bilal)

    def test_rejects_an_address_that_is_not_https(self):
        bad = {**DEVICE, "endpoint": "http://example.com/push"}
        self.assertEqual(self.ayesha.post("/api/admin/push/subscriptions", bad, format="json").status_code, 400)

    def test_remove_a_device(self):
        self.ayesha.post("/api/admin/push/subscriptions", DEVICE, format="json")
        r = self.ayesha.delete("/api/admin/push/subscriptions", {"endpoint": DEVICE["endpoint"]}, format="json")
        self.assertEqual(r.status_code, 204)
        self.assertFalse(PushSubscription.objects.exists())

    def test_customers_cannot_save_a_device(self):
        self.assertEqual(self.client.post("/api/admin/push/subscriptions", DEVICE, format="json").status_code, 401)

    @mock.patch("apps.accounts.push.webpush")
    def test_new_order_alerts_every_staff_device(self, webpush):
        self.ayesha.post("/api/admin/push/subscriptions", DEVICE, format="json")
        r = self.place_order()
        self.assertEqual(r.status_code, 201)
        webpush.assert_called_once()
        call = webpush.call_args.kwargs
        self.assertEqual(call["subscription_info"]["endpoint"], DEVICE["endpoint"])
        self.assertEqual(call["vapid_private_key"], "server-private-key")
        message = json.loads(call["data"])
        self.assertEqual(message["title"], f"New order #{r.json()['id']}")
        self.assertEqual(message["body"], "Ayesha Khan · Pickup · Refill")

    @mock.patch("apps.accounts.push.webpush")
    def test_removed_staff_get_no_alerts(self, webpush):
        self.ayesha.post("/api/admin/push/subscriptions", DEVICE, format="json")
        self.ayesha_user.is_active = False
        self.ayesha_user.save()
        self.place_order()
        webpush.assert_not_called()

    @mock.patch("apps.accounts.push.webpush")
    def test_device_that_turned_alerts_off_is_forgotten(self, webpush):
        self.ayesha.post("/api/admin/push/subscriptions", DEVICE, format="json")
        webpush.side_effect = WebPushException("gone", response=SimpleNamespace(status_code=410))
        self.assertEqual(self.place_order().status_code, 201)  # the customer's order still goes through
        self.assertFalse(PushSubscription.objects.exists())

    @mock.patch("apps.accounts.push.webpush")
    def test_other_push_errors_keep_the_device(self, webpush):
        self.ayesha.post("/api/admin/push/subscriptions", DEVICE, format="json")
        webpush.side_effect = WebPushException("busy", response=SimpleNamespace(status_code=503))
        self.assertEqual(self.place_order().status_code, 201)
        self.assertTrue(PushSubscription.objects.exists())

    @mock.patch("apps.accounts.push.webpush")
    def test_test_alert_goes_only_to_my_devices(self, webpush):
        self.ayesha.post("/api/admin/push/subscriptions", DEVICE, format="json")
        bilal = auth_client(make_admin("bilal@carepoint.pk"))
        bilal.post("/api/admin/push/subscriptions", {**DEVICE, "endpoint": DEVICE["endpoint"] + "-bilal"}, format="json")
        r = self.ayesha.post("/api/admin/push/test")
        self.assertEqual(r.json(), {"devices": 1})
        self.assertEqual(webpush.call_args.kwargs["subscription_info"]["endpoint"], DEVICE["endpoint"])

    def test_test_alert_needs_a_device(self):
        self.assertEqual(self.ayesha.post("/api/admin/push/test").status_code, 400)

    @override_settings(VAPID_PRIVATE_KEY="")
    @mock.patch("apps.accounts.push.webpush")
    def test_nothing_is_sent_when_alerts_are_off_on_the_server(self, webpush):
        PushSubscription.objects.create(admin=self.ayesha_user, endpoint=DEVICE["endpoint"], p256dh="k", auth="a")
        self.place_order()
        webpush.assert_not_called()
