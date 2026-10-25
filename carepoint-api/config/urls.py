"""
URL map. Who may use each URL:

  Public (customers, no login):
    GET  /api/store                              store details for the website
    POST /api/refills                            order with a prescription number
    POST /api/prescriptions                      order with uploaded prescription photos

  Login (anyone may try; rate limited):
    POST /api/auth/request-code                  email -> code sent
    POST /api/auth/verify-code                   email + code -> logged in
    POST /api/auth/refresh                       keep logged in (uses the cookie)
    POST /api/auth/logout

  Admins only (everything else):
    GET  /api/auth/me
    GET  /api/admin/orders                       list, filter, search
    GET  /api/admin/orders/changes?since=        live dashboard updates
    GET  /api/admin/orders/<id>
    POST /api/admin/orders/<id>/status
    POST /api/admin/orders/<id>/prescriptions    attach a prescription by number
    GET  /api/admin/prescriptions?phone=|number=
    GET  /api/admin/prescriptions/<id>/file
    GET/PATCH /api/admin/store
    GET/PUT   /api/admin/hours
"""

from django.urls import path

from apps.accounts import views as auth
from apps.orders import views_admin as orders_admin
from apps.orders import views_public as orders_public
from apps.store import views as store

urlpatterns = [
    # Public
    path("api/store", store.PublicStoreView.as_view()),
    path("api/refills", orders_public.RefillCreateView.as_view()),
    path("api/prescriptions", orders_public.PrescriptionUploadView.as_view()),
    # Login
    path("api/auth/request-code", auth.RequestCodeView.as_view()),
    path("api/auth/verify-code", auth.VerifyCodeView.as_view()),
    path("api/auth/refresh", auth.RefreshView.as_view()),
    path("api/auth/logout", auth.LogoutView.as_view()),
    path("api/auth/me", auth.MeView.as_view()),
    # Admin
    path("api/admin/orders", orders_admin.OrderListView.as_view()),
    path("api/admin/orders/changes", orders_admin.OrderChangesView.as_view()),
    path("api/admin/orders/<int:pk>", orders_admin.OrderDetailView.as_view()),
    path("api/admin/orders/<int:pk>/status", orders_admin.OrderStatusView.as_view()),
    path("api/admin/orders/<int:pk>/prescriptions", orders_admin.OrderLinkPrescriptionView.as_view()),
    path("api/admin/prescriptions", orders_admin.PrescriptionSearchView.as_view()),
    path(
        "api/admin/prescriptions/<int:pk>/file",
        orders_admin.PrescriptionFileView.as_view(),
        name="admin-prescription-file",
    ),
    path("api/admin/store", store.AdminStoreView.as_view()),
    path("api/admin/hours", store.AdminHoursView.as_view()),
]
