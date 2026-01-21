import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import auth_router, free_trial_router, lotto_router, ops_router, admin_router, subscription_router, oauth_router, guest_router
from app.config import get_frontend_origins, validate_production_settings
from app.db.session import SessionLocal
from app.db.models import OpsRequestLog
from app.db.init_db import init_db
from app.logging_config import setup_logging
from app.rate_limit import limiter, rate_limit_exceeded_handler

app = FastAPI(title="AI Lotto API")

# Rate Limiter 설정
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_frontend_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

app.include_router(free_trial_router)
app.include_router(auth_router)
app.include_router(oauth_router)
app.include_router(lotto_router)
app.include_router(ops_router)
app.include_router(admin_router)
app.include_router(subscription_router)
app.include_router(guest_router)


@app.on_event("startup")
def startup() -> None:
    validate_production_settings()
    setup_logging()
    init_db()


@app.middleware("http")
async def request_logger(request: Request, call_next):
    start_time = time.time()
    logger = logging.getLogger("request")

    try:
        response = await call_next(request)
    except Exception as exc:
        duration_ms = (time.time() - start_time) * 1000
        _store_request_log(request, 500, duration_ms)
        # 에러 상세 로깅
        logger.error(
            "UNHANDLED ERROR | %s %s | Error: %s | Duration: %.2fms",
            request.method,
            request.url.path,
            str(exc),
            duration_ms,
            exc_info=True,  # 스택 트레이스 포함
        )
        raise

    duration_ms = (time.time() - start_time) * 1000
    _store_request_log(request, response.status_code, duration_ms)

    # 에러 응답 상세 로깅
    if response.status_code >= 400:
        logger.warning(
            "ERROR RESPONSE | %s %s | Status: %s | Duration: %.2fms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
    else:
        logger.info(
            "%s %s %s %.2fms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
    return response


def _store_request_log(request: Request, status_code: int, duration_ms: float) -> None:
    path = request.url.path
    if path.startswith("/static"):
        return
    db = SessionLocal()
    try:
        db.add(
            OpsRequestLog(
                method=request.method,
                path=path[:200],
                status_code=status_code,
                duration_ms=duration_ms,
                is_error=status_code >= 400,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}
