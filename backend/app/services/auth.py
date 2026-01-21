import base64
import hashlib
import secrets


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return f"{base64.b64encode(salt).decode('utf-8')}${base64.b64encode(digest).decode('utf-8')}"


def verify_password(password: str, hashed: str) -> bool:
    try:
        salt_b64, digest_b64 = hashed.split("$", 1)
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
    except Exception:
        return False

    candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return secrets.compare_digest(candidate, expected)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def verify_token(token: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    return secrets.compare_digest(hash_token(token), hashed)
