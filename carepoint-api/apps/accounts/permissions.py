from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Logged-in, active pharmacy admin. This is the default for every endpoint."""

    message = "Admin login required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active and user.is_staff)
