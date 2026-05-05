import io
from PIL import Image

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE_MB = 10


def validate_upload(image_bytes: bytes, content_type: str) -> str | None:
    """Returns an error message string, or None if valid."""
    if content_type not in ALLOWED_MIME_TYPES:
        return f"File type '{content_type}' not allowed. Use JPEG, PNG, or WebP."

    if len(image_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
        return f"File too large. Maximum is {MAX_FILE_SIZE_MB}MB."

    try:
        Image.open(io.BytesIO(image_bytes)).verify()
    except Exception:
        return "Could not read image file. It may be corrupted."

    return None
