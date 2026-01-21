from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

logger = logging.getLogger(__name__)
from pydantic import BaseModel
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from backend.app.api.auth import get_current_user, require_admin
from backend.app.db.models import (
    User, FreeTrialApplication, Payment, Subscription,
    LottoDraw, LottoRecommendLog, LottoStatsCache,
    PlanPerformanceStats, MLTrainingLog, SocialAccount
)
from backend.app.db.session import get_db
from backend.app.schemas.pagination import PaginatedResponse

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ============================================
# 대시보드 요약
# ============================================

class AdminDashboardResponse(BaseModel):
    total_users: int
    active_users: int
    new_users_today: int
    new_users_week: int
    total_free_trials: int
    pending_free_trials: int
    total_payments: int
    total_revenue: int
    active_subscriptions: int
    latest_draw_no: int


@router.get("/dashboard", response_model=AdminDashboardResponse)
def get_admin_dashboard(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    today = datetime.utcnow().date()
    week_ago = datetime.utcnow() - timedelta(days=7)

    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
    new_users_today = db.query(func.count(User.id)).filter(
        func.date(User.created_at) == today
    ).scalar() or 0
    new_users_week = db.query(func.count(User.id)).filter(
        User.created_at >= week_ago
    ).scalar() or 0

    total_free_trials = db.query(func.count(FreeTrialApplication.id)).scalar() or 0
    pending_free_trials = db.query(func.count(FreeTrialApplication.id)).filter(
        FreeTrialApplication.status == "pending"
    ).scalar() or 0

    total_payments = db.query(func.count(Payment.id)).filter(
        Payment.status == "completed"
    ).scalar() or 0
    total_revenue = db.query(func.sum(Payment.amount)).filter(
        Payment.status == "completed"
    ).scalar() or 0

    active_subscriptions = db.query(func.count(Subscription.id)).filter(
        Subscription.status == "active",
        Subscription.expires_at > datetime.utcnow()
    ).scalar() or 0

    latest_draw = db.query(LottoDraw.draw_no).order_by(desc(LottoDraw.draw_no)).first()
    latest_draw_no = latest_draw[0] if latest_draw else 0

    return AdminDashboardResponse(
        total_users=total_users,
        active_users=active_users,
        new_users_today=new_users_today,
        new_users_week=new_users_week,
        total_free_trials=total_free_trials,
        pending_free_trials=pending_free_trials,
        total_payments=total_payments,
        total_revenue=total_revenue,
        active_subscriptions=active_subscriptions,
        latest_draw_no=latest_draw_no
    )


# ============================================
# 회원 관리
# ============================================

class UserListItem(BaseModel):
    id: int
    identifier: str
    name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    profile_image_url: Optional[str] = None
    last_login_at: Optional[datetime] = None
    is_active: Optional[bool] = True
    is_admin: Optional[bool] = False
    subscription_type: Optional[str] = "free"
    subscription_expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserListResponse(PaginatedResponse):
    users: List[UserListItem]


@router.get("/users", response_model=UserListResponse)
def get_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    subscription_type: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    query = db.query(User)

    if search:
        query = query.filter(User.identifier.ilike(f"%{search}%"))
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if subscription_type:
        query = query.filter(User.subscription_type == subscription_type)

    total = query.count()
    users = query.order_by(desc(User.created_at)).offset((page - 1) * page_size).limit(page_size).all()

    return UserListResponse(
        users=[UserListItem.model_validate(u) for u in users],
        total=total,
        page=page,
        page_size=page_size
    )


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    subscription_type: Optional[str] = None
    subscription_expires_at: Optional[datetime] = None


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    if payload.name is not None:
        user.name = payload.name
    if payload.email is not None:
        user.email = payload.email
    if payload.phone_number is not None:
        user.phone_number = payload.phone_number
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.is_admin is not None:
        user.is_admin = payload.is_admin
    if payload.subscription_type is not None:
        user.subscription_type = payload.subscription_type
    if payload.subscription_expires_at is not None:
        user.subscription_expires_at = payload.subscription_expires_at

    db.commit()
    return {"ok": True, "message": "사용자 정보가 수정되었습니다."}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="자기 자신은 삭제할 수 없습니다.")

    db.delete(user)
    db.commit()
    return {"ok": True, "message": "사용자가 삭제되었습니다."}


# ============================================
# 무료체험 관리
# ============================================

class FreeTrialListItem(BaseModel):
    id: int
    name: str
    phone: str
    combo_count: int
    status: str
    consent_terms: bool
    consent_marketing: bool
    created_at: datetime

    class Config:
        from_attributes = True


class FreeTrialListResponse(PaginatedResponse):
    trials: List[FreeTrialListItem]


