import base64
import hmac
import json
import time
from hashlib import sha256
from typing import Optional


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("utf-8")


def _b64url_decode(raw: str) -> bytes:
    padding = "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode(raw + padding)


def encode_jwt(payload: dict, secret: str, ttl_seconds: int) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = payload.copy()
    payload["exp"] = int(time.time()) + ttl_seconds

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), signing_input, sha256).digest()
    signature_b64 = _b64url_encode(signature)
    return f"{header_b64}.{payload_b64}.{signature_b64}"


def decode_jwt(token: str, secret: str) -> Optional[dict]:
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
    except ValueError:
        return None

    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    expected_signature = hmac.new(secret.encode("utf-8"), signing_input, sha256).digest()
    if not hmac.compare_digest(_b64url_encode(expected_signature), signature_b64):
        return None

    payload = json.loads(_b64url_decode(payload_b64))
    exp = payload.get("exp")
    if exp is None or exp < int(time.time()):
        return None

    return payload
