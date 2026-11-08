from django.conf import settings
from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PushSubscription
from .push import send_test

# All views here use the default permission: logged-in, active admin only.


class _Keys(serializers.Serializer):
    p256dh = serializers.CharField(max_length=200)
    auth = serializers.CharField(max_length=100)


class _Subscription(serializers.Serializer):
    """What the browser gives us when staff turn on phone alerts (PushSubscription.toJSON())."""

    endpoint = serializers.URLField(max_length=1000)
    keys = _Keys()

    def validate_endpoint(self, value):
        if not value.startswith("https://"):
            raise serializers.ValidationError("Push addresses always start with https://")
        return value


class PushKeyView(APIView):
    """GET /api/admin/push/key: the public key the browser needs to turn on phone alerts.
    publicKey is empty when phone alerts are turned off on this server."""

    def get(self, request):
        return Response({"publicKey": settings.VAPID_PUBLIC_KEY if settings.VAPID_PRIVATE_KEY else ""})


class PushSubscriptionView(APIView):
    """POST   /api/admin/push/subscriptions {endpoint, keys: {p256dh, auth}}: this device wants alerts
    DELETE /api/admin/push/subscriptions {endpoint}: this device no longer wants alerts

    Saving again is fine (the browser sends it on every visit). A device belongs to whoever
    turned it on last, so a shared counter phone follows the staff member logged in on it."""

    def post(self, request):
        if not settings.VAPID_PRIVATE_KEY:
            raise ValidationError({"detail": "Phone alerts are turned off on this server."})
        s = _Subscription(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        PushSubscription.objects.update_or_create(
            endpoint=data["endpoint"],
            defaults={"admin": request.user, "p256dh": data["keys"]["p256dh"], "auth": data["keys"]["auth"]},
        )
        return Response({"subscribed": True}, status=status.HTTP_201_CREATED)

    def delete(self, request):
        endpoint = str(request.data.get("endpoint", ""))
        PushSubscription.objects.filter(endpoint=endpoint, admin=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PushTestView(APIView):
    """POST /api/admin/push/test: send a test alert to my own devices, to check it works."""

    def post(self, request):
        if not settings.VAPID_PRIVATE_KEY:
            raise ValidationError({"detail": "Phone alerts are turned off on this server."})
        sent = send_test(request.user)
        if not sent:
            raise ValidationError({"detail": "Turn on phone alerts on this device first."})
        return Response({"devices": sent})
