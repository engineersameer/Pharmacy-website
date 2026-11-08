"""
CarePoint Pharmacy API settings.

Everything that differs between your laptop and the server (passwords, debug mode,
database address, email) comes from the .env file, never from this file.
"""

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

DEBUG = env.bool("DEBUG", default=False)
SECRET_KEY = env("SECRET_KEY")  # required: the app refuses to start without it
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "apps.accounts",
    "apps.orders",
    "apps.store",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": ["django.template.context_processors.request"]},
    },
]

DATABASES = {"default": env.db("DATABASE_URL")}
DATABASES["default"]["CONN_MAX_AGE"] = 60

# Shared cache in the database (no Redis needed). Used by rate limits, so the limits
# hold across all server processes. Create it once with: manage.py createcachetable
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "cache_table",
    }
}

AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Karachi"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Uploaded prescriptions. Private: there is NO public URL for this folder.
# Files are only sent through an admin-only API endpoint.
MEDIA_ROOT = Path(env("MEDIA_ROOT", default=str(BASE_DIR / "media")))
MAX_UPLOAD_FILES = 3
MAX_UPLOAD_MB = 10
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024  # non-file form data
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024  # bigger files are written to a temp file first
DATA_UPLOAD_MAX_NUMBER_FILES = MAX_UPLOAD_FILES  # refuse extra files before reading them

# ---------------------------------------------------------------------------
# API: locked by default. Every endpoint needs a logged-in admin unless the
# view itself says otherwise (only the customer-facing endpoints do).
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["apps.accounts.permissions.IsAdmin"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_THROTTLE_RATES": {
        "orders": env("THROTTLE_ORDERS", default="10/hour"),
        "login_request": env("THROTTLE_LOGIN_REQUEST", default="5/hour"),
        "login_verify": env("THROTTLE_LOGIN_VERIFY", default="20/hour"),
    },
    # How many proxies (Nginx) sit in front of Django, so rate limits see the real visitor IP
    "NUM_PROXIES": env.int("NUM_PROXIES", default=0),
}

# ---------------------------------------------------------------------------
# Admin login: email + one-time code, then JWT.
# Access token lives in memory in the browser. Refresh token lives in an
# HttpOnly cookie that page scripts can't read.
# ---------------------------------------------------------------------------
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": True,  # every refresh gives a fresh 14 days
    "BLACKLIST_AFTER_ROTATION": True,  # old refresh tokens stop working
    "UPDATE_LAST_LOGIN": False,  # set when the code is verified instead
    "SIGNING_KEY": SECRET_KEY,
}
REFRESH_COOKIE = {
    "name": "cp_refresh",
    "path": "/api/auth/",  # the browser only sends it to the login endpoints
    "secure": not DEBUG,  # HTTPS only on the real server
    "httponly": True,
    "samesite": "Strict",
}
LOGIN_CODE = {
    "digits": 6,
    "ttl_minutes": 10,
    "max_attempts": 5,
    "resend_seconds": 60,  # minimum wait before asking for another code
    "max_per_hour": 5,  # per admin
    "max_failed_per_day": 20,  # per admin, across all codes; limits slow guessing
}

# Email: "terminal" prints login codes in the terminal (development),
# "smtp" sends real emails (production).
EMAIL_MODE = env("EMAIL_MODE", default="terminal")
if EMAIL_MODE == "smtp":
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = env("EMAIL_HOST")
    EMAIL_PORT = env.int("EMAIL_PORT", default=587)
    EMAIL_HOST_USER = env("EMAIL_HOST_USER")
    EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD")
    EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
EMAIL_ASYNC = env.bool("EMAIL_ASYNC", default=True)  # send login emails without making the request wait
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="CarePoint Pharmacy <noreply@localhost>")

# Phone alerts for staff (web push): a new order reaches their phones even with the
# browser closed. Off when the keys are empty.
VAPID_PUBLIC_KEY = env("VAPID_PUBLIC_KEY", default="")
VAPID_PRIVATE_KEY = env("VAPID_PRIVATE_KEY", default="")
VAPID_SUBJECT = env("VAPID_SUBJECT", default="mailto:noreply@localhost")
PUSH_ASYNC = env.bool("PUSH_ASYNC", default=True)  # send alerts without making the customer wait

# ---------------------------------------------------------------------------
# Production hardening (only when DEBUG is off)
# ---------------------------------------------------------------------------
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
    SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=60 * 60 * 24 * 30)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = False  # turn on only once the real domain is live and stable
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

# HSTS preload is off on purpose (see above), so don't warn about it
SILENCED_SYSTEM_CHECKS = ["security.W021"]

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {"django.request": {"level": "WARNING"}},
}
