from django.db import transaction
from django.http import Http404, JsonResponse
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import OpeningHours, StoreSettings
from .serializers import AdminStoreSerializer, HoursSerializer, PublicStoreSerializer


class PublicStoreView(APIView):
    """GET /api/store: name, phone, address, hours and stats for the public website."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(PublicStoreSerializer(StoreSettings.load()).data)


class WebAppManifestView(APIView):
    """GET /api/manifest/customer.webmanifest and /api/manifest/staff.webmanifest

    The "ID cards" that let phones install the site as an app. There are two apps on the
    same website: the customer app (the whole site) and the staff app (only /staff). They
    are made here so they carry the store name staff set in Store settings."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, app):
        name = StoreSettings.load().name
        shared = {
            "display": "standalone",
            "background_color": "#0b1f2a",
            "theme_color": "#0b1f2a",
            "icons": [
                {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
                {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
            ],
        }
        if app == "customer":
            manifest = {
                "id": "/",
                "name": name,
                "short_name": name,
                "description": f"Order prescription refills and uploads from {name}.",
                "start_url": "/",
                "scope": "/",
                **shared,
            }
        elif app == "staff":
            manifest = {
                # Same id as the first staff app, so phones that installed it keep it
                "id": "/staff",
                "name": f"{name} Staff",
                "short_name": "Staff",
                "description": "New-order alerts and order dashboard for pharmacy staff.",
                "start_url": "/staff",
                "scope": "/staff",  # only the staff pages, so customers get their own app
                **shared,
            }
        else:
            raise Http404
        return JsonResponse(manifest, content_type="application/manifest+json")


class AdminStoreView(APIView):
    """GET / PATCH /api/admin/store: admins view and edit the single settings row."""

    def get(self, request):
        return Response(AdminStoreSerializer(StoreSettings.load()).data)

    def patch(self, request):
        store = StoreSettings.load()
        serializer = AdminStoreSerializer(store, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)


class AdminHoursView(APIView):
    """GET / PUT /api/admin/hours: the whole week at once, always exactly 7 days."""

    def get(self, request):
        return Response(HoursSerializer(OpeningHours.objects.all(), many=True).data)

    @transaction.atomic
    def put(self, request):
        serializer = HoursSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        days = [row["day_of_week"] for row in serializer.validated_data]
        if sorted(days) != list(range(7)):
            raise serializers.ValidationError("Send all 7 days, once each (0 = Sunday … 6 = Saturday).")

        rows = {h.day_of_week: h for h in OpeningHours.objects.select_for_update()}
        for new in serializer.validated_data:
            row = rows[new["day_of_week"]]
            changed = (row.opens_at, row.closes_at, row.is_closed) != (new["opens_at"], new["closes_at"], new["is_closed"])
            if changed:  # only days that actually changed record who changed them
                row.opens_at, row.closes_at, row.is_closed = new["opens_at"], new["closes_at"], new["is_closed"]
                row.updated_by = request.user
                row.save()
        return Response(HoursSerializer(OpeningHours.objects.all(), many=True).data, status=status.HTTP_200_OK)
