from typing import Optional, Tuple
from datetime import datetime, timedelta
import secrets
import re
import random

from fastapi import APIRouter, Depends, HTTPException, Response, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.config import get_cookie_settings, settings
from app.db.session import get_db
from app.db.models import User, PasswordResetToken, Payment, Subscription, SmsVerification
from app.services.auth import hash_password, verify_password, hash_token, verify_token
from app.services.jwt import decode_jwt, encode_jwt
from app.services.sms import get_sms_client, SmsSendRequest
from app.rate_limit import limiter
import logging

logger = logging.getLogger("auth")

router = APIRouter(prefix="/api/auth", tags=["auth"])

# 더미 해시값 (타이밍 공격 방지용)
_DUMMY_HASH = hash_password("dummy_password_for_timing_attack_prevention")

# 이메일 형식 검증 정규식
_EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')


def _is_email(value: str) -> bool:
    """이메일 형식인지 확인"""
    return bool(_EMAIL_REGEX.match(value))


class SignupRequest(BaseModel):
    identifier: str = Field(..., min_length=3, max_length=200)
    password: str = Field(..., min_length=6, max_length=200)


class LoginRequest(BaseModel):
    identifier: str = Field(..., min_length=3, max_length=200)
    password: str = Field(..., min_length=6, max_length=200)


class AuthResponse(BaseModel):
    user_id: int
    identifier: Optional[str] = None  # 소셜 로그인 사용자는 None일 수 있음
    token: Optional[str] = None
    is_admin: bool = False
    name: Optional[str] = None  # 소셜 로그인 사용자 이름
    phone_number: Optional[str] = None
    tier: str = "FREE"
    created_at: Optional[str] = None  # 가입일


ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"


def _create_tokens(user_id: int, identifier: str) -> Tuple[str, str]:
    """액세스 토큰과 리프레시 토큰 생성"""
    access_token = encode_jwt(
        {"sub": user_id, "identifier": identifier, "typ": "access"},
        settings.JWT_SECRET,
        settings.JWT_TTL_SECONDS,
    )
    refresh_token = encode_jwt(
        {"sub": user_id, "identifier": identifier, "typ": "refresh"},
        settings.JWT_SECRET,
        settings.JWT_REFRESH_TTL_SECONDS,
    )
    return access_token, refresh_token


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """인증 쿠키 설정"""
    secure, samesite = get_cookie_settings()
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        httponly=True,
        samesite=samesite,
        secure=secure,
        max_age=settings.JWT_TTL_SECONDS,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        httponly=True,
        samesite=samesite,
        secure=secure,
        max_age=settings.JWT_REFRESH_TTL_SECONDS,
        path="/",
    )


