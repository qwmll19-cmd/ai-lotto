"""OAuth 소셜 로그인 API"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from backend.app.config import settings, get_cookie_settings
from backend.app.db.session import get_db
from backend.app.services.jwt import encode_jwt
from backend.app.services.auth import hash_token
from backend.app.services.oauth import (
    OAuthError,
    generate_oauth_state,
    verify_oauth_state,
    get_naver_authorize_url,
    get_kakao_authorize_url,
    exchange_naver_token,
    exchange_kakao_token,
    fetch_naver_profile,
    fetch_kakao_profile,
    social_login,
)

router = APIRouter(prefix="/auth", tags=["oauth"])
logger = logging.getLogger("oauth")

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"


def _set_auth_cookies(response: Response, user_id: int, identifier: str) -> str:
    """JWT 토큰 생성 및 쿠키 설정"""
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

    return refresh_token


def _redirect_with_error(error_code: str, error_message: str) -> RedirectResponse:
    """에러 발생 시 프론트엔드로 리다이렉트"""
    params = urlencode({"error": error_code, "message": error_message})
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/login?{params}",
        status_code=302,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 네이버 OAuth
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@router.get("/naver")
def naver_login():
    """
    네이버 로그인 시작

    네이버 authorize URL로 리다이렉트
    """
    try:
        state = generate_oauth_state()
        authorize_url = get_naver_authorize_url(state)
        return RedirectResponse(url=authorize_url, status_code=302)
    except OAuthError as e:
        logger.error("Naver login start failed: %s", e.message)
        raise HTTPException(status_code=500, detail=e.message)


@router.get("/naver/callback")
async def naver_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    네이버 OAuth 콜백

    1. state 검증
    2. code → access_token 교환
    3. 프로필 조회
    4. 회원 처리 (신규/기존)
    5. JWT 발급 및 프론트엔드로 리다이렉트
    """
    # 에러 처리
    if error:
        logger.warning("Naver callback error: %s - %s", error, error_description)
        return _redirect_with_error("naver_error", error_description or "네이버 로그인이 취소되었습니다.")

    # 파라미터 검증
    if not code or not state:
        logger.warning("Naver callback missing params: code=%s state=%s", bool(code), bool(state))
        return _redirect_with_error("invalid_request", "잘못된 요청입니다.")

    # state 검증 (CSRF 방지)
    if not verify_oauth_state(state):
        logger.warning("Naver callback invalid state")
        return _redirect_with_error("invalid_state", "세션이 만료되었습니다. 다시 시도해주세요.")

    try:
        # 토큰 교환
        access_token = await exchange_naver_token(code, state)

        # 프로필 조회
        profile = await fetch_naver_profile(access_token)

        # 회원 처리
        user = social_login(db, "NAVER", profile, access_token)

        # JWT 발급 및 쿠키 설정
        # identifier가 없으면 소셜 로그인용 식별자 생성
        identifier = user.identifier or f"naver_{user.id}"

        response = RedirectResponse(
            url=f"{settings.FRONTEND_URL}/mypage?login=success",
            status_code=302,
        )

        refresh_token = _set_auth_cookies(response, user.id, identifier)

        # refresh_token_hash 저장
        user.refresh_token_hash = hash_token(refresh_token)
        user.refresh_token_updated_at = datetime.utcnow()
        db.commit()

        logger.info("Naver login success: user_id=%s", user.id)
        return response

    except OAuthError as e:
        logger.error("Naver callback failed: %s", e.message)
        db.rollback()
        return _redirect_with_error(e.code, e.message)
    except Exception as e:
        logger.exception("Naver callback unexpected error: %s", e)
        db.rollback()
        return _redirect_with_error("server_error", "서버 오류가 발생했습니다.")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 카카오 OAuth
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@router.get("/kakao")
def kakao_login():
    """
    카카오 로그인 시작

    카카오 authorize URL로 리다이렉트
    """
    try:
        state = generate_oauth_state()
        authorize_url = get_kakao_authorize_url(state)
        return RedirectResponse(url=authorize_url, status_code=302)
    except OAuthError as e:
        logger.error("Kakao login start failed: %s", e.message)
        raise HTTPException(status_code=500, detail=e.message)


@router.get("/kakao/callback")
async def kakao_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    카카오 OAuth 콜백

    1. state 검증
    2. code → access_token 교환
    3. 프로필 조회
    4. 회원 처리 (신규/기존)
    5. JWT 발급 및 프론트엔드로 리다이렉트
    """
    # 에러 처리
    if error:
        logger.warning("Kakao callback error: %s - %s", error, error_description)
        return _redirect_with_error("kakao_error", error_description or "카카오 로그인이 취소되었습니다.")

    # 파라미터 검증
    if not code or not state:
        logger.warning("Kakao callback missing params: code=%s state=%s", bool(code), bool(state))
        return _redirect_with_error("invalid_request", "잘못된 요청입니다.")

    # state 검증 (CSRF 방지) - 필수
    if not verify_oauth_state(state):
        logger.warning("Kakao callback invalid state")
        return _redirect_with_error("invalid_state", "세션이 만료되었습니다. 다시 시도해주세요.")

    try:
        # 토큰 교환
        access_token = await exchange_kakao_token(code)

        # 프로필 조회
        profile = await fetch_kakao_profile(access_token)

        # 회원 처리
        user = social_login(db, "KAKAO", profile, access_token)

        # JWT 발급 및 쿠키 설정
        identifier = user.identifier or f"kakao_{user.id}"

        response = RedirectResponse(
            url=f"{settings.FRONTEND_URL}/mypage?login=success",
            status_code=302,
        )

        refresh_token = _set_auth_cookies(response, user.id, identifier)

        # refresh_token_hash 저장
        user.refresh_token_hash = hash_token(refresh_token)
        user.refresh_token_updated_at = datetime.utcnow()
        db.commit()

        logger.info("Kakao login success: user_id=%s", user.id)
        return response

    except OAuthError as e:
        logger.error("Kakao callback failed: %s", e.message)
        db.rollback()
        return _redirect_with_error(e.code, e.message)
    except Exception as e:
        logger.exception("Kakao callback unexpected error: %s", e)
        db.rollback()
        return _redirect_with_error("server_error", "서버 오류가 발생했습니다.")
