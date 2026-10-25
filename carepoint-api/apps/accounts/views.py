from django.conf import settings
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .login_codes import check_code, find_admin, issue_code
from .models import User

COOKIE = settings.REFRESH_COOKIE
GENERIC_SENT = "If this email belongs to an admin, a login code has been sent."
GENERIC_INVALID = "That code is wrong or has expired. Please try again or ask for a new code."


def _admin_json(user: User) -> dict:
    return {"id": user.id, "email": user.email, "name": user.get_full_name() or user.email}


def _with_refresh_cookie(response: Response, refresh: str) -> Response:
    response.set_cookie(
        COOKIE["name"],
        refresh,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        path=COOKIE["path"],
        secure=COOKIE["secure"],
        httponly=COOKIE["httponly"],
        samesite=COOKIE["samesite"],
    )
    return response


def _clear_refresh_cookie(response: Response) -> Response:
    response.delete_cookie(COOKIE["name"], path=COOKIE["path"], samesite=COOKIE["samesite"])
    return response


class _PublicAuthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField()


class CodeSerializer(EmailSerializer):
    code = serializers.RegexField(r"^\s*\d{6}\s*$", error_messages={"invalid": "Enter the 6-digit code."})


class RequestCodeView(_PublicAuthView):
    """POST /api/auth/request-code {email}. Always gives the same answer, so nobody can
    use this page to find out which emails belong to admins."""

    throttle_scope = "login_request"

    def post(self, request):
        s = EmailSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        admin = find_admin(s.validated_data["email"])
        if admin:
            issue_code(admin)
        return Response({"detail": GENERIC_SENT})


class VerifyCodeView(_PublicAuthView):
    """POST /api/auth/verify-code {email, code}. On success: access token in the reply,
    refresh token in an HttpOnly cookie."""

    throttle_scope = "login_verify"

    def post(self, request):
        s = CodeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        admin = find_admin(s.validated_data["email"])
        if admin is None or not check_code(admin, s.validated_data["code"]):
            return Response({"detail": GENERIC_INVALID}, status=status.HTTP_400_BAD_REQUEST)

        User.objects.filter(pk=admin.pk).update(last_login=timezone.now())
        refresh = RefreshToken.for_user(admin)
        response = Response({"access": str(refresh.access_token), "admin": _admin_json(admin)})
        return _with_refresh_cookie(response, str(refresh))


class RefreshView(_PublicAuthView):
    """POST /api/auth/refresh. Uses the cookie to get a new access token and a fresh
    14-day refresh token. The old refresh token stops working."""

    throttle_classes = []

    def post(self, request):
        token = request.COOKIES.get(COOKIE["name"])
        if not token:
            return Response({"detail": "Not logged in."}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            user_id = RefreshToken(token).get("user_id")
            user = User.objects.filter(pk=user_id, is_active=True, is_staff=True).first()
            if user is None:
                raise TokenError("Admin no longer active.")
            s = TokenRefreshSerializer(data={"refresh": token})
            s.is_valid(raise_exception=True)
        except (TokenError, InvalidToken, AuthenticationFailed, ValidationError):
            return _clear_refresh_cookie(
                Response({"detail": "Your login has expired. Please log in again."}, status=status.HTTP_401_UNAUTHORIZED)
            )

        response = Response({"access": s.validated_data["access"], "admin": _admin_json(user)})
        return _with_refresh_cookie(response, s.validated_data.get("refresh", token))


class LogoutView(_PublicAuthView):
    """POST /api/auth/logout. Cancels the refresh token right away and removes the cookie."""

    throttle_classes = []

    def post(self, request):
        token = request.COOKIES.get(COOKIE["name"])
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass  # already expired or cancelled
        return _clear_refresh_cookie(Response(status=status.HTTP_204_NO_CONTENT))


class MeView(APIView):
    """GET /api/auth/me: who is logged in (admins only)."""

    def get(self, request):
        return Response(_admin_json(request.user))