@router.get("/free-trials", response_model=FreeTrialListResponse)
def get_free_trials(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    query = db.query(FreeTrialApplication)

    if status:
        query = query.filter(FreeTrialApplication.status == status)
    if search:
        query = query.filter(
            (FreeTrialApplication.name.ilike(f"%{search}%")) |
            (FreeTrialApplication.phone.ilike(f"%{search}%"))
        )

    total = query.count()
    trials = query.order_by(desc(FreeTrialApplication.created_at)).offset((page - 1) * page_size).limit(page_size).all()

    return FreeTrialListResponse(
        trials=[FreeTrialListItem.model_validate(t) for t in trials],
        total=total,
        page=page,
        page_size=page_size
    )


@router.put("/free-trials/{trial_id}/status")
def update_free_trial_status(
    trial_id: int,
    status: str = Query(..., pattern="^(pending|sent|failed)$"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    trial = db.query(FreeTrialApplication).filter(FreeTrialApplication.id == trial_id).first()
    if not trial:
        raise HTTPException(status_code=404, detail="신청을 찾을 수 없습니다.")

    trial.status = status
    db.commit()
    return {"ok": True, "message": f"상태가 {status}로 변경되었습니다."}


# ============================================
# 결제 관리
# ============================================

class PaymentListItem(BaseModel):
    id: int
    user_id: int
    order_id: str
    amount: int
    status: str
    payment_method: Optional[str]
    product_name: str
    product_type: str
    paid_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class PaymentListResponse(PaginatedResponse):
    payments: List[PaymentListItem]
    total_amount: int


@router.get("/payments", response_model=PaymentListResponse)
def get_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    query = db.query(Payment)

    if status:
        query = query.filter(Payment.status == status)
    if user_id:
        query = query.filter(Payment.user_id == user_id)

    total = query.count()
    total_amount = query.filter(Payment.status == "completed").with_entities(func.sum(Payment.amount)).scalar() or 0
    payments = query.order_by(desc(Payment.created_at)).offset((page - 1) * page_size).limit(page_size).all()

    return PaymentListResponse(
        payments=[PaymentListItem.model_validate(p) for p in payments],
        total=total,
        page=page,
        page_size=page_size,
        total_amount=total_amount
    )


class RefundRequest(BaseModel):
    reason: str


@router.post("/payments/{payment_id}/refund")
def refund_payment(
    payment_id: int,
    payload: RefundRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="결제를 찾을 수 없습니다.")

    if payment.status != "completed":
        raise HTTPException(status_code=400, detail="완료된 결제만 환불할 수 있습니다.")

    payment.status = "refunded"
    payment.refunded_at = datetime.utcnow()
    payment.refund_reason = payload.reason

    # 구독 취소
    subscription = db.query(Subscription).filter(Subscription.payment_id == payment_id).first()
    if subscription:
        subscription.status = "cancelled"
        subscription.cancelled_at = datetime.utcnow()

    # 사용자 구독 상태 변경
    user = db.query(User).filter(User.id == payment.user_id).first()
    if user:
        user.subscription_type = "free"
        user.subscription_expires_at = None
    else:
        logger.warning(f"환불 처리 중 사용자를 찾을 수 없음: payment_id={payment_id}, user_id={payment.user_id}")

    db.commit()
    return {"ok": True, "message": "환불이 처리되었습니다."}


# ============================================
# 구독 관리
# ============================================

class SubscriptionListItem(BaseModel):
    id: int
    user_id: Optional[int] = None
    name: str
    phone: str
    plan_type: str
    line_count: int
    status: str
    payment_status: str
    payment_method: Optional[str] = None
    amount: Optional[int] = None
    auto_approve: bool = False
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    last_sent_at: Optional[datetime] = None
    total_sent_count: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubscriptionListResponse(PaginatedResponse):
    subscriptions: List[SubscriptionListItem]


class SubscriptionApproveRequest(BaseModel):
    duration_days: int = 30


class SubscriptionRejectRequest(BaseModel):
    reason: Optional[str] = None


class SubscriptionExtendRequest(BaseModel):
    days: int


@router.get("/subscriptions", response_model=SubscriptionListResponse)
def get_subscriptions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    plan_type: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    query = db.query(Subscription)

    if status:
        query = query.filter(Subscription.status == status)
    if plan_type:
        query = query.filter(Subscription.plan_type == plan_type)

    total = query.count()
    subscriptions = query.order_by(desc(Subscription.created_at)).offset((page - 1) * page_size).limit(page_size).all()

    return SubscriptionListResponse(
        subscriptions=[SubscriptionListItem.model_validate(s) for s in subscriptions],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/subscriptions/{subscription_id}")
def get_subscription_detail(
    subscription_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """구독 상세 조회"""
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="구독 정보를 찾을 수 없습니다.")

    return SubscriptionListItem.model_validate(subscription)


@router.post("/subscriptions/{subscription_id}/approve")
def approve_subscription(
    subscription_id: int,
    payload: SubscriptionApproveRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """구독 승인"""
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="구독 정보를 찾을 수 없습니다.")

    if subscription.status == "active":
        raise HTTPException(status_code=400, detail="이미 활성화된 구독입니다.")

    now = datetime.utcnow()
    subscription.status = "active"
    subscription.payment_status = "confirmed"
    subscription.approved_by = admin.identifier
    subscription.approved_at = now
    subscription.started_at = now
    subscription.expires_at = now + timedelta(days=payload.duration_days)

    # 연동된 사용자가 있으면 구독 정보 업데이트
    if subscription.user_id:
        user = db.query(User).filter(User.id == subscription.user_id).first()
        if user:
            user.subscription_type = subscription.plan_type
            user.subscription_expires_at = subscription.expires_at

    db.commit()

    return {
        "ok": True,
        "message": f"구독이 승인되었습니다. {subscription.expires_at.strftime('%Y-%m-%d')}까지 이용 가능합니다.",
        "subscription_id": subscription_id
    }


@router.post("/subscriptions/{subscription_id}/reject")
def reject_subscription(
    subscription_id: int,
    payload: SubscriptionRejectRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """구독 거부"""
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="구독 정보를 찾을 수 없습니다.")

    if subscription.status != "pending":
        raise HTTPException(status_code=400, detail="대기 중인 구독만 거부할 수 있습니다.")

    subscription.status = "cancelled"
    subscription.cancelled_at = datetime.utcnow()
    db.commit()

    return {"ok": True, "message": "구독 신청이 거부되었습니다.", "subscription_id": subscription_id}


@router.put("/subscriptions/{subscription_id}/extend")
def extend_subscription(
    subscription_id: int,
    payload: SubscriptionExtendRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """구독 기간 연장"""
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="구독 정보를 찾을 수 없습니다.")

    if subscription.status != "active":
        raise HTTPException(status_code=400, detail="활성 구독만 연장할 수 있습니다.")

    # 기존 만료일에서 연장
    if subscription.expires_at:
        subscription.expires_at = subscription.expires_at + timedelta(days=payload.days)
    else:
        subscription.expires_at = datetime.utcnow() + timedelta(days=payload.days)

    # 연동된 사용자가 있으면 업데이트
    if subscription.user_id:
        user = db.query(User).filter(User.id == subscription.user_id).first()
        if user:
            user.subscription_expires_at = subscription.expires_at

    db.commit()

    return {
        "ok": True,
        "message": f"구독이 {payload.days}일 연장되었습니다. 새 만료일: {subscription.expires_at.strftime('%Y-%m-%d')}",
        "subscription_id": subscription_id
    }


@router.post("/subscriptions/{subscription_id}/cancel")
def cancel_subscription_admin(
    subscription_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """구독 취소 (관리자)"""
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="구독 정보를 찾을 수 없습니다.")

    subscription.status = "cancelled"
    subscription.cancelled_at = datetime.utcnow()

    # 연동된 사용자가 있으면 구독 정보 초기화
    if subscription.user_id:
        user = db.query(User).filter(User.id == subscription.user_id).first()
        if user:
            user.subscription_type = "free"
            user.subscription_expires_at = None

    db.commit()

    return {"ok": True, "message": "구독이 취소되었습니다.", "subscription_id": subscription_id}


# ============================================
# 로또 데이터 관리
# ============================================

class LottoDrawItem(BaseModel):
    draw_no: int
    draw_date: str
    n1: int
    n2: int
    n3: int
    n4: int
    n5: int
    n6: int
    bonus: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LottoDrawListResponse(PaginatedResponse):
    draws: List[LottoDrawItem]


@router.get("/lotto/draws", response_model=LottoDrawListResponse)
def get_lotto_draws(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    query = db.query(LottoDraw)
    total = query.count()
    draws = query.order_by(desc(LottoDraw.draw_no)).offset((page - 1) * page_size).limit(page_size).all()

    return LottoDrawListResponse(
        draws=[LottoDrawItem.model_validate(d) for d in draws],
        total=total,
        page=page,
        page_size=page_size
    )


class LottoDrawCreateRequest(BaseModel):
    draw_no: int
    draw_date: str
    n1: int
    n2: int
    n3: int
    n4: int
    n5: int
    n6: int
    bonus: int


@router.post("/lotto/draws")
def create_lotto_draw(
    payload: LottoDrawCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    existing = db.query(LottoDraw).filter(LottoDraw.draw_no == payload.draw_no).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 존재하는 회차입니다.")

    draw = LottoDraw(
        draw_no=payload.draw_no,
        draw_date=payload.draw_date,
        n1=payload.n1,
        n2=payload.n2,
        n3=payload.n3,
        n4=payload.n4,
        n5=payload.n5,
        n6=payload.n6,
        bonus=payload.bonus
    )
    db.add(draw)
    db.commit()
    return {"ok": True, "message": f"{payload.draw_no}회차가 추가되었습니다."}


@router.put("/lotto/draws/{draw_no}")
def update_lotto_draw(
    draw_no: int,
    payload: LottoDrawCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    draw = db.query(LottoDraw).filter(LottoDraw.draw_no == draw_no).first()
    if not draw:
        raise HTTPException(status_code=404, detail="회차를 찾을 수 없습니다.")

    draw.draw_date = payload.draw_date
    draw.n1 = payload.n1
    draw.n2 = payload.n2
    draw.n3 = payload.n3
    draw.n4 = payload.n4
    draw.n5 = payload.n5
    draw.n6 = payload.n6
    draw.bonus = payload.bonus
    db.commit()
    return {"ok": True, "message": f"{draw_no}회차가 수정되었습니다."}


@router.delete("/lotto/draws/{draw_no}")
def delete_lotto_draw(
    draw_no: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    draw = db.query(LottoDraw).filter(LottoDraw.draw_no == draw_no).first()
    if not draw:
        raise HTTPException(status_code=404, detail="회차를 찾을 수 없습니다.")

    # 관련 데이터 삭제 (데이터 무결성)
    deleted_logs = db.query(LottoRecommendLog).filter(
        LottoRecommendLog.target_draw_no == draw_no
    ).delete(synchronize_session=False)
    deleted_stats = db.query(PlanPerformanceStats).filter(
        PlanPerformanceStats.draw_no == draw_no
    ).delete(synchronize_session=False)

    db.delete(draw)
    db.commit()

    logger.info(f"회차 삭제: draw_no={draw_no}, 삭제된 추천로그={deleted_logs}건, 삭제된 성과통계={deleted_stats}건")
    return {"ok": True, "message": f"{draw_no}회차가 삭제되었습니다. (관련 로그 {deleted_logs}건, 통계 {deleted_stats}건 삭제)"}


@router.post("/lotto/rebuild-cache")
def rebuild_lotto_cache(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """통계 캐시 재생성"""
    from backend.app.services.lotto.stats_calculator import LottoStatsCalculator
    import json

    draws = db.query(LottoDraw).order_by(LottoDraw.draw_no).all()
    if not draws:
        raise HTTPException(status_code=400, detail="로또 데이터가 없습니다.")

    draws_dict = [
        {
            "draw_no": d.draw_no,
            "n1": d.n1, "n2": d.n2, "n3": d.n3,
            "n4": d.n4, "n5": d.n5, "n6": d.n6,
            "bonus": d.bonus,
        }
        for d in draws
    ]

    most_common, least_common = LottoStatsCalculator.calculate_most_least(draws_dict)
    ai_scores = {
        "logic1": LottoStatsCalculator.calculate_ai_scores_logic1(draws_dict),
        "logic2": LottoStatsCalculator.calculate_ai_scores_logic2(draws_dict),
        "logic3": LottoStatsCalculator.calculate_ai_scores_logic3(draws_dict),
    }

    cache = db.query(LottoStatsCache).filter(LottoStatsCache.id == 1).first()
    if cache:
        cache.updated_at = datetime.utcnow()
        cache.total_draws = len(draws)
        cache.most_common = json.dumps(most_common)
        cache.least_common = json.dumps(least_common)
        cache.ai_scores = json.dumps(ai_scores)
    else:
        cache = LottoStatsCache(
            id=1,
            updated_at=datetime.utcnow(),
            total_draws=len(draws),
            most_common=json.dumps(most_common),
            least_common=json.dumps(least_common),
            ai_scores=json.dumps(ai_scores),
        )
        db.add(cache)

    db.commit()
    return {"ok": True, "message": f"캐시가 재생성되었습니다. ({len(draws)}개 회차)"}


# ============================================
# 추천 로그 조회
# ============================================

class RecommendLogItem(BaseModel):
    id: int
    user_id: int
    target_draw_no: int
    lines: str
    recommend_time: datetime
    match_results: Optional[str] = None
    is_matched: bool = False

    class Config:
        from_attributes = True


class RecommendLogListResponse(PaginatedResponse):
    logs: List[RecommendLogItem]


@router.get("/recommend-logs", response_model=RecommendLogListResponse)
def get_recommend_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: Optional[int] = None,
    target_draw_no: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    query = db.query(LottoRecommendLog)

    if user_id:
        query = query.filter(LottoRecommendLog.user_id == user_id)
    if target_draw_no:
        query = query.filter(LottoRecommendLog.target_draw_no == target_draw_no)

    total = query.count()
    logs = query.order_by(desc(LottoRecommendLog.recommend_time)).offset((page - 1) * page_size).limit(page_size).all()

    return RecommendLogListResponse(
        logs=[RecommendLogItem.model_validate(l) for l in logs],
        total=total,
        page=page,
        page_size=page_size
    )


class RecommendLogUpdateRequest(BaseModel):
    lines: Optional[str] = None
    match_results: Optional[str] = None
    is_matched: Optional[bool] = None


@router.put("/recommend-logs/{log_id}")
def update_recommend_log(
    log_id: int,
    payload: RecommendLogUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    log = db.query(LottoRecommendLog).filter(LottoRecommendLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="추천 로그를 찾을 수 없습니다.")

    if payload.lines is not None:
        log.lines = payload.lines
    if payload.match_results is not None:
        log.match_results = payload.match_results
    if payload.is_matched is not None:
        log.is_matched = payload.is_matched
        if payload.is_matched:
            log.matched_at = datetime.utcnow()

    db.commit()
    return {"ok": True, "message": "추천 로그가 수정되었습니다."}


@router.delete("/recommend-logs/{log_id}")
def delete_recommend_log(
    log_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    log = db.query(LottoRecommendLog).filter(LottoRecommendLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="추천 로그를 찾을 수 없습니다.")

    db.delete(log)
    db.commit()
    return {"ok": True, "message": "추천 로그가 삭제되었습니다."}


# ============================================
# 플랜별 성과 통계
# ============================================

class PlanPerformanceItem(BaseModel):
    id: int
    draw_no: int
    plan_type: str
    total_lines: int
    total_users: int
    match_0: int
    match_1: int
    match_2: int
    match_3: int
    match_4: int
    match_5: int
    match_5_bonus: int
    match_6: int
    avg_match_count: float
    created_at: datetime

    class Config:
        from_attributes = True


class PlanPerformanceSummary(BaseModel):
    plan_type: str
    total_lines: int
    total_users: int
    rank5_count: int  # 3개 맞춤 (5등)
    rank4_count: int  # 4개 맞춤 (4등)
    rank3_count: int  # 5개 맞춤 (3등)
    rank2_count: int  # 5개+보너스 (2등)
    rank1_count: int  # 6개 맞춤 (1등)
    avg_match: float


@router.get("/performance/summary")
def get_performance_summary(
    recent_draws: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """플랜별 성과 요약 (최근 N회차)"""
    results = {}

    for plan_type in ["free", "basic", "premium", "vip"]:
        stats = db.query(
            func.sum(PlanPerformanceStats.total_lines).label("total_lines"),
            func.sum(PlanPerformanceStats.total_users).label("total_users"),
            func.sum(PlanPerformanceStats.match_3).label("rank5"),
            func.sum(PlanPerformanceStats.match_4).label("rank4"),
            func.sum(PlanPerformanceStats.match_5).label("rank3"),
            func.sum(PlanPerformanceStats.match_5_bonus).label("rank2"),
            func.sum(PlanPerformanceStats.match_6).label("rank1"),
            func.avg(PlanPerformanceStats.avg_match_count).label("avg_match")
        ).filter(
            PlanPerformanceStats.plan_type == plan_type
        ).first()

        if stats and stats.total_lines:
            results[plan_type] = {
                "total_lines": stats.total_lines or 0,
                "total_users": stats.total_users or 0,
                "rank5_count": stats.rank5 or 0,
                "rank4_count": stats.rank4 or 0,
                "rank3_count": stats.rank3 or 0,
                "rank2_count": stats.rank2 or 0,
                "rank1_count": stats.rank1 or 0,
                "avg_match": round(stats.avg_match or 0, 2)
            }
        else:
            results[plan_type] = {
                "total_lines": 0,
                "total_users": 0,
                "rank5_count": 0,
                "rank4_count": 0,
                "rank3_count": 0,
                "rank2_count": 0,
                "rank1_count": 0,
                "avg_match": 0
            }

    return results


@router.get("/performance/by-draw")
def get_performance_by_draw(
    draw_no: int = Query(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """특정 회차의 플랜별 성과"""
    stats = db.query(PlanPerformanceStats).filter(
        PlanPerformanceStats.draw_no == draw_no
    ).all()

    return {s.plan_type: PlanPerformanceItem.model_validate(s) for s in stats}


@router.get("/performance/history")
def get_performance_history(
    plan_type: Optional[str] = Query(None, pattern="^(free|basic|premium|vip)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """플랜별 회차별 성과 히스토리 (plan_type 미지정 시 전체 조회)"""
    query = db.query(PlanPerformanceStats)

    if plan_type:
        query = query.filter(PlanPerformanceStats.plan_type == plan_type)

    total = query.count()
    stats = query.order_by(desc(PlanPerformanceStats.draw_no)).offset((page - 1) * page_size).limit(page_size).all()

    # 프론트엔드 호환성을 위해 history 키로 반환
    return {
        "plan_type": plan_type,
        "history": [PlanPerformanceItem.model_validate(s) for s in stats],
        "total": total,
        "page": page,
        "page_size": page_size
    }


# ============================================
# ML 학습 로그
# ============================================

class MLTrainingLogItem(BaseModel):
    id: int
    trained_at: datetime
    total_draws: int
    total_feedback_records: int
    train_accuracy: Optional[float]
    test_accuracy: Optional[float]
    weight_logic1: Optional[float]
    weight_logic2: Optional[float]
    weight_logic3: Optional[float]
    weight_logic4: Optional[float]
    plan_performance: Optional[dict]
    notes: Optional[str]

    class Config:
        from_attributes = True


@router.get("/ml/training-logs")
def get_ml_training_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """ML 학습 로그 조회"""
    query = db.query(MLTrainingLog)
    total = query.count()
    logs = query.order_by(desc(MLTrainingLog.trained_at)).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "logs": [MLTrainingLogItem.model_validate(l) for l in logs],
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/ml/latest")
def get_latest_ml_status(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """최신 ML 상태"""
    latest = db.query(MLTrainingLog).order_by(desc(MLTrainingLog.trained_at)).first()

    if not latest:
        return {"message": "학습 기록이 없습니다."}

    return MLTrainingLogItem.model_validate(latest)


# ============================================
# 수동 매칭/재학습 트리거
# ============================================

@router.post("/match/trigger/{draw_no}")
def trigger_match(
    draw_no: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """특정 회차 수동 매칭"""
    from backend.app.services.lotto.result_matcher import match_all_pending_logs

    result = match_all_pending_logs(db, draw_no)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return {
        "ok": True,
        "message": f"{draw_no}회차 매칭 완료",
        "matched_count": result.get("matched_count", 0),
        "plan_stats": result.get("plan_stats", {})
    }


@router.post("/ml/retrain")
def trigger_ml_retrain(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """수동 ML 재학습"""
    from backend.app.services.lotto.ml_trainer import LottoMLTrainer
    from backend.app.services.lotto.result_matcher import get_plan_performance_summary

    draws = db.query(LottoDraw).order_by(LottoDraw.draw_no).all()
    if not draws:
        raise HTTPException(status_code=400, detail="로또 데이터가 없습니다.")

    draws_dict = [
        {
            "draw_no": d.draw_no,
            "n1": d.n1, "n2": d.n2, "n3": d.n3,
            "n4": d.n4, "n5": d.n5, "n6": d.n6,
            "bonus": d.bonus,
        }
        for d in draws
    ]

    trainer = LottoMLTrainer()
    train_result = trainer.train(draws_dict)

    # 학습 로그 저장
    plan_perf = get_plan_performance_summary(db, recent_draws=10)
    ml_log = MLTrainingLog(
        total_draws=len(draws_dict),
        total_feedback_records=0,
        train_accuracy=train_result.get("train_accuracy"),
        test_accuracy=train_result.get("test_accuracy"),
        weight_logic1=train_result.get("ai_weights", {}).get("logic1"),
        weight_logic2=train_result.get("ai_weights", {}).get("logic2"),
        weight_logic3=train_result.get("ai_weights", {}).get("logic3"),
        weight_logic4=train_result.get("ai_weights", {}).get("logic4"),
        plan_performance=plan_perf,
        notes="수동 재학습"
    )
    db.add(ml_log)
    db.commit()

    return {
        "ok": True,
        "message": "ML 재학습 완료",
        "train_accuracy": train_result.get("train_accuracy"),
        "test_accuracy": train_result.get("test_accuracy"),
        "ai_weights": train_result.get("ai_weights")
    }


# ============================================
# 회차별 매칭 현황
# ============================================

@router.get("/match/status")
def get_match_status(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """매칭 현황 요약"""
    total_logs = db.query(func.count(LottoRecommendLog.id)).scalar() or 0
    matched_logs = db.query(func.count(LottoRecommendLog.id)).filter(
        LottoRecommendLog.is_matched == True
    ).scalar() or 0
    pending_logs = total_logs - matched_logs

    # 회차별 미매칭 현황
    pending_by_draw = db.query(
        LottoRecommendLog.target_draw_no,
        func.count(LottoRecommendLog.id).label("count")
    ).filter(
        LottoRecommendLog.is_matched == False
    ).group_by(
        LottoRecommendLog.target_draw_no
    ).order_by(
        desc(LottoRecommendLog.target_draw_no)
    ).limit(10).all()

    return {
        "total_logs": total_logs,
        "matched_logs": matched_logs,
        "pending_logs": pending_logs,
        "pending_by_draw": [
            {"draw_no": d.target_draw_no, "count": d.count}
            for d in pending_by_draw
        ]
    }


# ============================================
# ML 로직별 성과 분석 (재학습 전 확인용)
# ============================================

@router.get("/ml/logic-analysis")
def get_ml_logic_analysis(
    recent_draws: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    ML 로직별 성과 분석 (재학습 전 확인용)
    - logic1/logic2/logic3 각각의 상위 번호 적중률
    - 회차별 AI 예측 vs 실제 당첨 비교
    """
    from backend.app.services.lotto.stats_calculator import LottoStatsCalculator

    # 최근 N회차 데이터 조회
    draws = db.query(LottoDraw).order_by(desc(LottoDraw.draw_no)).limit(recent_draws).all()
    if not draws:
        return {"error": "로또 데이터가 없습니다."}

    # 전체 데이터로 통계 계산
    all_draws = db.query(LottoDraw).order_by(LottoDraw.draw_no).all()
    draws_dict = [
        {
            "draw_no": d.draw_no,
            "n1": d.n1, "n2": d.n2, "n3": d.n3,
            "n4": d.n4, "n5": d.n5, "n6": d.n6,
            "bonus": d.bonus,
        }
        for d in all_draws
    ]

    # 각 로직별 점수 계산
    scores_logic1 = LottoStatsCalculator.calculate_ai_scores_logic1(draws_dict)
    scores_logic2 = LottoStatsCalculator.calculate_ai_scores_logic2(draws_dict)
    scores_logic3 = LottoStatsCalculator.calculate_ai_scores_logic3(draws_dict)

    # 로직별 상위 번호 추출
    def get_top_numbers(scores, n):
        sorted_nums = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return [num for num, _ in sorted_nums[:n]]

    logic1_top10 = set(get_top_numbers(scores_logic1, 10))
    logic1_top15 = set(get_top_numbers(scores_logic1, 15))
    logic1_top20 = set(get_top_numbers(scores_logic1, 20))

    logic2_top10 = set(get_top_numbers(scores_logic2, 10))
    logic2_top15 = set(get_top_numbers(scores_logic2, 15))
    logic2_top20 = set(get_top_numbers(scores_logic2, 20))

    logic3_top10 = set(get_top_numbers(scores_logic3, 10))
    logic3_top15 = set(get_top_numbers(scores_logic3, 15))
    logic3_top20 = set(get_top_numbers(scores_logic3, 20))

    # 회차별 적중 분석
    draw_results = []
    logic1_hits = {"top10": 0, "top15": 0, "top20": 0}
    logic2_hits = {"top10": 0, "top15": 0, "top20": 0}
    logic3_hits = {"top10": 0, "top15": 0, "top20": 0}

    for draw in draws:
        winning = {draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6}

        l1_10 = len(winning & logic1_top10)
        l1_15 = len(winning & logic1_top15)
        l1_20 = len(winning & logic1_top20)

        l2_10 = len(winning & logic2_top10)
        l2_15 = len(winning & logic2_top15)
        l2_20 = len(winning & logic2_top20)

        l3_10 = len(winning & logic3_top10)
        l3_15 = len(winning & logic3_top15)
        l3_20 = len(winning & logic3_top20)

        logic1_hits["top10"] += l1_10
        logic1_hits["top15"] += l1_15
        logic1_hits["top20"] += l1_20

        logic2_hits["top10"] += l2_10
        logic2_hits["top15"] += l2_15
        logic2_hits["top20"] += l2_20

        logic3_hits["top10"] += l3_10
        logic3_hits["top15"] += l3_15
        logic3_hits["top20"] += l3_20

        draw_results.append({
            "draw_no": draw.draw_no,
            "winning": sorted(list(winning)),
            "logic1": {"top10": l1_10, "top15": l1_15, "top20": l1_20},
            "logic2": {"top10": l2_10, "top15": l2_15, "top20": l2_20},
            "logic3": {"top10": l3_10, "top15": l3_15, "top20": l3_20},
        })

    total_draws = len(draws)
    max_hits = total_draws * 6  # 각 회차당 6개 당첨번호

    return {
        "analysis_draws": total_draws,
        "logic1": {
            "name": "최근 출현 빈도 기반",
            "top10_numbers": sorted(list(logic1_top10)),
            "top15_numbers": sorted(list(logic1_top15)),
            "top20_numbers": sorted(list(logic1_top20)),
            "hit_rate": {
                "top10": round(logic1_hits["top10"] / max_hits * 100, 2) if max_hits else 0,
                "top15": round(logic1_hits["top15"] / max_hits * 100, 2) if max_hits else 0,
                "top20": round(logic1_hits["top20"] / max_hits * 100, 2) if max_hits else 0,
            },
            "total_hits": logic1_hits,
        },
        "logic2": {
            "name": "연속 미출현 기반",
            "top10_numbers": sorted(list(logic2_top10)),
            "top15_numbers": sorted(list(logic2_top15)),
            "top20_numbers": sorted(list(logic2_top20)),
            "hit_rate": {
                "top10": round(logic2_hits["top10"] / max_hits * 100, 2) if max_hits else 0,
                "top15": round(logic2_hits["top15"] / max_hits * 100, 2) if max_hits else 0,
                "top20": round(logic2_hits["top20"] / max_hits * 100, 2) if max_hits else 0,
            },
            "total_hits": logic2_hits,
        },
        "logic3": {
            "name": "패턴 분석 기반",
            "top10_numbers": sorted(list(logic3_top10)),
            "top15_numbers": sorted(list(logic3_top15)),
            "top20_numbers": sorted(list(logic3_top20)),
            "hit_rate": {
                "top10": round(logic3_hits["top10"] / max_hits * 100, 2) if max_hits else 0,
                "top15": round(logic3_hits["top15"] / max_hits * 100, 2) if max_hits else 0,
                "top20": round(logic3_hits["top20"] / max_hits * 100, 2) if max_hits else 0,
            },
            "total_hits": logic3_hits,
        },
        "draw_results": draw_results[:10],  # 최근 10회차만 상세 반환
        "recommendation": _get_logic_recommendation(logic1_hits, logic2_hits, logic3_hits)
    }


def _get_logic_recommendation(logic1_hits, logic2_hits, logic3_hits):
    """로직별 성과 기반 가중치 추천"""
    total1 = logic1_hits["top15"]
    total2 = logic2_hits["top15"]
    total3 = logic3_hits["top15"]
    total = total1 + total2 + total3

    if total == 0:
        return {"logic1": 0.33, "logic2": 0.33, "logic3": 0.34}

    return {
        "logic1": round(total1 / total, 2),
        "logic2": round(total2 / total, 2),
        "logic3": round(total3 / total, 2),
        "note": "top15 적중률 기반 추천 가중치"
    }


# ============================================
# 백테스팅 (알고리즘 성능 검증)
# ============================================

class BacktestRequest(BaseModel):
    start_draw: int
    end_draw: int


class BacktestSingleResult(BaseModel):
    draw_no: int
    total_lines: int
    match_3: int
    match_4: int
    match_5: int
    match_6: int
    avg_matches_per_line: float
    performance_score: float
    logic_scores: dict


class BacktestSummary(BaseModel):
    total_draws: int
    total_lines: int
    total_match_3: int
    total_match_4: int
    total_match_5: int
    total_match_6: int
    avg_performance_score: float
    avg_matches_per_line: float
    logic_avg_scores: dict


@router.post("/backtest/run")
def run_backtest(
    payload: BacktestRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    백테스팅 실행
    - 과거 데이터로 알고리즘 성능 테스트
    - start_draw부터 end_draw까지 각 회차에 대해:
      1. 해당 회차 이전 데이터로 번호 생성
      2. 실제 당첨번호와 비교
      3. 적중률 계산
    """
    from backend.app.services.lotto.performance_evaluator import evaluate_single_draw, backtest_multiple_draws

    # 전체 회차 데이터 조회
    draws = db.query(LottoDraw).order_by(LottoDraw.draw_no).all()
    if not draws:
        raise HTTPException(status_code=400, detail="로또 데이터가 없습니다.")

    draws_dict = [
        {
            "draw_no": d.draw_no,
            "n1": d.n1, "n2": d.n2, "n3": d.n3,
            "n4": d.n4, "n5": d.n5, "n6": d.n6,
            "bonus": d.bonus,
        }
        for d in draws
    ]

    # 범위 검증
    min_draw = min(d["draw_no"] for d in draws_dict)
    max_draw = max(d["draw_no"] for d in draws_dict)

    if payload.start_draw < min_draw + 10:
        raise HTTPException(
            status_code=400,
            detail=f"시작 회차는 최소 {min_draw + 10}회차 이상이어야 합니다 (학습 데이터 필요)"
        )

    if payload.end_draw > max_draw:
        raise HTTPException(
            status_code=400,
            detail=f"종료 회차는 최대 {max_draw}회차까지만 가능합니다"
        )

    # 백테스팅 실행
    results = []
    for draw_no in range(payload.start_draw, payload.end_draw + 1):
        result = evaluate_single_draw(draw_no, draws=draws_dict)
        if result:
            results.append(result)

    if not results:
        raise HTTPException(status_code=400, detail="백테스팅 결과가 없습니다.")

    # 요약 계산
    total_draws = len(results)
    total_lines = sum(r['total_lines'] for r in results)
    total_match_3 = sum(r['match_3'] for r in results)
    total_match_4 = sum(r['match_4'] for r in results)
    total_match_5 = sum(r['match_5'] for r in results)
    total_match_6 = sum(r['match_6'] for r in results)
    avg_performance = sum(r['performance_score'] for r in results) / total_draws
    avg_matches = sum(r['avg_matches_per_line'] for r in results) / total_draws

    # 로직별 평균 점수
    logic_totals = {}
    for r in results:
        for logic_name, score in r['logic_scores'].items():
            if logic_name not in logic_totals:
                logic_totals[logic_name] = []
            logic_totals[logic_name].append(score)

    logic_avg_scores = {
        logic: round(sum(scores) / len(scores), 2)
        for logic, scores in logic_totals.items()
    }

    return {
        "summary": {
            "total_draws": total_draws,
            "total_lines": total_lines,
            "total_match_3": total_match_3,
            "total_match_4": total_match_4,
            "total_match_5": total_match_5,
            "total_match_6": total_match_6,
            "avg_performance_score": round(avg_performance, 2),
            "avg_matches_per_line": round(avg_matches, 2),
            "logic_avg_scores": logic_avg_scores,
            "match_3_rate": round(total_match_3 / total_lines * 100, 2) if total_lines else 0,
            "match_4_rate": round(total_match_4 / total_lines * 100, 2) if total_lines else 0,
            "match_5_rate": round(total_match_5 / total_lines * 100, 2) if total_lines else 0,
            "match_6_rate": round(total_match_6 / total_lines * 100, 2) if total_lines else 0,
        },
        "results": [
            {
                "draw_no": r["draw_no"],
                "total_lines": r["total_lines"],
                "match_3": r["match_3"],
                "match_4": r["match_4"],
                "match_5": r["match_5"],
                "match_6": r["match_6"],
                "avg_matches_per_line": round(r["avg_matches_per_line"], 2),
                "performance_score": round(r["performance_score"], 2),
                "logic_scores": {k: round(v, 2) for k, v in r["logic_scores"].items()},
            }
            for r in results
        ]
    }


@router.get("/backtest/single/{draw_no}")
def run_single_backtest(
    draw_no: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """단일 회차 백테스팅"""
    from backend.app.services.lotto.performance_evaluator import evaluate_single_draw

    draws = db.query(LottoDraw).order_by(LottoDraw.draw_no).all()
    if not draws:
        raise HTTPException(status_code=400, detail="로또 데이터가 없습니다.")

    draws_dict = [
        {
            "draw_no": d.draw_no,
            "n1": d.n1, "n2": d.n2, "n3": d.n3,
            "n4": d.n4, "n5": d.n5, "n6": d.n6,
            "bonus": d.bonus,
        }
        for d in draws
    ]

    # 해당 회차 당첨번호 조회
    target_draw = next((d for d in draws_dict if d["draw_no"] == draw_no), None)
    if not target_draw:
        raise HTTPException(status_code=404, detail=f"{draw_no}회차 데이터가 없습니다.")

    result = evaluate_single_draw(draw_no, draws=draws_dict)

    if not result:
        raise HTTPException(status_code=400, detail="백테스팅 실패")

    return {
        "draw_no": draw_no,
        "winning_numbers": [
            target_draw["n1"], target_draw["n2"], target_draw["n3"],
            target_draw["n4"], target_draw["n5"], target_draw["n6"]
        ],
        "bonus": target_draw["bonus"],
        "result": {
            "total_lines": result["total_lines"],
            "match_3": result["match_3"],
            "match_4": result["match_4"],
            "match_5": result["match_5"],
            "match_6": result["match_6"],
            "avg_matches_per_line": round(result["avg_matches_per_line"], 2),
            "performance_score": round(result["performance_score"], 2),
            "logic_scores": {k: round(v, 2) for k, v in result["logic_scores"].items()},
        }
    }


@router.get("/backtest/available-range")
def get_backtest_available_range(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """백테스팅 가능 회차 범위 조회"""
    draws = db.query(LottoDraw).order_by(LottoDraw.draw_no).all()
    if not draws:
        return {"error": "로또 데이터가 없습니다."}

    min_draw = min(d.draw_no for d in draws)
    max_draw = max(d.draw_no for d in draws)

    return {
        "min_draw": min_draw + 10,  # 최소 10회차 학습 데이터 필요
        "max_draw": max_draw,
        "total_draws": len(draws),
        "note": f"{min_draw + 10}회차부터 {max_draw}회차까지 백테스팅 가능"
    }


# ============================================
# 소셜 계정 관리
# ============================================

class SocialAccountItem(BaseModel):
    id: int
    user_id: int
    provider: str
    provider_user_id: str
    linked_at: Optional[datetime] = None
    user_identifier: Optional[str] = None

    class Config:
        from_attributes = True


class SocialAccountListResponse(PaginatedResponse):
    accounts: List[SocialAccountItem]


@router.get("/social-accounts", response_model=SocialAccountListResponse)
def get_social_accounts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: Optional[int] = None,
    provider: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """소셜 계정 목록 조회"""
    query = db.query(SocialAccount, User.identifier).join(User, SocialAccount.user_id == User.id, isouter=True)

    if user_id:
        query = query.filter(SocialAccount.user_id == user_id)
    if provider:
        query = query.filter(SocialAccount.provider == provider)

    total = query.count()
    results = query.order_by(desc(SocialAccount.linked_at)).offset((page - 1) * page_size).limit(page_size).all()

    accounts = []
    for account, user_identifier in results:
        item = SocialAccountItem(
            id=account.id,
            user_id=account.user_id,
            provider=account.provider,
            provider_user_id=account.provider_user_id,
            linked_at=account.linked_at,
            user_identifier=user_identifier
        )
        accounts.append(item)

    return SocialAccountListResponse(
        accounts=accounts,
        total=total,
        page=page,
        page_size=page_size
    )


@router.delete("/social-accounts/{account_id}")
def delete_social_account(
    account_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """소셜 계정 연동 해제"""
    account = db.query(SocialAccount).filter(SocialAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="소셜 계정을 찾을 수 없습니다.")

    db.delete(account)
    db.commit()
    return {"ok": True, "message": "소셜 계정 연동이 해제되었습니다."}
