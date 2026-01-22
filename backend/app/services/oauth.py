"""OAuth 소셜 로그인 서비스"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional, TypedDict
from urllib.parse import urlencode

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import User, SocialAccount, OAuthState
from app.db.session import SessionLocal

logger = logging.getLogger("oauth")


class OAuthProfile(TypedDict, total=False):
    """OAuth 프로필 데이터"""
    provider_user_id: str
    email: Optional[str]
    name: Optional[str]
    phone_number: Optional[str]
    profile_image_url: Optional[str]


class OAuthError(Exception):
    """OAuth 관련 에러"""
    def __init__(self, message: str, code: str = "oauth_error"):
        self.message = message
        self.code = code
        super().__init__(message)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CSRF State 관리 (DB 기반 - 멀티 인스턴스 지원)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def generate_oauth_state() -> str:
    """CSRF 방지용 state 생성 (DB 저장)"""
    state = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=5)

    db = SessionLocal()
    try:
        # 만료된 state 정리
        db.query(OAuthState).filter(OAuthState.expires_at < datetime.utcnow()).delete()

        # 새 state 저장
        oauth_state = OAuthState(state=state, expires_at=expires_at)
        db.add(oauth_state)
        db.commit()
        logger.debug(f"OAuth state 생성 성공: {state[:10]}...")
        return state
    except Exception as e:
        logger.error(f"OAuth state 저장 실패: {e}")
        db.rollback()
        raise OAuthError("OAuth 인증을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.", "state_error")
    finally:
        db.close()


def verify_oauth_state(state: str) -> bool:
    """state 검증 (5분 유효, DB에서 조회 후 삭제)"""
    if not state:
        return False

    db = SessionLocal()
    try:
        oauth_state = db.query(OAuthState).filter(
            OAuthState.state == state,
            OAuthState.expires_at > datetime.utcnow()
        ).first()

        if not oauth_state:
            logger.warning(f"OAuth state 검증 실패: state={state[:10]}...")
            return False

        # 사용한 state 삭제 (일회용)
        db.delete(oauth_state)
        db.commit()
        return True
    except Exception as e:
        logger.error(f"OAuth state 검증 오류: {e}")
        db.rollback()
        return False
    finally:
        db.close()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 네이버 OAuth
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def get_naver_authorize_url(state: str) -> str:
    """네이버 로그인 URL 생성"""
    if not settings.NAVER_CLIENT_ID:
        raise OAuthError("네이버 OAuth 설정이 없습니다.", "config_error")

    params = {
        "response_type": "code",
        "client_id": settings.NAVER_CLIENT_ID,
        "redirect_uri": f"{settings.OAUTH_REDIRECT_BASE}/auth/naver/callback",
        "state": state,
    }
    return f"https://nid.naver.com/oauth2.0/authorize?{urlencode(params)}"


async def exchange_naver_token(code: str, state: str) -> str:
    """네이버 authorization code → access token 교환"""
    if not settings.NAVER_CLIENT_ID or not settings.NAVER_CLIENT_SECRET:
        raise OAuthError("네이버 OAuth 설정이 없습니다.", "config_error")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://nid.naver.com/oauth2.0/token",
                data={
                    "grant_type": "authorization_code",
                    "client_id": settings.NAVER_CLIENT_ID,
                    "client_secret": settings.NAVER_CLIENT_SECRET,
                    "code": code,
                    "state": state,
                },
            )

            if response.status_code != 200:
                logger.error("Naver token exchange failed: %s", response.text)
                raise OAuthError("네이버 토큰 교환 실패", "token_error")

            data = response.json()
            if "access_token" not in data:
                logger.error("Naver token response invalid: %s", data)
                raise OAuthError("네이버 토큰 응답 오류", "token_error")

            return data["access_token"]
    except httpx.TimeoutException:
        logger.error("Naver token exchange timeout")
        raise OAuthError("네이버 서버 응답 시간 초과", "timeout_error")
    except httpx.RequestError as e:
        logger.error("Naver token exchange network error: %s", e)
        raise OAuthError("네이버 서버 연결 실패", "network_error")


async def fetch_naver_profile(access_token: str) -> OAuthProfile:
    """네이버 프로필 조회"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://openapi.naver.com/v1/nid/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )

            if response.status_code != 200:
                logger.error("Naver profile fetch failed: %s", response.text)
                raise OAuthError("네이버 프로필 조회 실패", "profile_error")

            data = response.json()
            if data.get("resultcode") != "00":
                logger.error("Naver profile error: %s", data)
                raise OAuthError("네이버 프로필 오류", "profile_error")

            profile = data.get("response", {})

            # 전화번호 정규화 (010-1234-5678 → 01012345678)
            phone = profile.get("mobile", "")
            if phone:
                phone = "".join(c for c in phone if c.isdigit())

            # 이름 fallback 처리
            name = (
                profile.get("name") or
                profile.get("nickname") or
                f"네이버{profile.get('id', '')[-4:]}"  # 네이버ID 마지막 4자리
            )

            return OAuthProfile(
                provider_user_id=profile.get("id", ""),
                email=profile.get("email"),
                name=name,
                phone_number=phone or None,
                profile_image_url=profile.get("profile_image"),
            )
    except httpx.TimeoutException:
        logger.error("Naver profile fetch timeout")
        raise OAuthError("네이버 서버 응답 시간 초과", "timeout_error")
    except httpx.RequestError as e:
        logger.error("Naver profile fetch network error: %s", e)
        raise OAuthError("네이버 서버 연결 실패", "network_error")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 카카오 OAuth
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def get_kakao_authorize_url(state: str) -> str:
    """카카오 로그인 URL 생성"""
    if not settings.KAKAO_CLIENT_ID:
        raise OAuthError("카카오 OAuth 설정이 없습니다.", "config_error")

    params = {
        "response_type": "code",
        "client_id": settings.KAKAO_CLIENT_ID,
        "redirect_uri": f"{settings.OAUTH_REDIRECT_BASE}/auth/kakao/callback",
        "state": state,
    }
    return f"https://kauth.kakao.com/oauth/authorize?{urlencode(params)}"


