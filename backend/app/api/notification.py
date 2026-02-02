"""푸시 알림 API (Phase 6)"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import InAppNotification
from app.api.auth import get_current_user
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/api/notification", tags=["notification"])


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 요청 모델
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class PushSubscriptionRequest(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class PushUnsubscribeRequest(BaseModel):
    endpoint: str


class NotificationPreferencesRequest(BaseModel):
    notify_draw_result: Optional[bool] = None
    notify_recommendation: Optional[bool] = None
    notify_subscription: Optional[bool] = None


class InAppNotificationCreate(BaseModel):
    notification_type: str = "info"  # info, success, warning, error
    title: Optional[str] = None
    message: str


class MarkNotificationReadRequest(BaseModel):
    notification_ids: List[int]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 구독 관리
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/subscribe")
def subscribe_push(
    req: PushSubscriptionRequest,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    푸시 알림 구독 등록

    브라우저에서 전달받은 subscription 정보를 저장합니다.
    """
    user_agent = request.headers.get("User-Agent")

    result = NotificationService.subscribe(
        db=db,
        user_id=user.id,
        endpoint=req.endpoint,
        p256dh_key=req.p256dh,
        auth_key=req.auth,
        user_agent=user_agent,
    )

    return result


@router.post("/unsubscribe")
def unsubscribe_push(
    req: PushUnsubscribeRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    푸시 알림 구독 해제
    """
    result = NotificationService.unsubscribe(
        db=db,
        user_id=user.id,
        endpoint=req.endpoint,
    )

    return result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 알림 설정
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/settings")
def get_notification_settings(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    알림 설정 조회
    """
    subscriptions = NotificationService.get_user_subscriptions(db, user.id)

    if not subscriptions:
        return {
            "success": True,
            "has_subscription": False,
            "settings": {
                "notify_draw_result": True,
                "notify_recommendation": True,
                "notify_subscription": True,
            },
            "subscriptions": [],
        }

    # 첫 번째 활성 구독의 설정 반환
    active_subs = [s for s in subscriptions if s["is_active"]]
    settings = active_subs[0] if active_subs else subscriptions[0]

    return {
        "success": True,
        "has_subscription": len(active_subs) > 0,
        "settings": {
            "notify_draw_result": settings["notify_draw_result"],
            "notify_recommendation": settings["notify_recommendation"],
            "notify_subscription": settings["notify_subscription"],
        },
        "subscriptions": subscriptions,
    }


@router.put("/settings")
def update_notification_settings(
    req: NotificationPreferencesRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    알림 설정 업데이트
    """
    result = NotificationService.update_preferences(
        db=db,
        user_id=user.id,
        notify_draw_result=req.notify_draw_result,
        notify_recommendation=req.notify_recommendation,
        notify_subscription=req.notify_subscription,
    )

    return result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 알림 히스토리
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/history")
def get_notification_history(
    limit: int = 20,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    알림 히스토리 조회
    """
    history = NotificationService.get_notification_history(
        db=db,
        user_id=user.id,
        limit=min(limit, 50),
    )

    return {
        "success": True,
        "notifications": history,
        "count": len(history),
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# VAPID 공개키 (프론트엔드용)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/vapid-public-key")
def get_vapid_public_key():
    """
    VAPID 공개키 조회

    프론트엔드에서 PushManager.subscribe() 호출 시 필요합니다.
    실제 운영 시 환경변수에서 읽어옵니다.
    """
    import os

    vapid_public_key = os.getenv("VAPID_PUBLIC_KEY", "")

    if not vapid_public_key:
        # 개발용 placeholder
        return {
            "success": False,
            "message": "VAPID_PUBLIC_KEY 환경변수가 설정되지 않았습니다.",
            "public_key": None,
        }

    return {
        "success": True,
        "public_key": vapid_public_key,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 인앱 알림 (서버 DB 저장)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/in-app")
def get_in_app_notifications(
    limit: int = 20,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    인앱 알림 목록 조회 (PC/모바일 통합)
    """
    notifications = (
        db.query(InAppNotification)
        .filter(InAppNotification.user_id == user.id)
        .order_by(InAppNotification.created_at.desc())
        .limit(min(limit, 50))
        .all()
    )

    unread_count = (
        db.query(InAppNotification)
        .filter(InAppNotification.user_id == user.id, InAppNotification.is_read == False)
        .count()
    )

    return {
        "success": True,
        "notifications": [
            {
                "id": n.id,
                "type": n.notification_type,
                "title": n.title,
                "message": n.message,
                "read": n.is_read,
                "createdAt": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifications
        ],
        "unread_count": unread_count,
    }


@router.post("/in-app")
def create_in_app_notification(
    req: InAppNotificationCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    인앱 알림 생성 (클라이언트에서 호출)
    """
    notification = InAppNotification(
        user_id=user.id,
        notification_type=req.notification_type,
        title=req.title,
        message=req.message,
        is_read=False,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    return {
        "success": True,
        "notification": {
            "id": notification.id,
            "type": notification.notification_type,
            "title": notification.title,
            "message": notification.message,
            "read": notification.is_read,
            "createdAt": notification.created_at.isoformat() if notification.created_at else None,
        },
    }


@router.put("/in-app/read")
def mark_notifications_as_read(
    req: MarkNotificationReadRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    특정 알림들 읽음 처리
    """
    now = datetime.utcnow()
    updated = (
        db.query(InAppNotification)
        .filter(
            InAppNotification.user_id == user.id,
            InAppNotification.id.in_(req.notification_ids),
        )
        .update({"is_read": True, "read_at": now}, synchronize_session=False)
    )
    db.commit()

    return {
        "success": True,
        "updated_count": updated,
    }


@router.put("/in-app/read-all")
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    모든 알림 읽음 처리
    """
    now = datetime.utcnow()
    updated = (
        db.query(InAppNotification)
        .filter(InAppNotification.user_id == user.id, InAppNotification.is_read == False)
        .update({"is_read": True, "read_at": now}, synchronize_session=False)
    )
    db.commit()

    return {
        "success": True,
        "updated_count": updated,
    }


@router.delete("/in-app/{notification_id}")
def delete_in_app_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    인앱 알림 삭제
    """
    notification = (
        db.query(InAppNotification)
        .filter(InAppNotification.id == notification_id, InAppNotification.user_id == user.id)
        .first()
    )

    if not notification:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다.")

    db.delete(notification)
    db.commit()

    return {
        "success": True,
        "message": "알림이 삭제되었습니다.",
    }


@router.delete("/in-app")
def clear_all_notifications(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    모든 인앱 알림 삭제
    """
    deleted = (
        db.query(InAppNotification)
        .filter(InAppNotification.user_id == user.id)
        .delete(synchronize_session=False)
    )
    db.commit()

    return {
        "success": True,
        "deleted_count": deleted,
    }
