from datetime import timedelta
from datetime import timezone as dt_timezone

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .admin_serializers import (
    AdminOrderSerializer,
    AdminPrescriptionSerializer,
    LinkPrescriptionSerializer,
    PrescriptionSearchResultSerializer,
    StatusChangeSerializer,
)
from .files import CONTENT_TYPES
from .models import Order, OrderPrescription, Prescription
from .phone import normalize_pk_mobile
from .statuses import FINISHED, allowed_next

# All views here use the default permission: logged-in, active admin only.


def _orders():
    # prescriptions__orders lets the warnings check other orders without extra queries
    return Order.objects.select_related("accepted_by").prefetch_related("prescriptions__orders")


class OrderListView(ListAPIView):
    """GET /api/admin/orders?status=received,confirmed&q=search. Newest first, 50 per page."""

    serializer_class = AdminOrderSerializer

    def get_queryset(self):
        qs = _orders()
        statuses = [s for s in self.request.query_params.get("status", "").split(",") if s]
        if statuses:
            valid = set(Order.Status.values)
            if not set(statuses) <= valid:
                raise ValidationError({"status": f"Use any of: {', '.join(sorted(valid))}"})
            qs = qs.filter(status__in=statuses)

        q = self.request.query_params.get("q", "").strip()
        if q:
            match = Q(customer_name__icontains=q)
            if q.isdigit() and len(q) <= 15:
                match |= Q(id=int(q)) | Q(prescriptions__id=int(q))
            try:
                match |= Q(customer_phone=normalize_pk_mobile(q))
            except DjangoValidationError:
                pass  # the search text isn't a phone number
            qs = qs.filter(match).distinct()
        return qs


class OrderDetailView(RetrieveAPIView):
    """GET /api/admin/orders/<id>"""

    serializer_class = AdminOrderSerializer
    queryset = _orders()


class OrderChangesView(APIView):
    """GET /api/admin/orders/changes?since=<serverTime from the last reply>

    The dashboard calls this every few seconds. It returns new orders and orders whose
    status changed since the last call, plus the server time to send next time."""

    def get(self, request):
        since = parse_datetime(request.query_params.get("since", ""))
        if since is None:
            raise ValidationError({"since": "Send the serverTime from the previous reply."})
        changed = _orders().filter(updated_at__gt=since).order_by("updated_at")[:200]
        # Overlap the next check by a few seconds: an order being saved right now could carry a
        # timestamp just before "now". The dashboard replaces orders by id, so repeats are harmless.
        next_since = timezone.now() - timedelta(seconds=5)
        # "Z" instead of "+00:00": a "+" in a web address is read as a space
        server_time = next_since.astimezone(dt_timezone.utc).isoformat().replace("+00:00", "Z")
        return Response({"serverTime": server_time, "orders": AdminOrderSerializer(changed, many=True).data})


class OrderStatusView(APIView):
    """POST /api/admin/orders/<id>/status {status, expectedStatus}

    Only the first admin to act wins. If the order is no longer in the status the admin's
    screen showed, nothing changes and they get the current order back (409)."""

    def post(self, request, pk):
        data = StatusChangeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        order = get_object_or_404(Order, pk=pk)
        new, expected = data.validated_data["status"], data.validated_data["expectedStatus"]

        if order.status != expected:
            return self._conflict(order)
        if new not in allowed_next(order):
            raise ValidationError({"status": f"An order that is '{order.status}' can't become '{new}'."})

        # Change it only if it is still in the expected status, in one database step
        updated = Order.objects.filter(pk=pk, status=expected).update(status=new, updated_at=timezone.now())
        order = _orders().get(pk=pk)
        if not updated:
            return self._conflict(order)
        return Response(AdminOrderSerializer(order).data)

    def _conflict(self, order):
        return Response(
            {
                "detail": "Another admin already updated this order.",
                "order": AdminOrderSerializer(order).data,
            },
            status=status.HTTP_409_CONFLICT,
        )


