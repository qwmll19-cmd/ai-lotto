from __future__ import annotations

import json
import logging
import random
from datetime import datetime
from typing import List, Optional, Set, Tuple

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, validator
from sqlalchemy.orm import Session

from app.db.models import FreeTrialApplication, LottoDraw, LottoRecommendLog
from app.db.session import get_db
from app.services.lotto import build_stats_from_draws, format_line, validate_phone, draws_to_dict_list, get_next_draw_no
from app.services.lotto.generator import generate_mixed_line
from app.services.sms import SmsSendRequest, get_sms_client
from app.rate_limit import limiter

router = APIRouter()
logger = logging.getLogger("free_trial")


class ApplyFreeTrialRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=8, max_length=30)
    combo_count: int = Field(..., ge=1, le=50)
    consent_terms: bool = Field(..., description="Required terms consent")
    consent_marketing: bool = Field(False, description="Optional marketing consent")

    @validator("phone")
    def validate_phone_field(cls, value: str) -> str:
        return validate_phone(value)


class ApplyFreeTrialResponse(BaseModel):
    message: str
    application_id: int
    combinations: List[str]


def _random_lines(count: int, existing: Optional[Set[Tuple[int, ...]]] = None) -> List[List[int]]:
    lines: List[List[int]] = []
    seen = set(existing or set())
    while len(lines) < count:
        combo = tuple(sorted(random.sample(range(1, 46), 6)))
        if combo in seen:
            continue
        seen.add(combo)
        lines.append(list(combo))
    return lines


def _get_user_issue_count(db: Session, phone: str) -> int:
    """해당 전화번호의 누적 발급 횟수 조회"""
    count = db.query(FreeTrialApplication).filter(
        FreeTrialApplication.phone == phone,
        FreeTrialApplication.status == "sent"
    ).count()
    return count


def _generate_lines(db: Session, phone: str, combo_count: int) -> List[List[int]]:
    """
    무료 버전 번호 생성
    - 4번 무료 → 1번 유료 (5번째마다 유료)
    """
    draws = db.query(LottoDraw).order_by(LottoDraw.draw_no).all()
    if not draws:
        return _random_lines(combo_count)

    stats = build_stats_from_draws(draws_to_dict_list(draws))

    # 기존 발급 횟수 조회
    base_count = _get_user_issue_count(db, phone)

    # combo_count만큼 번호 생성 (각각 issue_count 증가)
    lines: List[List[int]] = []
    for i in range(combo_count):
        issue_count = base_count + i + 1  # 1부터 시작
        line = generate_mixed_line(stats, issue_count)
        lines.append(line)

    return lines


@router.post("/api/apply-free-trial", response_model=ApplyFreeTrialResponse)
def apply_free_trial(payload: ApplyFreeTrialRequest, db: Session = Depends(get_db)) -> ApplyFreeTrialResponse:
    if not payload.consent_terms:
        raise HTTPException(status_code=400, detail="약관 동의가 필요합니다.")

    try:
        application = FreeTrialApplication(
            name=payload.name,
            phone=payload.phone,
            combo_count=payload.combo_count,
            status="pending",
            consent_terms=payload.consent_terms,
            consent_marketing=payload.consent_marketing,
        )
        db.add(application)
        db.commit()
        db.refresh(application)

        lines = _generate_lines(db, payload.phone, payload.combo_count)
        formatted_lines = [format_line(line) for line in lines]

        message_body = "팡팡로또 무료체험 번호입니다.\n" + "\n".join(
            f"{idx + 1}) {line}" for idx, line in enumerate(formatted_lines)
        )
        sms_client = get_sms_client()
        sms_result = sms_client.send(
            SmsSendRequest(
                to=payload.phone,
                content=message_body,
            )
        )

        application.status = "sent" if sms_result.success else "failed"
        db.add(application)

        recommend_log = LottoRecommendLog(
            user_id=application.id,
            account_user_id=None,
            target_draw_no=get_next_draw_no(db),
            lines=json.dumps(formatted_lines, ensure_ascii=False),
            recommend_time=datetime.utcnow(),
            match_results=None,
            plan_type="free",
            is_matched=False,
        )
        db.add(recommend_log)
        db.commit()

        logger.info(
            "apply_free_trial status=%s app_id=%s combo_count=%s",
            application.status,
            application.id,
            payload.combo_count,
        )
    except Exception as exc:
        db.rollback()
        logger.exception("apply_free_trial failed: %s", exc)
        raise HTTPException(status_code=500, detail="처리 중 오류가 발생했습니다.") from exc

    if sms_result.success:
        message = "신청이 완료되었습니다. AI 추천 번호를 곧 보내드립니다."
    else:
        message = "신청은 접수되었지만 문자 발송에 실패했습니다. 잠시 후 다시 시도하세요."

    return ApplyFreeTrialResponse(
        message=message,
        application_id=application.id,
        combinations=formatted_lines,
    )
