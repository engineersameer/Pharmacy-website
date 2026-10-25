import re

from django.core.exceptions import ValidationError


def normalize_pk_mobile(value: str) -> str:
    """Turn any common way of writing a Pakistani mobile number into +923XXXXXXXXX.

    Accepts 0300 1234567, 03001234567, 3001234567, +92 300 1234567, 92300…, 0092300…
    """
    digits = re.sub(r"\D", "", value or "")
    if digits.startswith("0092"):
        digits = digits[4:]
    elif digits.startswith("92") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("0"):
        digits = digits[1:]
    if not re.fullmatch(r"3\d{9}", digits):
        raise ValidationError("Please enter a valid Pakistani mobile number, e.g. 0300 1234567.")
    return f"+92{digits}"