@router.post("/signup", response_model=AuthResponse)
@limiter.limit("5/minute")
def signup(request: Request, payload: SignupRequest, response: Response, db: Session = Depends(get_db)):
    try:
        identifier = payload.identifier.strip()
        logger.info(f"회원가입 시도: {identifier[:3]}***")

        # 기존 계정 확인 (identifier 또는 email로)
        existing = db.query(User).filter(
            (User.identifier == identifier) | (User.email == identifier)
        ).first()
        if existing:
            logger.warning(f"회원가입 실패 - 이미 존재하는 계정: {identifier[:3]}***")
            raise HTTPException(status_code=400, detail="이미 등록된 계정입니다.")

        # 이메일 형식이면 email 필드에도 저장 (소셜 로그인 통합용)
        email = identifier if _is_email(identifier) else None

        user = User(
            identifier=identifier,
            email=email,
            password_hash=hash_password(payload.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        access_token, refresh_token = _create_tokens(user.id, user.identifier)
        user.refresh_token_hash = hash_token(refresh_token)
        user.refresh_token_updated_at = datetime.utcnow()
        db.add(user)
        db.commit()

        _set_auth_cookies(response, access_token, refresh_token)
        logger.info(f"회원가입 성공: user_id={user.id}")
        return AuthResponse(user_id=user.id, identifier=user.identifier, token=access_token, is_admin=user.is_admin)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"회원가입 오류: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"회원가입 처리 중 오류가 발생했습니다: {str(e)}")


@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.identifier == payload.identifier).first()

    # 타이밍 공격 방지: 사용자가 없어도 비밀번호 검증 시간 동일하게 유지
    password_hash = user.password_hash if user and user.password_hash else _DUMMY_HASH
    is_valid = verify_password(payload.password, password_hash)

    if not user or not is_valid:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 일치하지 않습니다.")

    access_token, refresh_token = _create_tokens(user.id, user.identifier)
    user.refresh_token_hash = hash_token(refresh_token)
    user.refresh_token_updated_at = datetime.utcnow()
    db.add(user)
    db.commit()

    _set_auth_cookies(response, access_token, refresh_token)
    return AuthResponse(user_id=user.id, identifier=user.identifier, token=access_token, is_admin=user.is_admin)


@router.get("/me", response_model=AuthResponse)
def me(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    payload = decode_jwt(token, settings.JWT_SECRET)
    if not payload:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    if payload.get("typ") != "access":
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    # 구독 타입을 대문자로 변환
    tier = (user.subscription_type or "free").upper()
    created_at_str = user.created_at.isoformat() if user.created_at else None

    return AuthResponse(
        user_id=user.id,
        identifier=user.identifier,
        token=None,
        is_admin=user.is_admin,
        name=user.name,
        phone_number=user.phone_number,
        tier=tier,
        created_at=created_at_str,
    )


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(ACCESS_COOKIE)
    if token:
        payload = decode_jwt(token, settings.JWT_SECRET)
        if payload and payload.get("typ") == "access":
            user = db.query(User).filter(User.id == payload.get("sub")).first()
            if user:
                user.refresh_token_hash = None
                user.refresh_token_updated_at = None
                db.add(user)
                db.commit()
    secure, samesite = get_cookie_settings()
    response.delete_cookie(ACCESS_COOKIE, path="/", samesite=samesite, secure=secure)
    response.delete_cookie(REFRESH_COOKIE, path="/", samesite=samesite, secure=secure)
    return {"ok": True}


@router.post("/refresh", response_model=AuthResponse)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    payload = decode_jwt(token, settings.JWT_SECRET)
    if not payload or payload.get("typ") != "refresh":
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    if not verify_token(token, user.refresh_token_hash):
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    # 소셜 로그인 사용자는 identifier가 없을 수 있음
    identifier = user.identifier or f"user_{user.id}"

    access_token, refresh_token = _create_tokens(user.id, identifier)
    user.refresh_token_hash = hash_token(refresh_token)
    user.refresh_token_updated_at = datetime.utcnow()
    db.add(user)
    db.commit()

    _set_auth_cookies(response, access_token, refresh_token)
    return AuthResponse(user_id=user.id, identifier=identifier, token=access_token, is_admin=user.is_admin)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    payload = decode_jwt(token, settings.JWT_SECRET)
    if not payload:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    if payload.get("typ") != "access":
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """관리자 권한이 필요한 엔드포인트에서 사용하는 의존성"""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    return user


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 비밀번호 찾기/재설정 API (SMS 인증)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class SendSmsCodeRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=20)

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        # 숫자만 추출
        digits = re.sub(r'\D', '', v)
        if len(digits) < 10 or len(digits) > 11:
            raise ValueError('올바른 휴대폰 번호를 입력해주세요.')
        return digits


class SendSmsCodeResponse(BaseModel):
    message: str
    sent: bool = False


class VerifySmsCodeRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=20)
    code: str = Field(..., min_length=6, max_length=6)

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return re.sub(r'\D', '', v)


class VerifySmsCodeResponse(BaseModel):
    verified: bool
    reset_token: Optional[str] = None  # 인증 성공 시 비밀번호 재설정용 토큰
    message: str


class ResetPasswordRequest(BaseModel):
    reset_token: str = Field(..., min_length=32, max_length=128)
    new_password: str = Field(..., min_length=6, max_length=200)

    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError('비밀번호는 최소 6자 이상이어야 합니다.')
        return v


