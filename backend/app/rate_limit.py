from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse


def get_client_ip(request: Request) -> str:
    """클라이언트 IP 추출 (프록시 고려)"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=get_client_ip)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Rate limit 초과 시 응답"""
    return JSONResponse(
        status_code=429,
        content={
            "detail": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
            "retry_after": exc.detail,
        },
    )
