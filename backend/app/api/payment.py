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
from app.rate_limit import limiter

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
    receipt_type: Optional[str] = Field(None, description="현금영수증 유형: phone, business")
    receipt_phone: Optional[str] = Field(None, max_length=20, description="현금영수증 휴대전화")
    receipt_biz_number: Optional[str] = Field(None, max_length=20, description="현금영수증 사업자번호")


class ConfirmPaymentResponse(BaseModel):
    """입금 확인 응답"""
    ok: bool
    message: str


class PaymentStatusResponse(BaseModel):
    """결제 상태 조회 응답 (PC 폴링용)"""
    status: str  # pending, active, cancelled
    deposit_submitted: bool  # 모바일에서 입금 완료 제출 여부
    depositor_name: Optional[str] = None  # 마스킹 처리


class PaymentAccountResponse(BaseModel):
    """결제 계좌 정보 응답"""
    bank_name: str
    account_number: str
    account_holder: str


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
    logger.info("get_subscription_by_token: token=%s", token[:16] if token else "None")

    subscription = db.query(Subscription).filter(
        Subscription.payment_token == token
    ).first()

    if not subscription:
        logger.warning("get_subscription_by_token: subscription not found for token=%s", token[:16] if token else "None")
        raise HTTPException(status_code=404, detail="유효하지 않은 결제 링크입니다.")

    logger.info(
        "get_subscription_by_token: found subscription id=%s status=%s expires_at=%s",
        subscription.id, subscription.status, subscription.payment_token_expires_at
    )

    # 토큰 만료 확인
    now = now_kst()
    if subscription.payment_token_expires_at and subscription.payment_token_expires_at < now:
        logger.warning(
            "get_subscription_by_token: token expired. id=%s expires_at=%s now=%s",
            subscription.id, subscription.payment_token_expires_at, now
        )
        raise HTTPException(status_code=400, detail="결제 링크가 만료되었습니다. 다시 결제를 시도해주세요.")

    # 이미 처리된 구독 확인
    if subscription.status == "active":
        logger.warning("get_subscription_by_token: subscription already active id=%s", subscription.id)
        raise HTTPException(status_code=400, detail="이미 결제가 완료된 구독입니다.")

    if subscription.status == "cancelled":
        logger.warning("get_subscription_by_token: subscription cancelled id=%s", subscription.id)
        raise HTTPException(status_code=400, detail="취소된 구독입니다.")

    return subscription


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# API 엔드포인트
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/account", response_model=PaymentAccountResponse)
def get_payment_account() -> PaymentAccountResponse:
    """결제 계좌 정보 조회 (비로그인)"""
    return PaymentAccountResponse(
        bank_name=PAYMENT_ACCOUNT["bank_name"],
        account_number=PAYMENT_ACCOUNT["account_number"],
        account_holder=PAYMENT_ACCOUNT["account_holder"],
    )


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
@limiter.limit("5/minute")
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
        # 입금자명 저장 + 입금 완료 제출 플래그 설정
        subscription.depositor_name = payload.depositor_name.strip()
        subscription.deposit_submitted = True

        # 현금영수증 정보 저장
        if payload.receipt_type == 'phone' and payload.receipt_phone:
            subscription.receipt_phone = payload.receipt_phone.strip()
            subscription.receipt_biz_number = None
        elif payload.receipt_type == 'business' and payload.receipt_biz_number:
            subscription.receipt_biz_number = payload.receipt_biz_number.strip()
            subscription.receipt_phone = None

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


@router.get("/{token}/status", response_model=PaymentStatusResponse)
@limiter.limit("30/minute")
def get_payment_status(
    token: str,
    db: Session = Depends(get_db)
) -> PaymentStatusResponse:
    """
    결제 상태 조회 (PC 폴링용)

    PC에서 QR 표시 중 모바일에서 입금 완료했는지 확인합니다.
    deposit_submitted가 True면 모바일에서 완료 처리됨.
    """
    subscription = db.query(Subscription).filter(
        Subscription.payment_token == token
    ).first()

    if not subscription:
        raise HTTPException(status_code=404, detail="유효하지 않은 결제 링크입니다.")

    now = now_kst()
    if subscription.payment_token_expires_at and subscription.payment_token_expires_at < now:
        raise HTTPException(status_code=400, detail="결제 링크가 만료되었습니다. 다시 결제를 시도해주세요.")

    # 입금자명 마스킹
    masked_depositor = mask_name(subscription.depositor_name) if subscription.depositor_name else None

    return PaymentStatusResponse(
        status=subscription.status,
        deposit_submitted=subscription.deposit_submitted or False,
        depositor_name=masked_depositor,
    )
