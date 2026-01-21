from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import FreeTrialApplication, LottoRecommendLog, OpsRequestLog
from app.db.session import get_db
from app.api.auth import get_current_user, require_admin

router = APIRouter()


@router.get("/ops/summary")
def ops_summary(
    db: Session = Depends(get_db),
    user=Depends(require_admin),
) -> dict:
    total_apps = db.query(func.count(FreeTrialApplication.id)).scalar() or 0
    sent_apps = (
        db.query(func.count(FreeTrialApplication.id))
        .filter(FreeTrialApplication.status == "sent")
        .scalar()
        or 0
    )
    failed_apps = (
        db.query(func.count(FreeTrialApplication.id))
        .filter(FreeTrialApplication.status == "failed")
        .scalar()
        or 0
    )
    pending_apps = (
        db.query(func.count(FreeTrialApplication.id))
        .filter(FreeTrialApplication.status == "pending")
        .scalar()
        or 0
    )
    total_logs = db.query(func.count(LottoRecommendLog.id)).scalar() or 0

    latest_app = (
        db.query(func.max(FreeTrialApplication.created_at)).scalar()
        if total_apps
        else None
    )
    now = datetime.utcnow()
    last_24h = now - timedelta(hours=24)
    last_7d = now - timedelta(days=7)
    apps_24h = (
        db.query(func.count(FreeTrialApplication.id))
        .filter(FreeTrialApplication.created_at >= last_24h)
        .scalar()
        or 0
    )
    apps_7d = (
        db.query(func.count(FreeTrialApplication.id))
        .filter(FreeTrialApplication.created_at >= last_7d)
        .scalar()
        or 0
    )

    latest_apps = (
        db.query(FreeTrialApplication)
        .order_by(FreeTrialApplication.created_at.desc())
        .limit(5)
        .all()
    )
    latest_items = [
        {
            "name": app.name,
            "phone": f"{app.phone[:3]}****{app.phone[-4:]}" if app.phone and len(app.phone) >= 7 else "-",
            "status": app.status,
            "created_at": app.created_at,
        }
        for app in latest_apps
    ]

    return {
        "applications": {
            "total": total_apps,
            "sent": sent_apps,
            "failed": failed_apps,
            "pending": pending_apps,
            "last_24h": apps_24h,
            "last_7d": apps_7d,
            "latest_created_at": latest_app,
        },
        "recommend_logs": {
            "total": total_logs,
        },
        "latest_applications": latest_items,
    }


@router.get("/ops/metrics")
def ops_metrics(
    db: Session = Depends(get_db),
    user=Depends(require_admin),
) -> dict:
    now = datetime.utcnow()
    since = now - timedelta(hours=24)

    logs = (
        db.query(OpsRequestLog)
        .filter(OpsRequestLog.created_at >= since)
        .order_by(OpsRequestLog.created_at.desc())
        .all()
    )
    total = len(logs)
    errors = [log for log in logs if log.is_error]
    durations = [log.duration_ms for log in logs]
    avg_ms = int(sum(durations) / len(durations)) if durations else 0
    p95_ms = 0
    if durations:
        sorted_durations = sorted(durations)
        index = int(round(0.95 * (len(sorted_durations) - 1)))
        p95_ms = int(sorted_durations[index])

    top_paths = (
        db.query(OpsRequestLog.method, OpsRequestLog.path, func.count(OpsRequestLog.id))
        .filter(OpsRequestLog.created_at >= since)
        .group_by(OpsRequestLog.method, OpsRequestLog.path)
        .order_by(func.count(OpsRequestLog.id).desc())
        .limit(5)
        .all()
    )
    top_items = [
        {"method": row[0], "path": row[1], "count": row[2]} for row in top_paths
    ]

    recent_errors = [
        {
            "method": log.method,
            "path": log.path,
            "status": log.status_code,
            "created_at": log.created_at,
        }
        for log in errors[:5]
    ]
    error_rate = int((len(errors) / total) * 100) if total else 0

    return {
        "window": {"from": since, "to": now},
        "totals": {
            "requests": total,
            "errors": len(errors),
            "error_rate": error_rate,
            "avg_ms": avg_ms,
            "p95_ms": p95_ms,
        },
        "top_paths": top_items,
        "recent_errors": recent_errors,
    }
