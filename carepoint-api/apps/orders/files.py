"""Checks for uploaded prescription files.

We never trust the file name or the type the browser claims. We read the file's
first bytes to see what it really is, and only accept real images and PDFs.
"""

from django.conf import settings
from PIL import Image, UnidentifiedImageError
from rest_framework.exceptions import ValidationError

# Detected type -> file extension we store it under
IMAGE_FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}
HEIF_BRANDS = {b"heic", b"heix", b"hevc", b"heim", b"heis", b"mif1", b"msf1"}  # iPhone photos

CONTENT_TYPES = {
    "jpg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "heic": "image/heic",
    "pdf": "application/pdf",
}


def detect_extension(upload) -> str:
    """Return the safe extension for this upload, or raise ValidationError."""
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if upload.size > max_bytes:
        raise ValidationError(f"Each file must be {settings.MAX_UPLOAD_MB} MB or smaller.")
    if upload.size == 0:
        raise ValidationError("This file is empty.")

    upload.seek(0)
    head = upload.read(16)
    upload.seek(0)

    if head.startswith(b"%PDF-"):
        return "pdf"
    if head[4:8] == b"ftyp" and head[8:12] in HEIF_BRANDS:
        return "heic"

    try:
        with Image.open(upload) as img:
            fmt = img.format
            img.verify()  # checks the file is a real, readable image
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError):
        raise ValidationError("Please upload a photo (JPG, PNG, HEIC) or a PDF.")
    finally:
        upload.seek(0)

    if fmt not in IMAGE_FORMATS:
        raise ValidationError("Please upload a photo (JPG, PNG, HEIC) or a PDF.")
    return IMAGE_FORMATS[fmt]
