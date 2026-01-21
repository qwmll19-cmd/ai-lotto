import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from backend.app.api.auth import get_current_user
from backend.app.db.models import LottoDraw, LottoRecommendLog, LottoStatsCache
from backend.app.db.session import get_db
from backend.app.services.lotto import build_stats_from_draws, draws_to_dict_list, LottoStatsCalculator, PoolService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/lotto", tags=["lotto"])


class ApiResponse:
    @staticmethod
    def items(items: List[dict]) -> dict:
        return {"items": items}


def _parse_json(value, context: str = ""):
    if value is None:
        return None
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except json.JSONDecodeError as e:
        logger.warning(f"JSON 파싱 실패 {context}: {e}")
        return None


def _recent_draws(db: Session, limit: int):
    return db.query(LottoDraw).order_by(desc(LottoDraw.draw_no)).limit(limit).all()


# 플랜별 히스토리 조회 기간 (일)
HISTORY_RETENTION_DAYS = {
    "free": 14,      # 2주
    "basic": 30,     # 30일
    "premium": 60,   # 60일
    "vip": 90,       # 90일
}


def _draws_to_numbers(draws: List[LottoDraw]):
    for draw in draws:
        yield [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6]


@router.get("/stats/overview")
def stats_overview(db: Session = Depends(get_db)):
    cache = db.query(LottoStatsCache).first()
    total_draws = cache.total_draws if cache else db.query(LottoDraw).count()
    most_common = []
    if cache:
        parsed = _parse_json(cache.most_common) or []
        most_common = parsed[:3]

    recent = _recent_draws(db, 50)
    odd_even = [0, 0]
    sums = []
    for numbers in _draws_to_numbers(recent):
        odd_even[0] += sum(1 for n in numbers if n % 2 == 1)
        odd_even[1] += sum(1 for n in numbers if n % 2 == 0)
        sums.append(sum(numbers))

    avg_sum = int(sum(sums) / len(sums)) if sums else 0
    odd_even_summary = "홀짝 3:3"
    if sum(odd_even) > 0:
        odd_ratio = round(odd_even[0] / sum(odd_even) * 6)
        even_ratio = 6 - odd_ratio
        odd_even_summary = f"홀짝 {odd_ratio}:{even_ratio}"

    top_numbers = " · ".join(str(n) for n in most_common) if most_common else "-"

    items = [
        {
            "id": "draws",
            "title": "누적 회차 수",
            "value": f"{total_draws}회",
            "hint": "최신 회차 기준",
        },
        {
            "id": "top",
            "title": "최다 출현 번호",
            "value": top_numbers,
            "hint": "최근 200회",
        },
        {
            "id": "pattern",
            "title": "최근 패턴 요약",
            "value": odd_even_summary,
            "hint": f"평균 합계 {avg_sum}",
        },
    ]
    return ApiResponse.items(items)


@router.get("/stats/highlights")
def stats_highlights(db: Session = Depends(get_db)):
    recent = _recent_draws(db, 50)
    recent_10 = recent[:10]

    consecutive_hits = 0
    for numbers in _draws_to_numbers(recent_10):
        numbers = sorted(numbers)
        if any(numbers[i + 1] - numbers[i] == 1 for i in range(len(numbers) - 1)):
            consecutive_hits += 1

    range_count = 0
    total_numbers = 0
    for numbers in _draws_to_numbers(recent):
        total_numbers += len(numbers)
        range_count += sum(1 for n in numbers if 1 <= n <= 20)

    range_ratio = round(range_count / total_numbers * 100) if total_numbers else 0

    bonus_draws = _recent_draws(db, 100)
    bonus_counts = {}
    for draw in bonus_draws:
        bonus_counts[draw.bonus] = bonus_counts.get(draw.bonus, 0) + 1
    top_bonus = sorted(bonus_counts.items(), key=lambda x: x[1], reverse=True)[:3]
    bonus_numbers = " · ".join(str(n) for n, _ in top_bonus) if top_bonus else "-"

    items = [
        {
            "id": "streak",
            "title": "최근 10회 연속번호 등장",
            "value": f"{consecutive_hits}회",
            "trend": "상승" if consecutive_hits >= 5 else "보통",
        },
        {
            "id": "range",
            "title": "고빈도 구간(1~20)",
            "value": f"{range_ratio}%",
            "trend": "보통" if 45 <= range_ratio <= 60 else "변동",
        },
        {
            "id": "bonus",
            "title": "보너스 상위 번호",
            "value": bonus_numbers,
            "trend": "강세" if bonus_numbers != "-" else "-",
        },
    ]
    return ApiResponse.items(items)


@router.get("/stats/number")
def stats_numbers(db: Session = Depends(get_db)):
    draws = db.query(LottoDraw).all()
    counts = {}
    for numbers in _draws_to_numbers(draws):
        for n in numbers:
            counts[n] = counts.get(n, 0) + 1

    top = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:6]
    items = [{"number": num, "count": count} for num, count in top]
    return ApiResponse.items(items)


