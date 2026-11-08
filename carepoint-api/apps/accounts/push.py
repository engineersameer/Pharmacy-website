"""Send new-order alerts to staff phones (web push).

Each staff device that turned on phone alerts has an address at its browser's push
service (Google for Chrome and Android, Apple for iPhone, Mozilla for Firefox). We lock
the message with that device's keys and hand it to the push service, which delivers it
over the phone's always-on connection, even with the browser closed."""

import json
import logging
import threading

from django.conf import settings
from django.db import connections
from pywebpush import WebPushException, webpush

from .models import PushSubscription

log = logging.getLogger(__name__)

# The push service drops alerts older than this if the phone was offline: an alert about
# an order from yesterday is noise, the staff page shows it anyway.
TTL_SECONDS = 60 * 60


def _payload(order) -> dict:
    method = "Delivery" if order.method == "delivery" else "Pickup"
    kind = "Upload" if order.order_type == "new_prescription" else "Refill"
    return {
        "title": f"New order #{order.id}",
        "body": f"{order.customer_name} · {method} · {kind}",
        "orderId": order.id,
        "url": "/staff",
    }


def _send_to_all(payload: dict) -> None:
    _send(PushSubscription.objects.filter(admin__is_active=True, admin__is_staff=True), payload)


def send_test(admin) -> int:
    """Send a test alert to this staff member's own devices. Returns how many devices."""
    devices = list(PushSubscription.objects.filter(admin=admin))
    _send(devices, {"title": "Phone alerts work ✅", "body": "New orders will show up like this.", "url": "/staff"})
    return len(devices)


def _send(devices, payload: dict) -> None:
    data = json.dumps(payload)
    for device in devices:
        try:
            webpush(
                subscription_info=device.as_webpush(),
                data=data,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_SUBJECT},
                ttl=TTL_SECONDS,
                headers={"Urgency": "high"},
                timeout=10,
            )
        except WebPushException as e:
            code = getattr(e.response, "status_code", None)
            if code in (404, 410):
                # The device turned alerts off or the browser was removed: forget it
                device.delete()
            else:
                log.warning("Phone alert to device %s failed: %s", device.pk, e)
        except Exception:
            log.exception("Phone alert to device %s failed", device.pk)


def notify_new_order(order) -> None:
    """Alert every staff device about a new order, without making the customer wait."""
    if not settings.VAPID_PRIVATE_KEY:
        return  # phone alerts are turned off on this server
    payload = _payload(order)
    if not settings.PUSH_ASYNC:
        _send_to_all(payload)
        return

    def run():
        try:
            _send_to_all(payload)
        finally:
            connections.close_all()

    threading.Thread(target=run, daemon=True).start()
