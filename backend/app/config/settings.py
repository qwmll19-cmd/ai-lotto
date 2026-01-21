from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path
from dataclasses import dataclass, field

# .env 파일 로드 (uvicorn 직접 실행시에도 환경변수 로드되도록)
from dotenv import load_dotenv
_env_path = Path(__file__).resolve().parents[2] / ".env"
if _env_path.exists():
    load_dotenv(_env_path)


def _get_jwt_secret() -> str:
    """JWT_SECRET 환경변수를 가져오거나 dev 환경에서는 고정 시크릿 사용"""
    secret = os.getenv("JWT_SECRET", "")
    app_env = os.getenv("AI_LOTTO_APP_ENV", "dev")

    if secret:
        return secret

    if app_env == "prod":
        print("ERROR: JWT_SECRET 환경변수가 설정되지 않았습니다.", file=sys.stderr)
        print("프로덕션 환경에서는 반드시 JWT_SECRET을 설정해야 합니다.", file=sys.stderr)
        print("예: export JWT_SECRET=$(openssl rand -hex 32)", file=sys.stderr)
        sys.exit(1)

    # dev 환경에서는 고정 시크릿 사용 (서버 재시작해도 세션 유지)
    return "dev_secret_key_do_not_use_in_production_12345678"


def validate_production_settings() -> None:
    """프로덕션 환경에서 필수 설정 검증"""
    app_env = os.getenv("AI_LOTTO_APP_ENV", "dev")
    if app_env != "prod":
        return

    errors = []

    # DB URL 검증 (프로덕션에서 SQLite 사용 경고)
    db_url = os.getenv("AI_LOTTO_DB_URL", "")
    if not db_url or db_url.startswith("sqlite"):
        errors.append("WARNING: 프로덕션 환경에서 SQLite 사용은 권장되지 않습니다. PostgreSQL을 사용하세요.")

    # FRONTEND_ORIGINS 검증
    origins = os.getenv("FRONTEND_ORIGINS", "")
    if not origins or "localhost" in origins:
        errors.append("WARNING: FRONTEND_ORIGINS에 localhost가 포함되어 있습니다. 프로덕션 도메인으로 설정하세요.")

    for error in errors:
        print(error, file=sys.stderr)


@dataclass(frozen=True)
class Settings:
    _DEFAULT_DB_URL: str = "sqlite:///./data/ai_lotto.db"
    DB_URL: str = os.getenv("AI_LOTTO_DB_URL", _DEFAULT_DB_URL)
    APP_ENV: str = os.getenv("AI_LOTTO_APP_ENV", "dev")

    # OAuth 설정
    NAVER_CLIENT_ID: str = os.getenv("NAVER_CLIENT_ID", "")
    NAVER_CLIENT_SECRET: str = os.getenv("NAVER_CLIENT_SECRET", "")
    KAKAO_CLIENT_ID: str = os.getenv("KAKAO_CLIENT_ID", "")
    KAKAO_CLIENT_SECRET: str = os.getenv("KAKAO_CLIENT_SECRET", "")
    OAUTH_REDIRECT_BASE: str = os.getenv("OAUTH_REDIRECT_BASE", "http://localhost:8000")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # SMS 설정
    SMS_PROVIDER: str = os.getenv("AI_LOTTO_SMS_PROVIDER", "stub")
    SMS_API_KEY: str = os.getenv("AI_LOTTO_SMS_API_KEY", "")
    SMS_API_SECRET: str = os.getenv("AI_LOTTO_SMS_API_SECRET", "")
    SMS_SENDER_ID: str = os.getenv("AI_LOTTO_SMS_SENDER_ID", "")

    # 이메일 설정 (SendGrid)
    EMAIL_PROVIDER: str = os.getenv("AI_LOTTO_EMAIL_PROVIDER", "stub")
    SENDGRID_API_KEY: str = os.getenv("SENDGRID_API_KEY", "")
    EMAIL_FROM_ADDRESS: str = os.getenv("AI_LOTTO_EMAIL_FROM", "noreply@ai-lotto.com")
    EMAIL_FROM_NAME: str = os.getenv("AI_LOTTO_EMAIL_FROM_NAME", "팡팡로또")

    # 비밀번호 재설정
    PASSWORD_RESET_TOKEN_TTL_SECONDS: int = int(os.getenv("AI_LOTTO_PASSWORD_RESET_TTL", "1800"))  # 30분

    # 로깅
    LOG_PATH: str = os.getenv("AI_LOTTO_LOG_PATH", "logs/ai_lotto.log")

    # JWT 설정
    JWT_SECRET: str = field(default_factory=_get_jwt_secret)
    JWT_TTL_SECONDS: int = int(os.getenv("AI_LOTTO_JWT_TTL_SECONDS", "21600"))
    JWT_REFRESH_TTL_SECONDS: int = int(os.getenv("AI_LOTTO_JWT_REFRESH_TTL_SECONDS", "1209600"))

    # 쿠키 설정
    COOKIE_SECURE: str = os.getenv("AI_LOTTO_COOKIE_SECURE", "")
    COOKIE_SAMESITE: str = os.getenv("AI_LOTTO_COOKIE_SAMESITE", "")

    # CORS
    FRONTEND_ORIGINS: str = os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")

    # 관리자
    ADMIN_IDENTIFIERS: str = os.getenv("AI_LOTTO_ADMIN_IDENTIFIERS", "")


settings = Settings()


def resolve_db_url(db_url: str) -> str:
    if not db_url.startswith("sqlite:///./"):
        return db_url
    repo_root = Path(__file__).resolve().parents[3]
    relative_path = db_url.replace("sqlite:///./", "")
    absolute_path = repo_root / relative_path
    return f"sqlite:///{absolute_path}"


def resolve_log_path(log_path: str) -> str:
    path = Path(log_path)
    if path.is_absolute():
        return str(path)
    repo_root = Path(__file__).resolve().parents[3]
    return str(repo_root / path)


def get_frontend_origins() -> list[str]:
    return [origin.strip() for origin in settings.FRONTEND_ORIGINS.split(",") if origin.strip()]


def _parse_bool(value: str, default: bool = False) -> bool:
    if value == "":
        return default
    return value.lower() in {"1", "true", "yes", "y", "on"}


def get_cookie_settings() -> tuple[bool, str]:
    secure_default = settings.APP_ENV == "prod"
    secure = _parse_bool(settings.COOKIE_SECURE, secure_default)
    samesite = settings.COOKIE_SAMESITE or ("strict" if secure else "lax")
    return secure, samesite


def get_admin_identifiers() -> list[str]:
    return [value.strip() for value in settings.ADMIN_IDENTIFIERS.split(",") if value.strip()]