@router.get("/stats/patterns")
def stats_patterns(db: Session = Depends(get_db)):
    draws = _recent_draws(db, 100)
    if not draws:
        return ApiResponse.items([])

    odd = 0
    even = 0
    sums = []
    consecutive = 0
    for numbers in _draws_to_numbers(draws):
        odd += sum(1 for n in numbers if n % 2 == 1)
        even += sum(1 for n in numbers if n % 2 == 0)
        sums.append(sum(numbers))
        numbers = sorted(numbers)
        if any(numbers[i + 1] - numbers[i] == 1 for i in range(len(numbers) - 1)):
            consecutive += 1

    total = odd + even
    odd_ratio = round(odd / total * 6) if total else 3
    even_ratio = 6 - odd_ratio
    avg_sum = int(sum(sums) / len(sums)) if sums else 0
    consecutive_ratio = round(consecutive / len(draws) * 100)

    items = [
        {
            "title": "홀짝 비율",
            "value": f"{odd_ratio}:{even_ratio}",
            "numeric_value": odd_ratio,
            "detail": "최근 100회 평균",
        },
        {
            "title": "합계 평균",
            "value": f"{avg_sum}",
            "numeric_value": avg_sum,
            "detail": "주요 구간 130~160",
        },
        {
            "title": "연속 번호",
            "value": f"{consecutive_ratio}%",
            "numeric_value": consecutive_ratio,
            "detail": "연속 1쌍 이상",
        },
    ]
    return ApiResponse.items(items)


@router.get("/history")
def history(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    q: Optional[str] = Query(default=None),
    ai: str = Query(default="all"),
    sort: str = Query(default="desc"),
    limit: int = Query(default=100, ge=1, le=500),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
):
    # 플랜별 히스토리 조회 기간 제한
    user_plan = (user.subscription_type or "free").lower()
    retention_days = HISTORY_RETENTION_DAYS.get(user_plan, 14)
    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
    cutoff_date_str = cutoff_date.strftime("%Y-%m-%d")

    # 기간 내 추첨 데이터만 조회
    draws = (
        db.query(LottoDraw)
        .filter(LottoDraw.draw_date >= cutoff_date_str)
        .order_by(desc(LottoDraw.draw_no))
        .limit(limit)
        .all()
    )
    if not draws:
        return {"items": [], "meta": {"total": 0, "page": page, "page_size": page_size, "retention_days": retention_days}}

    draw_nos = [d.draw_no for d in draws]
    logs = (
        db.query(LottoRecommendLog)
        .filter(LottoRecommendLog.account_user_id == user.id)
        .filter(LottoRecommendLog.target_draw_no.in_(draw_nos))
        .all()
    )
    log_map = {log.target_draw_no: log for log in logs}

    items = []
    for draw in draws:
        log = log_map.get(draw.draw_no)
        has_ai = log is not None
        winning_numbers = [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6]
        numbers = ", ".join(str(n) for n in winning_numbers)
        if ai == "yes" and not has_ai:
            continue
        if ai == "no" and has_ai:
            continue
        if q:
            keyword = q.strip()
            if keyword and keyword not in numbers and keyword not in str(draw.draw_no):
                continue

        # 사용자 추천 번호 및 매칭 결과 추출
        my_lines = None
        match_results = None
        if log:
            my_lines = _parse_json(log.lines, "history_lines")
            match_results = _parse_json(log.match_results, "history_match")
            logger.info(f"[History] draw_no={draw.draw_no}, my_lines count={len(my_lines) if my_lines else 0}")

        items.append(
            {
                "round": draw.draw_no,
                "numbers": winning_numbers,
                "bonus": draw.bonus,
                "ai": "추천 있음" if has_ai else "추천 없음",
                "date": draw.draw_date,
                "my_lines": my_lines,
                "match_results": match_results,
            }
        )
    if sort == "asc":
        items.sort(key=lambda row: row["round"])
    else:
        items.sort(key=lambda row: row["round"], reverse=True)

    total = len(items)
    start = (page - 1) * page_size
    paged_items = items[start:start + page_size]
    return {
        "items": paged_items,
        "meta": {
            "total": total,
            "page": page,
            "page_size": page_size,
            "retention_days": retention_days,
            "plan": user_plan.upper(),
        }
    }


@router.get("/history/public")
def history_public(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(default=None),
    sort: str = Query(default="desc"),
    limit: int = Query(default=100, ge=1, le=500),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
):
    draws = _recent_draws(db, limit)
    items = []
    for draw in draws:
        numbers = ", ".join(str(n) for n in [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6])
        if q:
            keyword = q.strip()
            if keyword and keyword not in numbers and keyword not in str(draw.draw_no):
                continue
        items.append(
            {
                "round": draw.draw_no,
                "numbers": numbers,
                "bonus": draw.bonus,
                "ai": "공개",
                "date": draw.draw_date,
            }
        )
    if sort == "asc":
        items.sort(key=lambda row: row["round"])
    else:
        items.sort(key=lambda row: row["round"], reverse=True)
    total = len(items)
    start = (page - 1) * page_size
    paged_items = items[start:start + page_size]
    return {"items": paged_items, "meta": {"total": total, "page": page, "page_size": page_size}}


@router.get("/mypage/summary")
def mypage_summary(db: Session = Depends(get_db), user=Depends(get_current_user)):
    now = datetime.utcnow()
    recent_cutoff = now - timedelta(days=28)

    total_recent = (
        db.query(LottoRecommendLog)
        .filter(LottoRecommendLog.account_user_id == user.id)
        .filter(LottoRecommendLog.recommend_time >= recent_cutoff)
        .count()
    )

    latest = (
        db.query(LottoRecommendLog)
        .filter(LottoRecommendLog.account_user_id == user.id)
        .order_by(desc(LottoRecommendLog.id))
        .first()
    )
    line_count = 0
    if latest:
        parsed = _parse_json(latest.lines, "mypage_summary")
        line_count = len(parsed) if parsed else 0

    items = [
        {"id": "weekly", "label": "이번 회차 추천", "value": f"{line_count}줄"},
        {"id": "month", "label": "최근 4주 추천", "value": f"{total_recent}줄"},
        {"id": "hit", "label": "평균 적중", "value": "-"},
    ]
    return ApiResponse.items(items)