class ResetPasswordResponse(BaseModel):
    message: str
    success: bool


class VerifyResetTokenResponse(BaseModel):
    valid: bool
    identifier: Optional[str] = None
    message: Optional[str] = None


def _generate_sms_code() -> str:
    """6자리 인증코드 생성"""
    return str(random.randint(100000, 999999))


def _generate_reset_token() -> str:
    """보안 토큰 생성 (URL-safe, 64자)"""
    return secrets.token_urlsafe(48)


def _invalidate_existing_tokens(db: Session, user_id: int) -> None:
    """기존 미사용 토큰 무효화"""
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user_id,
        PasswordResetToken.used_at.is_(None),
    ).delete(synchronize_session=False)


@router.post("/send-sms-code", response_model=SendSmsCodeResponse)
@limiter.limit("3/minute")  # 무차별 대입 방지
def send_sms_code(request: Request, payload: SendSmsCodeRequest, db: Session = Depends(get_db)):
    """
    비밀번호 찾기용 SMS 인증코드 발송
    - 휴대폰 번호로 사용자 조회
    - 6자리 인증코드 SMS 발송
    """
    phone = payload.phone

    # 사용자 조회 (휴대폰 번호 또는 identifier로)
    user = db.query(User).filter(
        (User.phone_number == phone) | (User.identifier == phone)
    ).first()

    # 사용자가 없는 경우
    if not user:
        return SendSmsCodeResponse(
            message="등록되지 않은 휴대폰 번호입니다.",
            sent=False,
        )

    # 소셜 로그인 사용자 (비밀번호 없음)
    if not user.password_hash:
        return SendSmsCodeResponse(
            message="소셜 로그인(네이버/카카오)으로 가입한 계정입니다. 해당 서비스에서 비밀번호를 변경해주세요.",
            sent=False,
        )

    # 기존 미인증 코드 삭제
    db.query(SmsVerification).filter(
        SmsVerification.phone == phone,
        SmsVerification.purpose == "password_reset",
        SmsVerification.verified_at.is_(None),
    ).delete(synchronize_session=False)
    db.flush()

    # 새 인증코드 생성
    code = _generate_sms_code()
    expires_at = datetime.utcnow() + timedelta(minutes=5)  # 5분 유효

    verification = SmsVerification(
        phone=phone,
        code=code,
        purpose="password_reset",
        expires_at=expires_at,
    )
    db.add(verification)
    db.commit()

    # SMS 발송
    sms_client = get_sms_client()
    message = f"[팡팡로또] 인증코드: {code}\n5분 내에 입력해주세요."

    result = sms_client.send(SmsSendRequest(to=phone, content=message))

    return SendSmsCodeResponse(
        message="인증코드가 발송되었습니다.",
        sent=result.success,
    )


