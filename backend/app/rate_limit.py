from __future__ import annotations

import os
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse

# 신뢰할 수 있는 프록시 IP 목록 (환경변수로 설정)
# 예: TRUSTED_PROXIES=127.0.0.1,10.0.0.0/8
_TRUSTED_PROXIES_RAW = os.getenv("AI_LOTTO_TRUSTED_PROXIES", "127.0.0.1")
TRUSTED_PROXIES = set(p.strip() for p in _TRUSTED_PROXIES_RAW.split(",") if p.strip())


def get_client_ip(request: Request) -> str:
    """
    클라이언트 IP 추출 (프록시 고려)
    - 신뢰할 수 있는 프록시에서 온 요청만 X-Forwarded-For 헤더 사용
    - 그 외에는 직접 연결된 IP 사용
    """
    remote_ip = get_remote_address(request)

    # 신뢰할 수 있는 프록시에서 온 요청만 X-Forwarded-For 사용
    if remote_ip in TRUSTED_PROXIES:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # 첫 번째 IP가 실제 클라이언트
            return forwarded.split(",")[0].strip()

    return remote_ip


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
