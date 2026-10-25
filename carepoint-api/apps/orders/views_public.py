from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .serializers import OrderCreatedSerializer, PrescriptionUploadSerializer, RefillCreateSerializer


class _PublicOrderView(APIView):
    """Customer endpoints: anyone may place an order, but only a few times per hour
    from one connection, so the form can't be used to flood the pharmacy."""

    permission_classes = [AllowAny]
    authentication_classes = []  # customers never log in
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "orders"
    serializer_class = None

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(OrderCreatedSerializer(order).data, status=status.HTTP_201_CREATED)


class RefillCreateView(_PublicOrderView):
    serializer_class = RefillCreateSerializer


class PrescriptionUploadView(_PublicOrderView):
    serializer_class = PrescriptionUploadSerializer
    parser_classes = [MultiPartParser, FormParser]