@router.post("/verify-sms-code", response_model=VerifySmsCodeResponse)
@limiter.limit("10/minute")
def verify_sms_code(request: Request, payload: VerifySmsCodeRequest, db: Session = Depends(get_db)):
    """
    SMS 인증코드 확인
    - 인증 성공 시 비밀번호 재설정용 토큰 발급
    """
    phone = payload.phone

    # 인증코드 조회
    verification = db.query(SmsVerification).filter(
        SmsVerification.phone == phone,
        SmsVerification.purpose == "password_reset",
        SmsVerification.verified_at.is_(None),
    ).order_by(SmsVerification.created_at.desc()).first()

    if not verification:
        return VerifySmsCodeResponse(
            verified=False,
            message="인증코드를 먼저 요청해주세요.",
        )

    # 만료 확인
    if verification.expires_at < datetime.utcnow():
        return VerifySmsCodeResponse(
            verified=False,
            message="인증코드가 만료되었습니다. 다시 요청해주세요.",
        )

    # 시도 횟수 확인 (5회 제한)
    if verification.attempts >= 5:
        return VerifySmsCodeResponse(
            verified=False,
            message="인증 시도 횟수를 초과했습니다. 다시 요청해주세요.",
        )

    # 시도 횟수 증가
    verification.attempts += 1
    db.add(verification)

    # 코드 확인
    if verification.code != payload.code:
        db.commit()
        remaining = 5 - verification.attempts
        return VerifySmsCodeResponse(
            verified=False,
            message=f"인증코드가 일치하지 않습니다. ({remaining}회 남음)",
        )

    # 인증 성공
    verification.verified_at = datetime.utcnow()
    db.add(verification)

    # 사용자 조회
    user = db.query(User).filter(
        (User.phone_number == phone) | (User.identifier == phone)
    ).first()

    if not user:
        db.commit()
        return VerifySmsCodeResponse(
            verified=False,
            message="등록된 사용자를 찾을 수 없습니다.",
        )

    # 비밀번호 재설정 토큰 생성
    _invalidate_existing_tokens(db, user.id)
    db.flush()

    raw_token = _generate_reset_token()
    token_hash_value = hash_token(raw_token)
    expires_at = datetime.utcnow() + timedelta(minutes=10)  # 10분 유효

    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash_value,
        expires_at=expires_at,
    )
    db.add(reset_token)
    db.commit()

    return VerifySmsCodeResponse(
        verified=True,
        reset_token=raw_token,
        message="인증이 완료되었습니다.",
    )


@router.get("/verify-reset-token", response_model=VerifyResetTokenResponse)
def verify_reset_token(token: str, db: Session = Depends(get_db)):
    """
    비밀번호 재설정 토큰 유효성 검증
    - 프론트엔드에서 재설정 페이지 진입 시 호출
    """
    if not token or len(token) < 32:
        return VerifyResetTokenResponse(valid=False, message="유효하지 않은 링크입니다.")

    token_hash_value = hash_token(token)

    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash_value,
    ).first()

    if not reset_token:
        return VerifyResetTokenResponse(valid=False, message="유효하지 않은 링크입니다.")

    # 이미 사용된 토큰
    if reset_token.used_at:
        return VerifyResetTokenResponse(valid=False, message="이미 사용된 링크입니다. 비밀번호 찾기를 다시 시도해주세요.")

    # 만료된 토큰
    if reset_token.expires_at < datetime.utcnow():
        return VerifyResetTokenResponse(valid=False, message="링크가 만료되었습니다. 비밀번호 찾기를 다시 시도해주세요.")

    # 사용자 조회
    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user:
        return VerifyResetTokenResponse(valid=False, message="사용자를 찾을 수 없습니다.")

    # 식별자 마스킹 (보안)
    identifier = user.identifier or user.email or ""
    if "@" in identifier:
        parts = identifier.split("@")
        local_part = parts[0]
        if len(local_part) <= 2:
            masked = local_part[0] + "***@" + parts[1] if local_part else "***@" + parts[1]
        else:
            masked = local_part[:2] + "***@" + parts[1]
    else:
        if len(identifier) <= 3:
            masked = identifier[0] + "***" if identifier else "***"
        else:
            masked = identifier[:3] + "***"

    return VerifyResetTokenResponse(valid=True, identifier=masked)


