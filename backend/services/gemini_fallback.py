"""Shared helpers for Gemini model fallback when capacity is overloaded."""

from __future__ import annotations

import os
from typing import Iterable

from google.genai.errors import APIError


def is_transient_capacity_error(exc: BaseException) -> bool:
    """True when retrying with another model may help (503, UNAVAILABLE, 429, etc.)."""
    if not isinstance(exc, APIError):
        return False
    code = exc.code
    status = (exc.status or "").upper()
    if code in (503, 429):
        return True
    if status in ("UNAVAILABLE", "RESOURCE_EXHAUSTED"):
        return True
    msg = (exc.message or "").lower()
    if "high demand" in msg and "try again" in msg:
        return True
    return False


def build_model_chain(primary: str, fallbacks_env: str | None, defaults: Iterable[str]) -> list[str]:
    """
    Ordered unique list: primary first, then env CSV (if set), else defaults.
    Env format: comma-separated model ids, no spaces required.
    """
    chain: list[str] = [primary.strip()] if primary.strip() else []
    raw = (fallbacks_env or "").strip()
    if raw:
        extras = [part.strip() for part in raw.split(",") if part.strip()]
    else:
        extras = list(defaults)
    for m in extras:
        if m not in chain:
            chain.append(m)
    return chain


DEFAULT_IMAGE_MODEL_FALLBACKS = (
    "nano-banana-pro-preview",
    "gemini-3-pro-image-preview",
    "gemini-2.5-flash-image",
)

DEFAULT_PARSE_MODEL_FALLBACKS = (
    "gemini-3.1-flash-lite-preview",
    "gemini-3.1-pro-preview",
)


def image_model_chain() -> list[str]:
    primary = os.getenv("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image-preview")
    return build_model_chain(
        primary,
        os.getenv("GEMINI_IMAGE_MODEL_FALLBACKS"),
        DEFAULT_IMAGE_MODEL_FALLBACKS,
    )


def parse_model_chain() -> list[str]:
    primary = os.getenv("GEMINI_PARSE_MODEL", "gemini-2.5-flash")
    return build_model_chain(
        primary,
        os.getenv("GEMINI_PARSE_MODEL_FALLBACKS"),
        DEFAULT_PARSE_MODEL_FALLBACKS,
    )