@router.get("/mypage/lines")
def mypage_lines(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """
    내 조합 페이지용 데이터 조회
    - 현재 회차 발급 번호
    - 이전 회차 결과 (당첨번호 + 내 번호 + 매칭 결과)
    """
    # 현재 회차 번호 (최신 추첨 + 1)
    latest_draw = db.query(LottoDraw).order_by(desc(LottoDraw.draw_no)).first()
    current_draw_no = (latest_draw.draw_no + 1) if latest_draw else 1
    prev_draw_no = latest_draw.draw_no if latest_draw else None

    # 현재 회차 추천 로그
    current_log = (
        db.query(LottoRecommendLog)
        .filter(
            LottoRecommendLog.account_user_id == user.id,
            LottoRecommendLog.target_draw_no == current_draw_no,
        )
        .first()
    )

    # 이전 회차 추천 로그 (결과 확인용)
    # 여러 플랜 로그가 있을 수 있으므로 가장 줄 수가 많은 것을 선택
    prev_log = None
    previous_draw = None
    if prev_draw_no:
        prev_logs = (
            db.query(LottoRecommendLog)
            .filter(
                LottoRecommendLog.account_user_id == user.id,
                LottoRecommendLog.target_draw_no == prev_draw_no,
            )
            .all()
        )

        # 가장 줄 수가 많은 로그 선택
        max_lines_count = 0
        for log in prev_logs:
            log_lines = _parse_json(log.lines, "log_lines") or []
            # pool_lines가 있으면 그것을 사용 (전체 발급 번호)
            if log.pool_lines:
                pool = log.pool_lines if isinstance(log.pool_lines, list) else _parse_json(log.pool_lines, "pool") or []
                if len(pool) > max_lines_count:
                    max_lines_count = len(pool)
                    prev_log = log
            elif len(log_lines) > max_lines_count:
                max_lines_count = len(log_lines)
                prev_log = log

        if prev_log:
            # pool_lines가 있으면 전체 번호 사용, 없으면 lines 사용
            if prev_log.pool_lines:
                prev_lines = prev_log.pool_lines if isinstance(prev_log.pool_lines, list) else _parse_json(prev_log.pool_lines, "prev_pool") or []
            else:
                prev_lines = _parse_json(prev_log.lines, "prev_lines") or []
            prev_match = _parse_json(prev_log.match_results, "prev_match")

            # 이전 회차 당첨번호
            prev_draw_data = db.query(LottoDraw).filter(LottoDraw.draw_no == prev_draw_no).first()
            winning_numbers = []
            bonus = None
            draw_date = None
            if prev_draw_data:
                winning_numbers = [
                    prev_draw_data.n1, prev_draw_data.n2, prev_draw_data.n3,
                    prev_draw_data.n4, prev_draw_data.n5, prev_draw_data.n6
                ]
                bonus = prev_draw_data.bonus
                draw_date = prev_draw_data.draw_date

            previous_draw = {
                "draw_no": prev_draw_no,
                "draw_date": draw_date,
                "winning_numbers": winning_numbers,
                "bonus": bonus,
                "my_lines": prev_lines,
                "match_results": prev_match,
                "has_data": len(prev_lines) > 0,
            }

    # 현재 회차 데이터
    current_lines = []
    if current_log:
        current_lines = _parse_json(current_log.lines, "current_lines") or []

    return {
        "items": current_lines,
        "target_draw_no": current_draw_no,
        "previous_draw": previous_draw,
    }


@router.get("/latest")
def latest_draw(db: Session = Depends(get_db)):
    draw = db.query(LottoDraw).order_by(desc(LottoDraw.draw_no)).first()
    if not draw:
        return {
            "draw_no": None,
            "numbers": [],
            "bonus": None,
            "draw_date": None,
        }

    numbers = [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6]
    return {
        "draw_no": draw.draw_no,
        "numbers": numbers,
        "bonus": draw.bonus,
        "draw_date": draw.draw_date,
    }


def _get_week_start():
    """현재 주의 시작일 (월요일 00:00) 반환"""
    now = datetime.utcnow()
    days_since_monday = now.weekday()
    week_start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days_since_monday)
    return week_start


def _generate_free_line(db: Session):
    """
    무료 버전 1줄 생성
    - ML 상위 3개 (점수 제일 높은 번호)
    - 무작위 번호 2개
    - 제일 안 나온 번호 5개 중 1개 랜덤
    """
    import random

    # 전체 회차 데이터 가져오기 (1회~최신)
    draws = db.query(LottoDraw).order_by(desc(LottoDraw.draw_no)).all()
    if not draws:
        return sorted(random.sample(range(1, 46), 6))

    draws_data = draws_to_dict_list(draws)

    # 4가지 로직 점수 계산
    scores1 = LottoStatsCalculator.calculate_ai_scores_logic1(draws_data)
    scores2 = LottoStatsCalculator.calculate_ai_scores_logic2(draws_data)
    scores3 = LottoStatsCalculator.calculate_ai_scores_logic3(draws_data)
    _, least_common = LottoStatsCalculator.calculate_most_least(draws_data)

    # ML 종합 점수 계산
    scores_final = {}
    for n in range(1, 46):
        scores_final[n] = (
            scores1.get(n, 0) * 0.33 +
            scores2.get(n, 0) * 0.33 +
            scores3.get(n, 0) * 0.34
        )

    # 점수 상위 번호 추출
    sorted_numbers = sorted(scores_final.items(), key=lambda x: x[1], reverse=True)

    # 1. ML 상위 3개
    ml_top_3 = [num for num, _ in sorted_numbers[:3]]

    # 2. 무작위 번호 2개 (ML 상위 3개와 겹치지 않게)
    available_random = [n for n in range(1, 46) if n not in ml_top_3]
    random_2 = random.sample(available_random, 2)

    # 3. 제일 안 나온 번호 5개 중 1개 (이미 선택된 번호와 겹치지 않게)
    selected = set(ml_top_3 + random_2)
    least_5 = [n for n in least_common[:5] if n not in selected]

    if least_5:
        least_1 = [random.choice(least_5)]
    else:
        remaining = [n for n in range(1, 46) if n not in selected]
        least_1 = [random.choice(remaining)]

    # 6개 조합
    result = sorted(ml_top_3 + random_2 + least_1)

    return result