@router.post("/reset-password", response_model=ResetPasswordResponse)
@limiter.limit("5/minute")  # 무차별 대입 방지
def reset_password(request: Request, payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    비밀번호 재설정 실행
    - 토큰 검증 후 새 비밀번호로 변경
    """
    token_hash_value = hash_token(payload.reset_token)

    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash_value,
    ).first()

    if not reset_token:
        raise HTTPException(status_code=400, detail="유효하지 않은 링크입니다.")

    # 이미 사용된 토큰
    if reset_token.used_at:
        raise HTTPException(status_code=400, detail="이미 사용된 링크입니다. 비밀번호 찾기를 다시 시도해주세요.")

    # 만료된 토큰
    if reset_token.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="링크가 만료되었습니다. 비밀번호 찾기를 다시 시도해주세요.")

    # 사용자 조회
    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="사용자를 찾을 수 없습니다.")

    # 비밀번호 변경
    user.password_hash = hash_password(payload.new_password)
    user.updated_at = datetime.utcnow()

    # 토큰 사용 처리
    reset_token.used_at = datetime.utcnow()

    # 보안: 기존 리프레시 토큰 무효화 (다른 기기 로그아웃)
    user.refresh_token_hash = None
    user.refresh_token_updated_at = None

    db.add(user)
    db.add(reset_token)
    db.commit()

    return ResetPasswordResponse(
        message="비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.",
        success=True,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 플랜 업데이트 API (결제 시뮬레이션용)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class UpdatePlanRequest(BaseModel):
    plan_type: str = Field(..., description="free, basic, premium, vip")
    payment_method: str = Field(default="card", description="card, kakao, naver")
    duration_days: int = Field(default=30, ge=1, le=365)

    @field_validator('plan_type')
    @classmethod
    def validate_plan_type(cls, v: str) -> str:
        allowed = ['free', 'basic', 'premium', 'vip']
        if v.lower() not in allowed:
            raise ValueError(f"플랜은 {', '.join(allowed)} 중 하나여야 합니다.")
        return v.lower()


class UpdatePlanResponse(BaseModel):
    message: str
    plan_type: str
    success: bool
    subscription_id: Optional[int] = None
    expires_at: Optional[datetime] = None


# 플랜별 가격 설정
PLAN_CONFIG = {
    "free": {"price": 0, "line_count": 1, "name": "FREE"},
    "basic": {"price": 4900, "line_count": 5, "name": "BASIC"},
    "premium": {"price": 9900, "line_count": 10, "name": "PREMIUM"},
    "vip": {"price": 13900, "line_count": 20, "name": "VIP"},
}


@router.post("/update-plan", response_model=UpdatePlanResponse)
def update_user_plan(
    payload: UpdatePlanRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    사용자 플랜 업데이트 (결제 완료 시 호출)
    - User.subscription_type 업데이트
    - Payment 기록 생성
    - Subscription 생성 및 자동 활성화
    """
    plan_config = PLAN_CONFIG.get(payload.plan_type)
    if not plan_config:
        raise HTTPException(status_code=400, detail="유효하지 않은 플랜입니다.")

    now = datetime.utcnow()
    expires_at = now + timedelta(days=payload.duration_days)

    try:
        # 1. User subscription_type 업데이트
        user.subscription_type = payload.plan_type
        user.updated_at = now

        subscription_id = None

        # 유료 플랜인 경우 Payment, Subscription 기록 생성
        if payload.plan_type != 'free':
            # 2. Payment 기록 생성
            order_id = f"ORD-{user.id}-{int(now.timestamp())}"
            payment = Payment(
                user_id=user.id,
                order_id=order_id,
                amount=plan_config["price"],
                status="completed",
                payment_method=payload.payment_method,
                product_name=f"{plan_config['name']} 플랜 ({payload.duration_days}일)",
                product_type=payload.plan_type,
                duration_days=payload.duration_days,
                pg_provider=payload.payment_method,
                paid_at=now,
            )
            db.add(payment)
            db.flush()  # payment.id 얻기 위해

            # 3. Subscription 생성 및 자동 활성화
            subscription = Subscription(
                user_id=user.id,
                payment_id=payment.id,
                name=user.name or user.identifier,
                phone=user.phone_number or "",
                plan_type=payload.plan_type,
                line_count=plan_config["line_count"],
                status="active",
                payment_method=payload.payment_method,
                payment_status="confirmed",
                amount=plan_config["price"],
                auto_approve=True,
                approved_by="system",
                approved_at=now,
                started_at=now,
                expires_at=expires_at,
            )
            db.add(subscription)
            db.flush()
            subscription_id = subscription.id

        db.commit()
        db.refresh(user)

    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"플랜 업데이트 실패: {str(exc)}")

    return UpdatePlanResponse(
        message=f"{plan_config['name']} 플랜으로 변경되었습니다.",
        plan_type=payload.plan_type.upper(),
        success=True,
        subscription_id=subscription_id,
        expires_at=expires_at if payload.plan_type != 'free' else None,
    )
