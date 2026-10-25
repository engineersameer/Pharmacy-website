from django.db import transaction
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