# 플랜별 주간 무료 추천 한도
PLAN_WEEKLY_FREE_LIMIT = {
    "free": 1,
    "basic": 2,
    "premium": 5,
    "vip": 10,
}


@router.post("/recommend/free")
def request_free_recommendation(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """무료 AI 번호 추천 (1줄씩, 주간 한도 있음)"""
    plan_type = (user.subscription_type or "free").lower()
    weekly_limit = PLAN_WEEKLY_FREE_LIMIT.get(plan_type, 1)

    # 첫 주 보너스: 가입 후 7일 이내면 +1줄 추가
    is_first_week = False
    if user.created_at:
        days_since_signup = (datetime.utcnow() - user.created_at).days
        if days_since_signup <= 7:
            is_first_week = True
            weekly_limit += 1

    # 이번 주 사용량 계산
    week_start = _get_week_start()
    weekly_usage = (
        db.query(LottoRecommendLog)
        .filter(LottoRecommendLog.account_user_id == user.id)
        .filter(LottoRecommendLog.plan_type == "free_weekly")
        .filter(LottoRecommendLog.recommend_time >= week_start)
        .count()
    )

    if weekly_usage >= weekly_limit:
        raise HTTPException(
            status_code=400,
            detail=f"이번 주 무료 추천 한도({weekly_limit}줄)를 모두 사용했습니다."
        )

    # 무료 번호 1줄 생성
    line = _generate_free_line(db)

    # 로그 저장
    latest_draw = db.query(LottoDraw).order_by(desc(LottoDraw.draw_no)).first()
    target_draw_no = (latest_draw.draw_no + 1) if latest_draw else 1

    log = LottoRecommendLog(
        user_id=user.id,
        account_user_id=user.id,
        target_draw_no=target_draw_no,
        lines=json.dumps([line]),
        recommend_time=datetime.utcnow(),
        plan_type="free_weekly",
        is_matched=False,
    )
    db.add(log)
    db.commit()

    return {
        "success": True,
        "line": line,
        "target_draw_no": target_draw_no,
        "weekly_used": weekly_usage + 1,
        "weekly_limit": weekly_limit,
        "is_first_week": is_first_week,
    }


@router.get("/recommend/free/status")
def get_free_recommendation_status(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """무료 추천 사용 현황 조회"""
    plan_type = (user.subscription_type or "free").lower()
    weekly_limit = PLAN_WEEKLY_FREE_LIMIT.get(plan_type, 1)

    # 첫 주 보너스 체크
    is_first_week = False
    if user.created_at:
        days_since_signup = (datetime.utcnow() - user.created_at).days
        if days_since_signup <= 7:
            is_first_week = True
            weekly_limit += 1

    # 이번 주 사용량
    week_start = _get_week_start()
    weekly_usage = (
        db.query(LottoRecommendLog)
        .filter(LottoRecommendLog.account_user_id == user.id)
        .filter(LottoRecommendLog.plan_type == "free_weekly")
        .filter(LottoRecommendLog.recommend_time >= week_start)
        .count()
    )

    # 이번 주 받은 번호 목록
    weekly_lines = (
        db.query(LottoRecommendLog)
        .filter(LottoRecommendLog.account_user_id == user.id)
        .filter(LottoRecommendLog.plan_type == "free_weekly")
        .filter(LottoRecommendLog.recommend_time >= week_start)
        .order_by(desc(LottoRecommendLog.recommend_time))
        .all()
    )

    lines = []
    for log in weekly_lines:
        parsed = _parse_json(log.lines, f"free_status_log_{log.id}")
        if parsed:
            lines.extend(parsed)

    return {
        "weekly_used": weekly_usage,
        "weekly_limit": weekly_limit,
        "remaining": max(0, weekly_limit - weekly_usage),
        "is_first_week": is_first_week,
        "lines": lines,
    }


def _build_stats_from_db(db: Session) -> dict:
    """DB에서 로또 데이터를 조회하여 stats 딕셔너리 생성"""
    logger.debug("_build_stats_from_db 시작")
    draws = db.query(LottoDraw).order_by(desc(LottoDraw.draw_no)).all()
    logger.debug(f"draws 조회 완료: {len(draws)}개")
    if not draws:
        return None

    result = build_stats_from_draws(draws_to_dict_list(draws))
    logger.debug("_build_stats_from_db 완료")
    return result


# 플랜별 줄 수 제한
PLAN_LINE_LIMITS = {
    "free": 1,
    "basic": 5,
    "premium": 10,
    "vip": 20,
}


@router.get("/recommend")
def recommend_numbers(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    count: int = Query(default=None, ge=1, le=20),
    check_only: bool = Query(default=False),
):
    """
    AI 기반 로또 번호 추천 (플랜별 차등 로직, 주간 1회 제한)

    - FREE: ML 상위 3개 + 랜덤 2개 + 최소출현 1개 (1줄)
    - BASIC: ML 상위 20개에서 랜덤 (5줄)
    - PREMIUM: 10줄 고정 (상위 15개 5줄 + 상위 10개 4줄 + AI핵심 1줄)
    - VIP: 20줄 고정 (베이직 5 + 프리미엄 10 + 풀커버리지 5)

    check_only=True 시 기존 발급 내역만 조회 (새 번호 발급 안 함)
    """
    import random
    from backend.app.services.lotto.generator import generate_free_line

    plan_type = (user.subscription_type or "free").lower()
    max_lines = PLAN_LINE_LIMITS.get(plan_type, 1)

    # 현재 회차 확인
    latest_draw = db.query(LottoDraw).order_by(desc(LottoDraw.draw_no)).first()
    target_draw_no = (latest_draw.draw_no + 1) if latest_draw else 1

    if plan_type != "free":
        pool_service = PoolService(db)
        if check_only:
            status = pool_service.get_pool_status(
                user_id=user.id,
                target_draw_no=target_draw_no,
                plan_type=plan_type,
            )
            numbers = status.get("revealed_lines", []) if status else []
            if not numbers:
                existing_log = db.query(LottoRecommendLog).filter(
                    LottoRecommendLog.account_user_id == user.id,
                    LottoRecommendLog.target_draw_no == target_draw_no,
                    LottoRecommendLog.plan_type == plan_type,
                ).first()
                numbers = _parse_json(existing_log.lines, "recommend_existing") or [] if existing_log else []
            return {
                "numbers": numbers,
                "target_draw_no": target_draw_no,
                "count": len(numbers),
                "plan_type": plan_type,
                "already_issued": bool(numbers),
                "message": "발급된 번호가 없습니다." if not numbers else f"이번 회차({target_draw_no}회) 번호가 이미 발급되었습니다.",
            }

        result = pool_service.reveal_all_lines(
            user_id=user.id,
            target_draw_no=target_draw_no,
            plan_type=plan_type,
        )
        numbers = result.get("lines", [])
        return {
            "numbers": numbers,
            "target_draw_no": target_draw_no,
            "count": len(numbers),
            "plan_type": plan_type,
            "already_issued": result.get("already_revealed", False),
            "message": "이미 발급된 번호입니다." if result.get("already_revealed") else f"{target_draw_no}회 AI 추천 번호가 발급되었습니다!",
        }

    # free 플랜은 기존 로그 확인
    existing_log = db.query(LottoRecommendLog).filter(
        LottoRecommendLog.account_user_id == user.id,
        LottoRecommendLog.target_draw_no == target_draw_no,
        LottoRecommendLog.plan_type == plan_type,
    ).first()

    if existing_log:
        existing_lines = _parse_json(existing_log.lines, "recommend_existing") or []
        return {
            "numbers": existing_lines,
            "target_draw_no": target_draw_no,
            "count": len(existing_lines),
            "plan_type": plan_type,
            "already_issued": True,
            "message": f"이번 회차({target_draw_no}회) 번호가 이미 발급되었습니다.",
        }

    if check_only:
        return {
            "numbers": [],
            "target_draw_no": target_draw_no,
            "count": 0,
            "plan_type": plan_type,
            "already_issued": False,
            "message": "발급된 번호가 없습니다.",
        }

    # count가 지정되지 않으면 플랜별 최대치 사용
    if count is None:
        count = max_lines
    else:
        count = min(count, max_lines)

    stats = _build_stats_from_db(db)

    if not stats:
        recommended = [sorted(random.sample(range(1, 46), 6)) for _ in range(count)]
    else:
        recommended = [generate_free_line(stats) for _ in range(count)]

    # 추천 로그 저장 (중복 방지)
    from sqlalchemy.exc import IntegrityError
    try:
        log = LottoRecommendLog(
            user_id=user.id,
            account_user_id=user.id,
            target_draw_no=target_draw_no,
            lines=json.dumps(recommended),
            recommend_time=datetime.utcnow(),
            plan_type=plan_type,
            is_matched=False,
        )
        db.add(log)
        db.commit()
    except IntegrityError:
        # 중복 삽입 시도 - 기존 로그 반환
        db.rollback()
        existing_log = db.query(LottoRecommendLog).filter(
            LottoRecommendLog.account_user_id == user.id,
            LottoRecommendLog.target_draw_no == target_draw_no,
            LottoRecommendLog.plan_type == plan_type,
        ).first()
        if existing_log:
            existing_lines = json.loads(existing_log.lines) if existing_log.lines else []
            return {
                "numbers": existing_lines,
                "target_draw_no": target_draw_no,
                "count": len(existing_lines),
                "plan_type": plan_type,
                "already_issued": True,
                "message": f"이번 회차({target_draw_no}회) 번호가 이미 발급되었습니다.",
            }

    return {
        "numbers": recommended,
        "target_draw_no": target_draw_no,
        "count": len(recommended),
        "plan_type": plan_type,
        "already_issued": False,
        "message": f"{target_draw_no}회 AI 추천 번호가 발급되었습니다!",
    }


@router.post("/recommend/one")
def request_one_line(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    번호 풀에서 1줄씩 랜덤으로 뽑기 (BASIC/PREMIUM/VIP용)
    PoolService 통합 모듈 사용
    """
    plan_type = (user.subscription_type or "free").lower()

    if plan_type == "free":
        raise HTTPException(
            status_code=400,
            detail="무료 플랜은 기존 번호받기 버튼을 사용해주세요."
        )

    # 현재 회차 확인
    latest_draw = db.query(LottoDraw).order_by(desc(LottoDraw.draw_no)).first()
    target_draw_no = (latest_draw.draw_no + 1) if latest_draw else 1

    # PoolService 사용
    pool_service = PoolService(db)
    result = pool_service.reveal_one_line(
        user_id=user.id,
        target_draw_no=target_draw_no,
        plan_type=plan_type,
    )

    # target_draw_no 추가
    result["target_draw_no"] = target_draw_no
    return result


@router.post("/recommend/all")
def request_all_lines(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    번호 풀 전체를 한번에 받기 (BASIC/PREMIUM/VIP용)
    PoolService 통합 모듈 사용
    """
    plan_type = (user.subscription_type or "free").lower()

    if plan_type == "free":
        raise HTTPException(
            status_code=400,
            detail="무료 플랜은 기존 번호받기 버튼을 사용해주세요."
        )

    # 현재 회차 확인
    latest_draw = db.query(LottoDraw).order_by(desc(LottoDraw.draw_no)).first()
    target_draw_no = (latest_draw.draw_no + 1) if latest_draw else 1

    # PoolService 사용
    pool_service = PoolService(db)
    result = pool_service.reveal_all_lines(
        user_id=user.id,
        target_draw_no=target_draw_no,
        plan_type=plan_type,
    )

    # target_draw_no 추가
    result["target_draw_no"] = target_draw_no
    return result


@router.get("/recommend/pool-status")
def get_pool_status(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    현재 회차의 번호 풀 상태 조회
    PoolService 통합 모듈 사용
    """
    plan_type = (user.subscription_type or "free").lower()

    # 현재 회차 확인
    latest_draw = db.query(LottoDraw).order_by(desc(LottoDraw.draw_no)).first()
    target_draw_no = (latest_draw.draw_no + 1) if latest_draw else 1

    # PoolService 사용
    pool_service = PoolService(db)
    result = pool_service.get_pool_status(
        user_id=user.id,
        target_draw_no=target_draw_no,
        plan_type=plan_type,
    )

    # 추가 정보
    result["target_draw_no"] = target_draw_no
    result["plan_type"] = plan_type
    return result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 고급 설정: 제외/고정 번호 지원
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/recommend/fixed-candidates")
def get_fixed_candidates(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    refresh: bool = False,  # True면 새로 뽑기
    check_only: bool = False,  # True면 저장된 번호만 조회 (없으면 빈 배열)
):
    """
    플랜별 AI 고정 후보 번호 조회 (회차별 저장)

    - PREMIUM: ML 상위 2개 (랜덤 선택, 회차별 1회 저장)
    - VIP: ML 상위 3개 (랜덤 선택, 회차별 1회 저장)
    - BASIC/FREE: 빈 리스트
    - check_only=True: 저장된 번호만 조회, 없으면 빈 배열 반환
    """
    import random
    from backend.app.services.lotto.generator import get_top_candidates

    try:
        plan_type = (user.subscription_type or "free").lower()

        # BASIC/FREE는 고정 기능 없음
        if plan_type not in ["premium", "vip"]:
            return {
                "success": True,
                "candidates": [],
                "plan_type": plan_type,
                "message": "이 플랜에서는 고정 기능을 사용할 수 없습니다.",
            }

        # 현재 타겟 회차 계산
        latest_draw = db.query(LottoDraw).order_by(desc(LottoDraw.draw_no)).first()
        target_draw_no = (latest_draw.draw_no + 1) if latest_draw else 1

        # 기존 로그에서 저장된 fixed_candidates 확인
        existing_log = db.query(LottoRecommendLog).filter(
            LottoRecommendLog.account_user_id == user.id,
            LottoRecommendLog.target_draw_no == target_draw_no,
            LottoRecommendLog.plan_type == plan_type,
        ).first()

        # 이미 저장된 번호가 있고 refresh가 아니면 반환
        if existing_log and existing_log.settings_data and not refresh:
            # settings_data가 문자열이면 JSON 파싱
            settings = existing_log.settings_data
            if isinstance(settings, str):
                import json
                try:
                    settings = json.loads(settings)
                except:
                    settings = {}
            saved_candidates = settings.get("fixed_candidates", []) if isinstance(settings, dict) else []
            if saved_candidates:
                return {
                    "success": True,
                    "candidates": saved_candidates,
                    "plan_type": plan_type,
                    "target_draw_no": target_draw_no,
                    "message": f"AI가 추천하는 고정 후보 {len(saved_candidates)}개입니다.",
                }

        # check_only 모드: 저장된 번호가 없으면 빈 배열 반환 (새로 뽑지 않음)
        if check_only:
            return {
                "success": True,
                "candidates": [],
                "plan_type": plan_type,
                "target_draw_no": target_draw_no,
                "message": "저장된 추천 공이 없습니다.",
            }

        # 새로 뽑기: 통계 데이터 조회
        stats = _build_stats_from_db(db)
        if not stats:
            return {
                "success": False,
                "message": "통계 데이터가 없습니다.",
                "candidates": [],
                "plan_type": plan_type,
            }

        scores1 = stats.get('scores_logic1', {})
        scores2 = stats.get('scores_logic2', {})
        scores3 = stats.get('scores_logic3', {})

        # ML 종합 점수 계산
        scores_final = {}
        for n in range(1, 46):
            scores_final[n] = (
                scores1.get(n, 0) * 0.33 +
                scores2.get(n, 0) * 0.33 +
                scores3.get(n, 0) * 0.34
            )

        # 플랜별 후보 수 결정
        if plan_type == "vip":
            top_pool = get_top_candidates(scores_final, 10)
            candidates = sorted(random.sample(top_pool, min(3, len(top_pool))))
        else:  # premium
            top_pool = get_top_candidates(scores_final, 10)
            candidates = sorted(random.sample(top_pool, min(2, len(top_pool))))

        # 로그에 저장 (기존 로그가 있으면 업데이트, 없으면 새로 생성)
        import json
        if existing_log:
            # 기존 settings_data 파싱
            settings = existing_log.settings_data
            if isinstance(settings, str):
                try:
                    settings = json.loads(settings)
                except:
                    settings = {}
            elif settings is None:
                settings = {}
            settings["fixed_candidates"] = candidates
            existing_log.settings_data = json.dumps(settings)
        else:
            # 새 로그 생성 (lines는 빈 상태로)
            new_log = LottoRecommendLog(
                user_id=user.id,
                account_user_id=user.id,
                target_draw_no=target_draw_no,
                lines="[]",
                plan_type=plan_type,
                settings_data=json.dumps({"fixed_candidates": candidates}),
            )
            db.add(new_log)

        db.commit()

        return {
            "success": True,
            "candidates": candidates,
            "plan_type": plan_type,
            "target_draw_no": target_draw_no,
            "message": f"AI가 추천하는 고정 후보 {len(candidates)}개입니다.",
        }
    except Exception as e:
        print(f"[ERROR] get_fixed_candidates: {e}")
        db.rollback()
        return {
            "success": False,
            "message": "추천 공 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
            "candidates": [],
            "plan_type": "unknown",
        }


class AdvancedRecommendRequest(BaseModel):
    exclude: List[int] = []
    fixed: List[int] = []


@router.post("/recommend/advanced/one")
def request_one_line_advanced(
    req: AdvancedRecommendRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    고급 설정(제외/고정)을 적용하여 1줄씩 받기
    PoolService 통합 모듈 사용
    """
    plan_type = (user.subscription_type or "free").lower()

    if plan_type == "free":
        raise HTTPException(
            status_code=400,
            detail="무료 플랜은 고급 설정을 사용할 수 없습니다."
        )

    # 제외 번호 개수 제한 검증
    max_exclude = PoolService.get_max_exclude(plan_type)
    if len(req.exclude) > max_exclude:
        raise HTTPException(
            status_code=400,
            detail=f"이 플랜에서는 최대 {max_exclude}개까지 제외할 수 있습니다."
        )

    # 고정 번호 개수 제한 검증
    max_fixed = PoolService.get_max_fixed(plan_type)
    if len(req.fixed) > max_fixed:
        raise HTTPException(
            status_code=400,
            detail=f"이 플랜에서는 최대 {max_fixed}개까지 고정할 수 있습니다."
        )

    # 현재 회차 확인
    latest_draw = db.query(LottoDraw).order_by(desc(LottoDraw.draw_no)).first()
    target_draw_no = (latest_draw.draw_no + 1) if latest_draw else 1

    # PoolService 사용
    pool_service = PoolService(db)
    result = pool_service.reveal_one_line(
        user_id=user.id,
        target_draw_no=target_draw_no,
        plan_type=plan_type,
        exclude=req.exclude,
        fixed=req.fixed,
    )

    # target_draw_no 추가
    result["target_draw_no"] = target_draw_no
    return result


@router.post("/recommend/advanced/all")
def request_all_lines_advanced(
    req: AdvancedRecommendRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    고급 설정(제외/고정)을 적용하여 전체 받기
    PoolService 통합 모듈 사용
    """
    plan_type = (user.subscription_type or "free").lower()

    if plan_type == "free":
        raise HTTPException(
            status_code=400,
            detail="무료 플랜은 고급 설정을 사용할 수 없습니다."
        )

    # 제외 번호 개수 제한 검증
    max_exclude = PoolService.get_max_exclude(plan_type)
    if len(req.exclude) > max_exclude:
        raise HTTPException(
            status_code=400,
            detail=f"이 플랜에서는 최대 {max_exclude}개까지 제외할 수 있습니다."
        )

    # 고정 번호 개수 제한 검증
    max_fixed = PoolService.get_max_fixed(plan_type)
    if len(req.fixed) > max_fixed:
        raise HTTPException(
            status_code=400,
            detail=f"이 플랜에서는 최대 {max_fixed}개까지 고정할 수 있습니다."
        )

    # 현재 회차 확인
    latest_draw = db.query(LottoDraw).order_by(desc(LottoDraw.draw_no)).first()
    target_draw_no = (latest_draw.draw_no + 1) if latest_draw else 1

    # PoolService 사용
    pool_service = PoolService(db)
    result = pool_service.reveal_all_lines(
        user_id=user.id,
        target_draw_no=target_draw_no,
        plan_type=plan_type,
        exclude=req.exclude,
        fixed=req.fixed,
    )

    # target_draw_no 추가
    result["target_draw_no"] = target_draw_no
    return result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 프리미엄 통계 (PREMIUM/VIP 전용)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/stats/premium")
def get_premium_stats(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    프리미엄/VIP 전용 통계 정보

    - 추천 공: ML 점수 상위 번호 (PREMIUM 2개, VIP 3개)
    - 제일 안나온 번호: 최근 출현 빈도 최하위 번호 (PREMIUM 2개, VIP 3개)
    - 반등 기대 번호: 10회 이상 미출현 번호 (PREMIUM 2개, VIP 3개)
    - 구간별 출현 현황: 1-10, 11-20, 21-30, 31-40, 41-45 비율
    - 홀짝 밸런스: 최근 10회차 평균 홀수 개수
    """
    from collections import Counter

    plan_type = (user.subscription_type or "free").lower()

    # 플랜 체크 - basic 이상만 접근 가능
    if plan_type not in ["basic", "premium", "vip"]:
        raise HTTPException(
            status_code=403,
            detail="프리미엄 통계는 BASIC 이상 플랜에서 이용 가능합니다."
        )

    # 전체 회차 데이터 가져오기
    draws = db.query(LottoDraw).order_by(desc(LottoDraw.draw_no)).all()
    if not draws:
        raise HTTPException(status_code=404, detail="추첨 데이터가 없습니다.")

    draws_data = draws_to_dict_list(draws)
    total_draws = len(draws_data)

    # 플랜별 개수 설정
    if plan_type == "vip":
        recommend_count = 3
        avoid_count = 3
        comeback_count = 3  # 5 → 3으로 변경
    elif plan_type == "premium":
        recommend_count = 2
        avoid_count = 2
        comeback_count = 2  # 3 → 2로 변경
    else:  # basic
        recommend_count = 2
        avoid_count = 2
        comeback_count = 2  # 3 → 2로 변경

    # 1. ML 점수 계산 (추천 공용)
    scores1 = LottoStatsCalculator.calculate_ai_scores_logic1(draws_data)
    scores2 = LottoStatsCalculator.calculate_ai_scores_logic2(draws_data)
    scores3 = LottoStatsCalculator.calculate_ai_scores_logic3(draws_data)

    scores_final = {}
    for n in range(1, 46):
        scores_final[n] = (
            scores1.get(n, 0) * 0.33 +
            scores2.get(n, 0) * 0.33 +
            scores3.get(n, 0) * 0.34
        )

    # 추천 공: ML 점수 상위 N개 (고정)
    sorted_by_score = sorted(scores_final.items(), key=lambda x: x[1], reverse=True)
    recommend_numbers = sorted([num for num, _ in sorted_by_score[:recommend_count]])

    # 2. 최근 출현 빈도 계산 (피해야 할 공용)
    recent_draws = draws_data[:30] if len(draws_data) >= 30 else draws_data
    recent_count = Counter()
    for d in recent_draws:
        for n in [d['n1'], d['n2'], d['n3'], d['n4'], d['n5'], d['n6']]:
            recent_count[n] += 1

    # 전체 번호 중 최근 출현 빈도 최하위 N개 (고정)
    all_numbers = list(range(1, 46))
    sorted_by_recent = sorted(all_numbers, key=lambda x: recent_count.get(x, 0))
    avoid_numbers = sorted(sorted_by_recent[:avoid_count])

    # 3. 장기 미출현 번호 (반등 기대)
    last_appear = {}
    for i, d in enumerate(draws_data):
        draw_idx = total_draws - i  # 최신이 total_draws, 오래된게 1
        for n in [d['n1'], d['n2'], d['n3'], d['n4'], d['n5'], d['n6']]:
            if n not in last_appear:
                last_appear[n] = draw_idx

    # 미출현 기간 계산 (현재 회차 - 마지막 출현 회차)
    gaps = {}
    for n in range(1, 46):
        if n in last_appear:
            gaps[n] = total_draws - last_appear[n]
        else:
            gaps[n] = total_draws  # 한번도 안 나온 번호

    # 10회 이상 미출현 번호 중 상위 N개 (고정)
    long_absent = [(n, gap) for n, gap in gaps.items() if gap >= 10]
    long_absent.sort(key=lambda x: x[1], reverse=True)
    if len(long_absent) >= comeback_count:
        comeback_numbers = sorted([n for n, _ in long_absent[:comeback_count]])
    else:
        # 10회 이상 미출현이 부족하면 간격 큰 순으로
        sorted_by_gap = sorted(gaps.items(), key=lambda x: x[1], reverse=True)
        comeback_numbers = sorted([n for n, _ in sorted_by_gap[:comeback_count]])

    # 4. 구간별 출현 현황 (최근 50회 기준)
    recent_50 = draws_data[:50] if len(draws_data) >= 50 else draws_data
    zone_count = {
        "1-10": 0,
        "11-20": 0,
        "21-30": 0,
        "31-40": 0,
        "41-45": 0,
    }
    total_numbers = 0

    for d in recent_50:
        for n in [d['n1'], d['n2'], d['n3'], d['n4'], d['n5'], d['n6']]:
            total_numbers += 1
            if 1 <= n <= 10:
                zone_count["1-10"] += 1
            elif 11 <= n <= 20:
                zone_count["11-20"] += 1
            elif 21 <= n <= 30:
                zone_count["21-30"] += 1
            elif 31 <= n <= 40:
                zone_count["31-40"] += 1
            else:
                zone_count["41-45"] += 1

    zone_ratio = {}
    for zone, count in zone_count.items():
        zone_ratio[zone] = round(count / total_numbers * 100) if total_numbers > 0 else 0

    # 5. 홀짝 밸런스 (최근 10회차)
    recent_10 = draws_data[:10] if len(draws_data) >= 10 else draws_data
    odd_counts = []
    for d in recent_10:
        nums = [d['n1'], d['n2'], d['n3'], d['n4'], d['n5'], d['n6']]
        odd_cnt = sum(1 for n in nums if n % 2 == 1)
        odd_counts.append(odd_cnt)

    avg_odd = round(sum(odd_counts) / len(odd_counts), 1) if odd_counts else 3.0

    return {
        "success": True,
        "plan_type": plan_type,
        "recommend_numbers": recommend_numbers,
        "recommend_count": recommend_count,
        "avoid_numbers": avoid_numbers,
        "avoid_count": avoid_count,
        "comeback_numbers": comeback_numbers,
        "comeback_count": comeback_count,
        "zone_ratio": zone_ratio,
        "odd_even_balance": {
            "avg_odd": avg_odd,
            "avg_even": round(6 - avg_odd, 1),
            "recent_draws": len(recent_10),
        },
        "data_info": {
            "total_draws": total_draws,
            "analysis_period": f"최근 {min(50, total_draws)}회차",
        }
    }