class OrderAcceptView(APIView):
    """POST /api/admin/orders/<id>/accept

    Staff pressed Accept on the new-order alarm. It is saved on the order, so the alarm stops
    on every staff screen at their next check. The first person to accept is kept; accepting
    again changes nothing. This does not change the status: staff still confirm the order
    after checking it."""

    def post(self, request, pk):
        get_object_or_404(Order, pk=pk)
        now = timezone.now()
        Order.objects.filter(pk=pk, accepted_at__isnull=True).update(
            accepted_at=now, accepted_by=request.user, updated_at=now
        )
        return Response(AdminOrderSerializer(_orders().get(pk=pk)).data)


def _refill_open_for_changes(order: Order):
    """Prescriptions can only be attached to or removed from refill orders that aren't finished."""
    if order.order_type != Order.Type.REFILL:
        raise ValidationError({"detail": "Only refill orders can have prescriptions attached or removed."})
    if order.status in FINISHED:
        raise ValidationError({"detail": "This order is finished, so its prescriptions can't be changed."})


class OrderLinkPrescriptionView(APIView):
    """POST /api/admin/orders/<id>/prescriptions {prescriptionNumber}

    Staff found the right prescription (by phone or number) and attach it to a refill."""

    def post(self, request, pk):
        order = get_object_or_404(Order, pk=pk)
        _refill_open_for_changes(order)
        data = LinkPrescriptionSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        prescription = Prescription.objects.filter(pk=data.validated_data["prescriptionNumber"]).first()
        if prescription is None:
            raise ValidationError({"prescriptionNumber": "No prescription has this number."})
        OrderPrescription.objects.get_or_create(order=order, prescription=prescription)
        Order.objects.filter(pk=pk).update(updated_at=timezone.now())  # so other screens pick it up
        return Response(AdminOrderSerializer(_orders().get(pk=pk)).data)


class OrderUnlinkPrescriptionView(APIView):
    """DELETE /api/admin/orders/<id>/prescriptions/<prescription id>

    The pharmacist found that this prescription is wrong for the order. Only the link is
    removed; the prescription itself stays, as other orders may use it."""

    def delete(self, request, pk, prescription_pk):
        order = get_object_or_404(Order, pk=pk)
        _refill_open_for_changes(order)
        deleted, _ = OrderPrescription.objects.filter(order=order, prescription_id=prescription_pk).delete()
        if not deleted:
            raise Http404("This prescription isn't attached to this order.")
        Order.objects.filter(pk=pk).update(updated_at=timezone.now())  # so other screens pick it up
        return Response(AdminOrderSerializer(_orders().get(pk=pk)).data)


class PrescriptionSearchView(APIView):
    """GET /api/admin/prescriptions?phone=0300… or ?number=12345678

    Find a customer's earlier prescriptions, e.g. when they ordered without their number."""

    def get(self, request):
        phone = request.query_params.get("phone", "").strip()
        number = request.query_params.get("number", "").strip()
        if number:
            if not number.isdigit() or len(number) > 15:
                raise ValidationError({"number": "Enter the prescription number."})
            qs = Prescription.objects.filter(pk=int(number))
        elif phone:
            try:
                phone = normalize_pk_mobile(phone)
            except DjangoValidationError:
                raise ValidationError({"phone": "Enter a valid Pakistani mobile number."})
            qs = Prescription.objects.filter(orders__customer_phone=phone).distinct()
        else:
            raise ValidationError({"detail": "Search by phone or number."})
        qs = qs.prefetch_related("orders").order_by("-created_at")
        return Response(PrescriptionSearchResultSerializer(qs[:50], many=True).data)


class PrescriptionFileView(APIView):
    """GET /api/admin/prescriptions/<id>/file: the uploaded photo or PDF, admins only."""

    def get(self, request, pk):
        prescription = get_object_or_404(Prescription, pk=pk)
        ext = prescription.file.name.rsplit(".", 1)[-1]
        try:
            handle = prescription.file.open("rb")
        except FileNotFoundError:
            raise Http404("File missing.")
        response = FileResponse(handle, content_type=CONTENT_TYPES.get(ext, "application/octet-stream"))
        filename = f"prescription-{prescription.id}.{ext}"
        if ext == "pdf":
            # PDFs download instead of opening in a tab, so a crafted PDF can't run anything in our site
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
        else:
            response["Content-Disposition"] = f'inline; filename="{filename}"'
            # Shown in the browser, but locked down: nothing in the file can run
            response["Content-Security-Policy"] = "sandbox; default-src 'none'; img-src 'self'"
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response