async def exchange_kakao_token(code: str) -> str:
    """카카오 authorization code → access token 교환"""
    if not settings.KAKAO_CLIENT_ID:
        raise OAuthError("카카오 OAuth 설정이 없습니다.", "config_error")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            data = {
                "grant_type": "authorization_code",
                "client_id": settings.KAKAO_CLIENT_ID,
                "redirect_uri": f"{settings.OAUTH_REDIRECT_BASE}/auth/kakao/callback",
                "code": code,
            }
            # client_secret은 선택 (카카오 앱 설정에서 ON 했을 때만 필요)
            if settings.KAKAO_CLIENT_SECRET:
                data["client_secret"] = settings.KAKAO_CLIENT_SECRET

            response = await client.post(
                "https://kauth.kakao.com/oauth/token",
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            if response.status_code != 200:
                logger.error("Kakao token exchange failed: %s", response.text)
                raise OAuthError("카카오 토큰 교환 실패", "token_error")

            result = response.json()
            if "access_token" not in result:
                logger.error("Kakao token response invalid: %s", result)
                raise OAuthError("카카오 토큰 응답 오류", "token_error")

            return result["access_token"]
    except httpx.TimeoutException:
        logger.error("Kakao token exchange timeout")
        raise OAuthError("카카오 서버 응답 시간 초과", "timeout_error")
    except httpx.RequestError as e:
        logger.error("Kakao token exchange network error: %s", e)
        raise OAuthError("카카오 서버 연결 실패", "network_error")


async def fetch_kakao_profile(access_token: str) -> OAuthProfile:
    """카카오 프로필 조회"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://kapi.kakao.com/v2/user/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )

            if response.status_code != 200:
                logger.error("Kakao profile fetch failed: %s", response.text)
                raise OAuthError("카카오 프로필 조회 실패", "profile_error")

            data = response.json()

            # 디버깅: 카카오에서 받은 전체 데이터 로깅
            logger.info("Kakao raw response keys: %s", list(data.keys()))
            kakao_account = data.get("kakao_account", {})
            logger.info("Kakao account keys: %s", list(kakao_account.keys()))
            profile = kakao_account.get("profile", {})
            logger.info("Kakao profile keys: %s", list(profile.keys()))

            # 이름 필드 확인 (여러 가능한 필드에서 찾기)
            # 카카오는 앱 권한 설정에 따라 nickname이 없을 수 있음
            name = (
                profile.get("nickname") or
                kakao_account.get("name") or
                data.get("properties", {}).get("nickname") or
                f"카카오{str(data.get('id', ''))[-4:]}"  # 카카오ID 마지막 4자리
            )

            # 전화번호 정규화 (+82 10-1234-5678 → 01012345678)
            phone = kakao_account.get("phone_number", "")
            if phone:
                phone = "".join(c for c in phone if c.isdigit())
                if phone.startswith("82"):
                    phone = "0" + phone[2:]

            # 이메일 여러 위치에서 찾기
            email = kakao_account.get("email")

            logger.info(
                "Kakao profile parsed: id=%s, name=%s, email=%s, phone=%s",
                data.get("id"), name, email, phone[:4] + "****" if phone else None
            )

            return OAuthProfile(
                provider_user_id=str(data.get("id", "")),
                email=email,
                name=name,
                phone_number=phone or None,
                profile_image_url=profile.get("profile_image_url"),
            )
    except httpx.TimeoutException:
        logger.error("Kakao profile fetch timeout")
        raise OAuthError("카카오 서버 응답 시간 초과", "timeout_error")
    except httpx.RequestError as e:
        logger.error("Kakao profile fetch network error: %s", e)
        raise OAuthError("카카오 서버 연결 실패", "network_error")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 공통 로그인 처리
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _find_existing_user_by_profile(db: Session, profile: OAuthProfile) -> Optional[User]:
    """
    이메일 또는 전화번호로 기존 사용자 검색 (계정 통합용)

    동일한 이메일이나 전화번호를 가진 기존 사용자를 찾아
    새로운 소셜 계정을 기존 계정에 연결할 수 있도록 함

    검색 우선순위:
    1. email 필드
    2. identifier 필드 (일반 회원가입 이메일)
    3. phone_number 필드
    """
    email = profile.get("email")
    phone_number = profile.get("phone_number")

    if not email and not phone_number:
        return None

    # 이메일로 검색 (email 필드 또는 identifier 필드)
    if email:
        user = db.query(User).filter(
            (User.email == email) | (User.identifier == email)
        ).first()
        if user:
            logger.info("Found existing user by email: user_id=%s email=%s", user.id, email)
            return user

    # 전화번호로 검색
    if phone_number:
        user = db.query(User).filter(User.phone_number == phone_number).first()
        if user:
            logger.info("Found existing user by phone: user_id=%s phone=%s", user.id, phone_number)
            return user

    return None


def social_login(
    db: Session,
    provider: str,
    profile: OAuthProfile,
    access_token: Optional[str] = None,
) -> tuple:
    """
    소셜 로그인 공통 처리 (계정 통합 지원)

    1. social_accounts에서 provider + provider_user_id로 검색
    2. 있으면 → 해당 user 반환
    3. 없으면 → 이메일/전화번호로 기존 사용자 검색 (계정 통합)
    4. 기존 사용자 있으면 → 해당 사용자에 새 소셜 계정 연결
    5. 없으면 → 새 user 생성 + social_accounts 연결

    Args:
        db: DB 세션
        provider: NAVER 또는 KAKAO
        profile: OAuth 프로필 데이터
        access_token: OAuth access token (선택)

    Returns:
        tuple: (User 객체, 신규 가입 여부 bool)
    """
    provider_user_id = profile["provider_user_id"]
    if not provider_user_id:
        raise OAuthError("프로필에 사용자 ID가 없습니다.", "profile_error")

    # 1. 기존 소셜 계정 검색
    social_account = db.query(SocialAccount).filter(
        SocialAccount.provider == provider,
        SocialAccount.provider_user_id == provider_user_id,
    ).first()

    if social_account:
        # 기존 사용자 로그인
        user = db.query(User).filter(User.id == social_account.user_id).first()
        if not user:
            # 데이터 정합성 오류 (social_account는 있는데 user가 없음)
            logger.error("Orphan social_account: id=%s", social_account.id)
            db.delete(social_account)
            db.commit()
            raise OAuthError("계정 연동 오류가 발생했습니다. 다시 시도해주세요.", "data_error")

        # 마지막 로그인 시간 업데이트
        user.last_login_at = datetime.utcnow()

        # 프로필 정보 업데이트 (선택)
        if profile.get("name") and not user.name:
            user.name = profile["name"]
        if profile.get("profile_image_url") and not user.profile_image_url:
            user.profile_image_url = profile["profile_image_url"]

        # access_token 업데이트 (필요시)
        if access_token:
            social_account.access_token = access_token

        db.commit()
        logger.info("Social login: provider=%s user_id=%s", provider, user.id)
        return user, False  # 기존 사용자

    # 2. 이메일/전화번호로 기존 사용자 검색 (계정 통합)
    existing_user = _find_existing_user_by_profile(db, profile)

    if existing_user:
        # 기존 사용자에 새 소셜 계정 연결 (계정 통합)
        new_social_account = SocialAccount(
            user_id=existing_user.id,
            provider=provider,
            provider_user_id=provider_user_id,
            access_token=access_token,
        )
        db.add(new_social_account)

        # 프로필 정보 업데이트
        existing_user.last_login_at = datetime.utcnow()
        if profile.get("name") and not existing_user.name:
            existing_user.name = profile["name"]
        if profile.get("profile_image_url") and not existing_user.profile_image_url:
            existing_user.profile_image_url = profile["profile_image_url"]
        if profile.get("phone_number") and not existing_user.phone_number:
            existing_user.phone_number = profile["phone_number"]
        if profile.get("email") and not existing_user.email:
            existing_user.email = profile["email"]

        db.commit()
        logger.info(
            "Social account linked to existing user: provider=%s user_id=%s (unified by email/phone)",
            provider, existing_user.id
        )
        return existing_user, False  # 기존 사용자 (계정 통합)

    # 3. 새 사용자 생성
    user = User(
        email=profile.get("email"),
        name=profile.get("name"),
        phone_number=profile.get("phone_number"),
        profile_image_url=profile.get("profile_image_url"),
        last_login_at=datetime.utcnow(),
        is_active=True,
        subscription_type="free",
    )
    db.add(user)
    db.flush()  # user.id 확보

    # 4. 소셜 계정 연결
    social_account = SocialAccount(
        user_id=user.id,
        provider=provider,
        provider_user_id=provider_user_id,
        access_token=access_token,
    )
    db.add(social_account)
    db.commit()

    logger.info("Social signup: provider=%s user_id=%s email=%s", provider, user.id, user.email)
    return user, True  # 신규 가입
