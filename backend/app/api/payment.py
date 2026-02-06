"""QR 결제 API (비로그인 접근 가능)"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.models import Subscription
from app.db.session import get_db
from app.config.constants import PLAN_CONFIG
from app.utils import now_kst

router = APIRouter(prefix="/api/pay", tags=["payment"])
logger = logging.getLogger("payment")

# 결제 계좌 정보 (사업자 계좌)
PAYMENT_ACCOUNT = {
    "bank_name": "토스뱅크",
    "account_number": "100242176511",
    "account_holder": "팡팡기획",
}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Request/Response 모델
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class PaymentInfoResponse(BaseModel):
    """결제 정보 조회 응답"""
    plan_type: str
    plan_name: str
    amount: int
    bank_name: str
    account_number: str
    account_holder: str
    status: str
    depositor_name: Optional[str] = None  # 마스킹 처리


class ConfirmPaymentRequest(BaseModel):
    """입금 확인 요청"""
    depositor_name: str = Field(..., min_length=1, max_length=100, description="입금자명")


class ConfirmPaymentResponse(BaseModel):
    """입금 확인 응답"""
    ok: bool
    message: str


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 헬퍼 함수
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def mask_name(name: str) -> str:
    """이름 마스킹 (홍길동 → 홍*동)"""
    if not name:
        return ""
    if len(name) <= 1:
        return "*"
    if len(name) == 2:
        return name[0] + "*"
    # 3글자 이상: 첫글자 + * + 마지막글자
    return name[0] + "*" * (len(name) - 2) + name[-1]


def get_subscription_by_token(db: Session, token: str) -> Subscription:
    """토큰으로 구독 조회 + 유효성 검증"""
    subscription = db.query(Subscription).filter(
        Subscription.payment_token == token
    ).first()

    if not subscription:
        raise HTTPException(status_code=404, detail="유효하지 않은 결제 링크입니다.")

    # 토큰 만료 확인
    now = now_kst()
    if subscription.payment_token_expires_at and subscription.payment_token_expires_at < now:
        raise HTTPException(status_code=400, detail="결제 링크가 만료되었습니다. 다시 결제를 시도해주세요.")

    # 이미 처리된 구독 확인
    if subscription.status == "active":
        raise HTTPException(status_code=400, detail="이미 결제가 완료된 구독입니다.")

    if subscription.status == "cancelled":
        raise HTTPException(status_code=400, detail="취소된 구독입니다.")

    return subscription


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# API 엔드포인트
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/{token}", response_model=PaymentInfoResponse)
def get_payment_info(
    token: str,
    db: Session = Depends(get_db)
) -> PaymentInfoResponse:
    """
    결제 정보 조회 (비로그인)

    QR 코드 스캔 후 결제 정보를 조회합니다.
    금액은 서버에서 PLAN_CONFIG 기반으로 반환하여 위변조를 방지합니다.
    """
    subscription = get_subscription_by_token(db, token)
    plan = PLAN_CONFIG.get(subscription.plan_type, {})

    # 입금자명 마스킹
    masked_depositor = mask_name(subscription.depositor_name) if subscription.depositor_name else None

    return PaymentInfoResponse(
        plan_type=subscription.plan_type,
        plan_name=plan.get("name", subscription.plan_type),
        amount=plan.get("price", subscription.amount),  # 서버 PLAN_CONFIG에서 가져옴
        bank_name=PAYMENT_ACCOUNT["bank_name"],
        account_number=PAYMENT_ACCOUNT["account_number"],
        account_holder=PAYMENT_ACCOUNT["account_holder"],
        status=subscription.status,
        depositor_name=masked_depositor,
    )


@router.post("/{token}/confirm", response_model=ConfirmPaymentResponse)
def confirm_payment(
    token: str,
    payload: ConfirmPaymentRequest,
    db: Session = Depends(get_db)
) -> ConfirmPaymentResponse:
    """
    입금 확인 요청 (비로그인)

    모바일에서 QR 스캔 후 입금자명을 입력하고 완료 버튼을 누르면 호출됩니다.
    실제 입금 확인은 관리자가 수동으로 진행합니다.
    """
    subscription = get_subscription_by_token(db, token)

    try:
        # 입금자명 저장
        subscription.depositor_name = payload.depositor_name.strip()
        db.commit()

        logger.info(
            "payment confirm token=%s subscription_id=%s depositor=%s",
            token[:8], subscription.id, payload.depositor_name
        )

    except Exception as exc:
        db.rollback()
        logger.exception("payment confirm failed: %s", exc)
        raise HTTPException(status_code=500, detail="처리 중 오류가 발생했습니다.") from exc

    return ConfirmPaymentResponse(
        ok=True,
        message="입금 확인 요청이 완료되었습니다. 관리자 확인 후 1시간 이내 구독이 활성화됩니다."
    )
