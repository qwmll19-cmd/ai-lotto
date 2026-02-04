"""웹 푸시 알림 서비스 (Phase 6)"""
import json
import logging
import os
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy.orm import Session
from app.utils import now_kst

try:
    from pywebpush import webpush, WebPushException
    WEBPUSH_AVAILABLE = True
except ImportError:
    WEBPUSH_AVAILABLE = False

from app.db.models import WebPushSubscription, NotificationLog, User

logger = logging.getLogger("notification_service")

# VAPID 설정
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:admin@ai-lotto.com")


class NotificationService:
    """웹 푸시 알림 서비스"""

    @staticmethod
    def subscribe(
        db: Session,
        user_id: int,
        endpoint: str,
        p256dh_key: str,
        auth_key: str,
        user_agent: Optional[str] = None,
    ) -> Dict:
        """
        푸시 알림 구독 등록/업데이트

        Args:
            db: DB 세션
            user_id: 사용자 ID
            endpoint: 푸시 endpoint URL
            p256dh_key: encryption key
            auth_key: auth secret
            user_agent: 브라우저 정보

        Returns:
            구독 정보
        """
        # 기존 구독 확인 (endpoint 기준)
        existing = db.query(WebPushSubscription).filter(
            WebPushSubscription.endpoint == endpoint
        ).first()

        if existing:
            # 같은 유저면 업데이트
            if existing.user_id == user_id:
                existing.p256dh_key = p256dh_key
                existing.auth_key = auth_key
                existing.is_active = True
                existing.updated_at = now_kst()
                db.commit()
                return {"success": True, "message": "구독이 업데이트되었습니다.", "subscription_id": existing.id}
            else:
                # 다른 유저의 구독이면 삭제 후 새로 등록
                db.delete(existing)

        # 새 구독 등록
        subscription = WebPushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            p256dh_key=p256dh_key,
            auth_key=auth_key,
            user_agent=user_agent,
        )
        db.add(subscription)
        db.commit()

        logger.info(f"New push subscription for user {user_id}")

        return {"success": True, "message": "푸시 알림이 활성화되었습니다.", "subscription_id": subscription.id}

    @staticmethod
    def unsubscribe(db: Session, user_id: int, endpoint: str) -> Dict:
        """
        푸시 알림 구독 해제

        Args:
            db: DB 세션
            user_id: 사용자 ID
            endpoint: 푸시 endpoint URL

        Returns:
            결과
        """
        subscription = db.query(WebPushSubscription).filter(
            WebPushSubscription.user_id == user_id,
            WebPushSubscription.endpoint == endpoint
        ).first()

        if not subscription:
            return {"success": False, "message": "구독을 찾을 수 없습니다."}

        subscription.is_active = False
        subscription.updated_at = now_kst()
        db.commit()

        logger.info(f"Push subscription deactivated for user {user_id}")

        return {"success": True, "message": "푸시 알림이 비활성화되었습니다."}

    @staticmethod
    def update_preferences(
        db: Session,
        user_id: int,
        notify_draw_result: Optional[bool] = None,
        notify_recommendation: Optional[bool] = None,
        notify_subscription: Optional[bool] = None,
    ) -> Dict:
        """
        알림 설정 업데이트

        Args:
            db: DB 세션
            user_id: 사용자 ID
            notify_draw_result: 당첨 결과 알림
            notify_recommendation: 추천 번호 알림
            notify_subscription: 구독 알림

        Returns:
            업데이트된 설정
        """
        subscriptions = db.query(WebPushSubscription).filter(
            WebPushSubscription.user_id == user_id,
            WebPushSubscription.is_active == True
        ).all()

        if not subscriptions:
            return {"success": False, "message": "활성화된 구독이 없습니다."}

        for sub in subscriptions:
            if notify_draw_result is not None:
                sub.notify_draw_result = notify_draw_result
            if notify_recommendation is not None:
                sub.notify_recommendation = notify_recommendation
            if notify_subscription is not None:
                sub.notify_subscription = notify_subscription
            sub.updated_at = now_kst()

        db.commit()

        return {
            "success": True,
            "message": "알림 설정이 업데이트되었습니다.",
            "settings": {
                "notify_draw_result": subscriptions[0].notify_draw_result,
                "notify_recommendation": subscriptions[0].notify_recommendation,
                "notify_subscription": subscriptions[0].notify_subscription,
            }
        }

    @staticmethod
    def get_user_subscriptions(db: Session, user_id: int) -> List[Dict]:
        """
        사용자의 푸시 구독 목록 조회

        Args:
            db: DB 세션
            user_id: 사용자 ID

        Returns:
            구독 목록
        """
        subscriptions = db.query(WebPushSubscription).filter(
            WebPushSubscription.user_id == user_id
        ).all()

        return [{
            "id": sub.id,
            "endpoint": sub.endpoint[:50] + "..." if len(sub.endpoint) > 50 else sub.endpoint,
            "is_active": sub.is_active,
            "notify_draw_result": sub.notify_draw_result,
            "notify_recommendation": sub.notify_recommendation,
            "notify_subscription": sub.notify_subscription,
            "user_agent": sub.user_agent,
            "created_at": sub.created_at.isoformat() if sub.created_at else None,
        } for sub in subscriptions]

    @staticmethod
    def log_notification(
        db: Session,
        user_id: Optional[int],
        notification_type: str,
        title: str,
        body: str,
        channel: str = "web_push",
        data: Optional[Dict] = None,
        status: str = "pending",
    ) -> NotificationLog:
        """
        알림 로그 기록

        Args:
            db: DB 세션
            user_id: 사용자 ID (None이면 전체 알림)
            notification_type: 알림 유형
            title: 제목
            body: 내용
            channel: 채널 (web_push, email, sms)
            data: 추가 데이터
            status: 상태

        Returns:
            알림 로그
        """
        log = NotificationLog(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
            channel=channel,
            data=data,
            status=status,
        )
        db.add(log)
        db.commit()

        return log

    @staticmethod
    def update_notification_status(
        db: Session,
        log_id: int,
        status: str,
        error_message: Optional[str] = None,
    ) -> None:
        """알림 상태 업데이트"""
        log = db.query(NotificationLog).filter(NotificationLog.id == log_id).first()
        if log:
            log.status = status
            if status == "sent":
                log.sent_at = now_kst()
            if error_message:
                log.error_message = error_message
            db.commit()

    @staticmethod
    def get_notification_history(
        db: Session,
        user_id: int,
        limit: int = 20,
    ) -> List[Dict]:
        """
        사용자의 알림 히스토리 조회

        Args:
            db: DB 세션
            user_id: 사용자 ID
            limit: 최대 개수

        Returns:
            알림 목록
        """
        logs = db.query(NotificationLog).filter(
            NotificationLog.user_id == user_id
        ).order_by(NotificationLog.created_at.desc()).limit(limit).all()

        return [{
            "id": log.id,
            "type": log.notification_type,
            "title": log.title,
            "body": log.body,
            "data": log.data,
            "status": log.status,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "sent_at": log.sent_at.isoformat() if log.sent_at else None,
        } for log in logs]

    @staticmethod
    def create_new_draw_announcement(draw_no: int) -> Dict:
        """새 회차 발표 알림 (당첨 결과 확인 유도)"""
        return {
            "title": f"🎱 {draw_no}회 당첨 번호 발표!",
            "body": "내 번호가 당첨되었는지 확인해보세요!",
            "data": {
                "type": "new_draw",
                "draw_no": draw_no,
                "url": "/mypage",
            }
        }

    @staticmethod
    def create_draw_result_notification(draw_no: int, winning_numbers: List[int], bonus: int) -> Dict:
        """당첨 결과 알림 내용 생성 (사용자가 확인 후 전송)"""
        numbers_str = " ".join(str(n) for n in winning_numbers)
        return {
            "title": f"🎱 {draw_no}회 당첨 결과",
            "body": f"당첨 번호: {numbers_str} + {bonus}",
            "data": {
                "type": "draw_result",
                "draw_no": draw_no,
                "url": f"/history?draw_no={draw_no}",
            }
        }

    @staticmethod
    def create_recommendation_notification(draw_no: int) -> Dict:
        """새 추천 번호 알림 내용 생성"""
        return {
            "title": f"✨ {draw_no}회 추천 번호 준비 완료",
            "body": "AI가 분석한 새로운 추천 번호가 준비되었습니다.",
            "data": {
                "type": "recommendation",
                "draw_no": draw_no,
                "url": "/recommend",
            }
        }

    @staticmethod
    def create_subscription_expiry_notification(days_left: int, plan_type: str) -> Dict:
        """구독 만료 예정 알림 내용 생성"""
        if days_left <= 0:
            return {
                "title": "📅 구독이 만료되었습니다",
                "body": f"{plan_type} 플랜이 만료되었습니다. 계속 이용하시려면 갱신해주세요.",
                "data": {
                    "type": "subscription_expired",
                    "url": "/pricing",
                }
            }
        else:
            return {
                "title": f"📅 구독 만료 {days_left}일 전",
                "body": f"{plan_type} 플랜이 {days_left}일 후 만료됩니다.",
                "data": {
                    "type": "subscription_expiring",
                    "days_left": days_left,
                    "url": "/mypage?tab=subscription",
                }
            }

    # =========================================
    # 실제 푸시 전송 기능
    # =========================================

    @staticmethod
    def _send_single_push(subscription: WebPushSubscription, payload: Dict) -> bool:
        """
        단일 구독에 푸시 전송

        Args:
            subscription: 푸시 구독 정보
            payload: 전송할 데이터

        Returns:
            성공 여부
        """
        if not WEBPUSH_AVAILABLE:
            logger.warning("pywebpush not installed, skipping push notification")
            return False

        if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
            logger.warning("VAPID keys not configured, skipping push notification")
            return False

        try:
            subscription_info = {
                "endpoint": subscription.endpoint,
                "keys": {
                    "p256dh": subscription.p256dh_key,
                    "auth": subscription.auth_key,
                }
            }

            webpush(
                subscription_info=subscription_info,
                data=json.dumps(payload),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
            )
            return True

        except WebPushException as e:
            logger.error(f"Push failed for subscription {subscription.id}: {e}")
            # 410 Gone = 구독 만료
            if e.response and e.response.status_code == 410:
                subscription.is_active = False
            return False
        except Exception as e:
            logger.error(f"Unexpected push error: {e}")
            return False

    @staticmethod
    def send_push_to_user(
        db: Session,
        user_id: int,
        notification_type: str,
        title: str,
        body: str,
        data: Optional[Dict] = None,
    ) -> Dict:
        """
        특정 사용자에게 푸시 전송

        Args:
            db: DB 세션
            user_id: 사용자 ID
            notification_type: 알림 유형
            title: 제목
            body: 내용
            data: 추가 데이터

        Returns:
            전송 결과
        """
        subscriptions = db.query(WebPushSubscription).filter(
            WebPushSubscription.user_id == user_id,
            WebPushSubscription.is_active == True
        ).all()

        if not subscriptions:
            return {"success": False, "sent": 0, "failed": 0, "message": "No active subscriptions"}

        payload = {
            "title": title,
            "body": body,
            "data": data or {},
        }

        sent = 0
        failed = 0

        for sub in subscriptions:
            # 알림 유형에 따른 필터링
            if notification_type == "draw_result" and not sub.notify_draw_result:
                continue
            if notification_type == "recommendation" and not sub.notify_recommendation:
                continue
            if notification_type in ("subscription_expired", "subscription_expiring") and not sub.notify_subscription:
                continue

            if NotificationService._send_single_push(sub, payload):
                sent += 1
            else:
                failed += 1

        # 로그 기록
        NotificationService.log_notification(
            db=db,
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
            data=data,
            status="sent" if sent > 0 else "failed",
        )

        db.commit()

        return {
            "success": sent > 0,
            "sent": sent,
            "failed": failed,
        }

    @staticmethod
    def broadcast_draw_result(
        db: Session,
        draw_no: int,
        winning_numbers: List[int],
        bonus: int,
    ) -> Dict:
        """
        당첨 결과 전체 브로드캐스트

        Args:
            db: DB 세션
            draw_no: 회차 번호
            winning_numbers: 당첨 번호 (6개)
            bonus: 보너스 번호

        Returns:
            전송 결과
        """
        notification = NotificationService.create_draw_result_notification(
            draw_no=draw_no,
            winning_numbers=winning_numbers,
            bonus=bonus,
        )

        # 당첨 결과 알림 활성화된 구독자 조회
        subscriptions = db.query(WebPushSubscription).filter(
            WebPushSubscription.is_active == True,
            WebPushSubscription.notify_draw_result == True
        ).all()

        payload = {
            "title": notification["title"],
            "body": notification["body"],
            "data": notification["data"],
        }

        sent = 0
        failed = 0
        user_ids = set()

        for sub in subscriptions:
            if NotificationService._send_single_push(sub, payload):
                sent += 1
                user_ids.add(sub.user_id)
            else:
                failed += 1

        # 브로드캐스트 로그 (user_id=None)
        NotificationService.log_notification(
            db=db,
            user_id=None,
            notification_type="draw_result",
            title=notification["title"],
            body=notification["body"],
            data={
                **notification["data"],
                "broadcast": True,
                "sent_count": sent,
                "user_count": len(user_ids),
            },
            status="sent" if sent > 0 else "failed",
        )

        db.commit()

        logger.info(f"Draw result broadcast: {sent} sent, {failed} failed, {len(user_ids)} users")

        return {
            "success": sent > 0,
            "sent": sent,
            "failed": failed,
            "user_count": len(user_ids),
        }

    @staticmethod
    def broadcast_new_draw_announcement(db: Session, draw_no: int) -> Dict:
        """
        새 회차 발표 알림 브로드캐스트 (당첨 결과 확인 유도)

        Args:
            db: DB 세션
            draw_no: 회차 번호

        Returns:
            전송 결과
        """
        notification = NotificationService.create_new_draw_announcement(draw_no)

        # 당첨 결과 알림 활성화된 구독자 조회
        subscriptions = db.query(WebPushSubscription).filter(
            WebPushSubscription.is_active == True,
            WebPushSubscription.notify_draw_result == True
        ).all()

        payload = {
            "title": notification["title"],
            "body": notification["body"],
            "data": notification["data"],
        }

        sent = 0
        failed = 0
        user_ids = set()

        for sub in subscriptions:
            if NotificationService._send_single_push(sub, payload):
                sent += 1
                user_ids.add(sub.user_id)
            else:
                failed += 1

        # 브로드캐스트 로그
        NotificationService.log_notification(
            db=db,
            user_id=None,
            notification_type="new_draw",
            title=notification["title"],
            body=notification["body"],
            data={
                **notification["data"],
                "broadcast": True,
                "sent_count": sent,
                "user_count": len(user_ids),
            },
            status="sent" if sent > 0 else "failed",
        )

        db.commit()

        logger.info(f"New draw announcement: {sent} sent, {failed} failed, {len(user_ids)} users")

        return {
            "success": sent > 0,
            "sent": sent,
            "failed": failed,
            "user_count": len(user_ids),
        }
