"""유료 구독 API"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, validator
from sqlalchemy.orm import Session

from app.api.auth import require_admin, get_current_user
from app.db.models import Subscription, LottoDraw, LottoRecommendLog, User
from app.db.session import get_db
from app.services.lotto import build_stats_from_draws, format_line, draws_to_dict_list, get_next_draw_no
from app.services.lotto.generator import generate_basic_lines, generate_premium_lines, generate_vip_lines
from app.services.sms import SmsSendRequest, get_sms_client
from app.config.constants import PLAN_CONFIG

router = APIRouter()
logger = logging.getLogger("subscription")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Request/Response 모델
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class SubscribeRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=8, max_length=30)
    plan_type: str = Field(..., description="basic, premium, vip")
    payment_method: str = Field(default="bank_transfer", description="card, bank_transfer")
    consent_terms: bool = Field(..., description="약관 동의")

    @validator("phone")
    def validate_phone(cls, value: str) -> str:
        digits = "".join(ch for ch in value if ch.isdigit())
        if len(digits) < 10 or len(digits) > 11:
            raise ValueError("전화번호 형식이 올바르지 않습니다.")
        return digits

    @validator("plan_type")
    def validate_plan(cls, value: str) -> str:
        if value not in PLAN_CONFIG:
            raise ValueError("유효하지 않은 플랜입니다.")
        return value


class SubscribeResponse(BaseModel):
    message: str
    subscription_id: int
    plan_type: str
    amount: int
    status: str


class SubscriptionStatusResponse(BaseModel):
    id: int
    name: str
    phone: str
    plan_type: str
    line_count: int
    status: str
    payment_status: str
    started_at: Optional[datetime]
    expires_at: Optional[datetime]
    total_sent_count: int
    last_sent_at: Optional[datetime]


class SendNumbersResponse(BaseModel):
    message: str
    combinations: List[str]
    sent_at: datetime


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 헬퍼 함수
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _generate_subscription_lines(db: Session, plan_type: str) -> List[List[int]]:
    """구독 플랜에 따른 번호 생성"""
    draws = db.query(LottoDraw).order_by(LottoDraw.draw_no).all()
    if not draws:
        import random
        line_count = PLAN_CONFIG[plan_type]["line_count"]
        return [sorted(random.sample(range(1, 46), 6)) for _ in range(line_count)]

    stats = build_stats_from_draws(draws_to_dict_list(draws))

    if plan_type == "basic":
        # 베이직: ML 상위 20개에서 랜덤 5줄
        return generate_basic_lines(stats, 5)
    elif plan_type == "premium":
        # 프리미엄: ML 상위 15개에서 랜덤 9줄 + AI핵심 1줄
        return generate_premium_lines(stats)
    else:
        # VIP: 전체 20줄 (로직별 + 종합 + AI핵심)
        return generate_vip_lines(stats)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 사용자용 API 엔드포인트
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/api/subscribe", response_model=SubscribeResponse)
def subscribe(payload: SubscribeRequest, db: Session = Depends(get_db)) -> SubscribeResponse:
    """구독 신청"""
    if not payload.consent_terms:
        raise HTTPException(status_code=400, detail="약관 동의가 필요합니다.")

    plan = PLAN_CONFIG[payload.plan_type]

    try:
        subscription = Subscription(
            name=payload.name,
            phone=payload.phone,
            plan_type=payload.plan_type,
            line_count=plan["line_count"],
            status="pending",
            payment_method=payload.payment_method,
            payment_status="pending",
            amount=plan["price"],
        )
        db.add(subscription)
        db.commit()
        db.refresh(subscription)

        logger.info(
            "subscribe created id=%s plan=%s phone=%s",
            subscription.id, payload.plan_type, payload.phone[-4:]
        )

    except Exception as exc:
        db.rollback()
        logger.exception("subscribe failed: %s", exc)
        raise HTTPException(status_code=500, detail="구독 신청 중 오류가 발생했습니다.") from exc

    return SubscribeResponse(
        message=f"{plan['name']} 플랜 구독 신청이 완료되었습니다. 입금 확인 후 서비스가 시작됩니다.",
        subscription_id=subscription.id,
        plan_type=payload.plan_type,
        amount=plan["price"],
        status=subscription.status,
    )


@router.get("/api/subscription/status", response_model=SubscriptionStatusResponse)
def get_subscription_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> SubscriptionStatusResponse:
    """내 구독 상태 조회 (인증 필요)"""
    # 현재 로그인한 사용자의 전화번호로 구독 조회
    if not current_user.phone_number:
        raise HTTPException(status_code=400, detail="등록된 전화번호가 없습니다.")

    subscription = db.query(Subscription).filter(
        Subscription.phone == current_user.phone_number
    ).order_by(Subscription.created_at.desc()).first()

    if not subscription:
        raise HTTPException(status_code=404, detail="구독 정보를 찾을 수 없습니다.")

    return SubscriptionStatusResponse(
        id=subscription.id,
        name=subscription.name,
        phone=subscription.phone,
        plan_type=subscription.plan_type,
        line_count=subscription.line_count,
        status=subscription.status,
        payment_status=subscription.payment_status,
        started_at=subscription.started_at,
        expires_at=subscription.expires_at,
        total_sent_count=subscription.total_sent_count,
        last_sent_at=subscription.last_sent_at,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 관리자용 API (번호 발송)
# 참고: 구독 승인/거부/연장/취소/목록은 admin.py에서 통합 관리
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/api/admin/subscriptions/{subscription_id}/send-numbers", response_model=SendNumbersResponse)
def send_subscription_numbers(
    subscription_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
) -> SendNumbersResponse:
    """구독자에게 유료 번호 발송 (수동 트리거, 관리자 전용)"""
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()

    if not subscription:
        raise HTTPException(status_code=404, detail="구독 정보를 찾을 수 없습니다.")

    if subscription.status != "active":
        raise HTTPException(status_code=400, detail="활성화된 구독이 아닙니다.")

    if subscription.expires_at and subscription.expires_at < datetime.utcnow():
        subscription.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="구독이 만료되었습니다.")

    try:
        # 번호 생성
        lines = _generate_subscription_lines(db, subscription.plan_type)
        formatted_lines = [format_line(line) for line in lines]

        # SMS 발송
        message_body = f"[AI로또 {PLAN_CONFIG[subscription.plan_type]['name']}] 이번 주 추천 번호입니다.\n" + "\n".join(
            f"{idx + 1}) {line}" for idx, line in enumerate(formatted_lines)
        )

        sms_client = get_sms_client()
        sms_result = sms_client.send(
            SmsSendRequest(
                to=subscription.phone,
                content=message_body,
            )
        )

        now = datetime.utcnow()

        # 로그 기록
        recommend_log = LottoRecommendLog(
            user_id=subscription.id,
            account_user_id=subscription.user_id,
            target_draw_no=get_next_draw_no(db),
            lines=json.dumps(formatted_lines, ensure_ascii=False),
            recommend_time=now,
            match_results=None,
            plan_type=subscription.plan_type,
            is_matched=False,
        )
        db.add(recommend_log)

        # 발송 정보 업데이트
        subscription.last_sent_at = now
        subscription.total_sent_count += 1

        db.commit()

        logger.info(
            "numbers sent subscription_id=%s lines=%s sms_success=%s",
            subscription_id, len(formatted_lines), sms_result.success
        )

        if sms_result.success:
            message = "번호가 발송되었습니다."
        else:
            message = "번호 생성은 완료되었지만 문자 발송에 실패했습니다."

    except Exception as exc:
        db.rollback()
        logger.exception("send_numbers failed: %s", exc)
        raise HTTPException(status_code=500, detail="번호 발송 중 오류가 발생했습니다.") from exc

    return SendNumbersResponse(
        message=message,
        combinations=formatted_lines,
        sent_at=now,
    )
