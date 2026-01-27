"""OAuth 소셜 로그인 API

Token 기반 인증 시스템으로 전환:
- 모든 OAuth 콜백을 one-time token 방식으로 통일
- 브라우저 종류(인앱/일반) 구분 없이 동일한 흐름 처리
- 프론트엔드에서 /oauth/callback 페이지를 통해 토큰 교환
"""
from __future__ import annotations

import logging
from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import get_db
from app.services.oauth import (
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
from app.api.auth import create_oauth_one_time_token

router = APIRouter(prefix="/auth", tags=["oauth"])
logger = logging.getLogger("oauth")


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
def naver_login(auth_type: Optional[str] = Query(None)):
    """
    네이버 로그인 시작

    네이버 authorize URL로 리다이렉트
    - auth_type=reprompt: 다른 계정으로 로그인 (강제 재인증)
    """
    try:
        state = generate_oauth_state()
        authorize_url = get_naver_authorize_url(state, auth_type=auth_type)
        return RedirectResponse(url=authorize_url, status_code=302)
    except OAuthError as e:
        logger.error("Naver login start failed: %s", e.message)
        raise HTTPException(status_code=500, detail=e.message)


@router.api_route("/naver/callback", methods=["GET", "POST"])
async def naver_callback(
    request: Request,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    네이버 OAuth 콜백

    Token 기반 인증 시스템:
    1. state 검증 (CSRF 방지)
    2. code → access_token 교환
    3. 프로필 조회
    4. 회원 처리 (신규/기존)
    5. one-time token 발급 후 /oauth/callback으로 리다이렉트
       - 프론트엔드에서 토큰 교환 API 호출하여 JWT 획득
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

        # 회원 처리 (신규 가입 여부 반환)
        user, is_new_user = social_login(db, "NAVER", profile, access_token)
        db.commit()  # 사용자 정보 먼저 커밋

        # 모든 브라우저에서 one-time token 방식 사용 (Token 기반 인증, DB 저장)
        one_time_token = create_oauth_one_time_token(user.id, db, is_new_user=is_new_user)
        redirect_url = f"{settings.FRONTEND_URL}/oauth/callback?token={one_time_token}"
        logger.info("Naver login success: user_id=%s, is_new=%s", user.id, is_new_user)
        return RedirectResponse(url=redirect_url, status_code=302)

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
def kakao_login(prompt: Optional[str] = Query(None)):
    """
    카카오 로그인 시작

    카카오 authorize URL로 리다이렉트
    - prompt=login: 다른 계정으로 로그인 (강제 재인증)
    """
    try:
        state = generate_oauth_state()
        authorize_url = get_kakao_authorize_url(state, prompt=prompt)
        return RedirectResponse(url=authorize_url, status_code=302)
    except OAuthError as e:
        logger.error("Kakao login start failed: %s", e.message)
        raise HTTPException(status_code=500, detail=e.message)


@router.api_route("/kakao/callback", methods=["GET", "POST"])
async def kakao_callback(
    request: Request,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    카카오 OAuth 콜백

    Token 기반 인증 시스템:
    1. state 검증 (CSRF 방지)
    2. code → access_token 교환
    3. 프로필 조회
    4. 회원 처리 (신규/기존)
    5. one-time token 발급 후 /oauth/callback으로 리다이렉트
       - 프론트엔드에서 토큰 교환 API 호출하여 JWT 획득
    """
    # 에러 처리
    if error:
        logger.warning("Kakao callback error: %s - %s", error, error_description)
        return _redirect_with_error("kakao_error", error_description or "카카오 로그인이 취소되었습니다.")

    # 파라미터 검증
    if not code or not state:
        logger.warning("Kakao callback missing params: code=%s state=%s", bool(code), bool(state))
        return _redirect_with_error("invalid_request", "잘못된 요청입니다.")

    # state 검증 (CSRF 방지)
    if not verify_oauth_state(state):
        logger.warning("Kakao callback invalid state")
        return _redirect_with_error("invalid_state", "세션이 만료되었습니다. 다시 시도해주세요.")

    try:
        # 토큰 교환
        access_token = await exchange_kakao_token(code)

        # 프로필 조회
        profile = await fetch_kakao_profile(access_token)

        # 회원 처리 (신규 가입 여부 반환)
        user, is_new_user = social_login(db, "KAKAO", profile, access_token)
        db.commit()  # 사용자 정보 먼저 커밋

        # 모든 브라우저에서 one-time token 방식 사용 (Token 기반 인증, DB 저장)
        one_time_token = create_oauth_one_time_token(user.id, db, is_new_user=is_new_user)
        redirect_url = f"{settings.FRONTEND_URL}/oauth/callback?token={one_time_token}"
        logger.info("Kakao login success: user_id=%s, is_new=%s", user.id, is_new_user)
        return RedirectResponse(url=redirect_url, status_code=302)

    except OAuthError as e:
        logger.error("Kakao callback failed: %s", e.message)
        db.rollback()
        return _redirect_with_error(e.code, e.message)
    except Exception as e:
        logger.exception("Kakao callback unexpected error: %s", e)
        db.rollback()
        return _redirect_with_error("server_error", "서버 오류가 발생했습니다.")
