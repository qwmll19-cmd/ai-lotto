"""당첨 결과 매칭 서비스"""
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.db.models import LottoDraw, LottoRecommendLog, PlanPerformanceStats
from app.services.lotto.stats_calculator import LottoStatsCalculator

logger = logging.getLogger("result_matcher")


def match_single_line(line: List[int], winning_numbers: List[int], bonus: int) -> Dict:
    """
    단일 줄 당첨 결과 확인

    Args:
        line: 추천 번호 [1, 2, 3, 4, 5, 6]
        winning_numbers: 당첨 번호 [1, 2, 3, 4, 5, 6]
        bonus: 보너스 번호

    Returns:
        {
            "match_count": 3,
            "matched_numbers": [1, 2, 3],
            "bonus_match": False,
            "rank": 5  # 1~5등, None이면 낙첨
        }
    """
    line_set = set(line)
    winning_set = set(winning_numbers)

    matched = line_set & winning_set
    match_count = len(matched)
    bonus_match = bonus in line_set

    # 등수 계산
    rank = None
    if match_count == 6:
        rank = 1
    elif match_count == 5 and bonus_match:
        rank = 2
    elif match_count == 5:
        rank = 3
    elif match_count == 4:
        rank = 4
    elif match_count == 3:
        rank = 5

    return {
        "match_count": match_count,
        "matched_numbers": sorted(list(matched)),
        "bonus_match": bonus_match,
        "rank": rank
    }


def match_recommend_log(
    db: Session,
    recommend_log: LottoRecommendLog,
    draw: LottoDraw
) -> Dict:
    """
    추천 로그의 당첨 결과 매칭

    Args:
        db: DB 세션
        recommend_log: 추천 로그
        draw: 당첨 회차

    Returns:
        매칭 결과 딕셔너리
    """
    try:
        # 추천 번호 파싱
        lines_raw = recommend_log.lines
        if isinstance(lines_raw, str):
            lines = json.loads(lines_raw)
        else:
            lines = lines_raw

        # 문자열 형태 "1, 2, 3, 4, 5, 6" → 리스트로 변환
        parsed_lines = []
        for line in lines:
            if isinstance(line, str):
                parsed_lines.append([int(n.strip()) for n in line.split(",")])
            else:
                parsed_lines.append(line)

        # 당첨 번호
        winning_numbers = [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6]
        bonus = draw.bonus

        # 각 줄별 매칭
        results = []
        total_match = 0
        best_rank = None

        for line in parsed_lines:
            result = match_single_line(line, winning_numbers, bonus)
            results.append(result)
            total_match += result["match_count"]

            if result["rank"]:
                if best_rank is None or result["rank"] < best_rank:
                    best_rank = result["rank"]

        match_data = {
            "draw_no": draw.draw_no,
            "winning_numbers": winning_numbers,
            "bonus": bonus,
            "line_results": results,
            "total_lines": len(parsed_lines),
            "total_match_count": total_match,
            "avg_match_count": total_match / len(parsed_lines) if parsed_lines else 0,
            "best_rank": best_rank,
            "matched_at": datetime.utcnow().isoformat()
        }

        # DB 업데이트
        recommend_log.match_results = json.dumps(match_data, ensure_ascii=False)
        recommend_log.is_matched = True
        recommend_log.matched_at = datetime.utcnow()

        return match_data

    except Exception as e:
        logger.exception(f"match_recommend_log failed: {e}")
        return {}


def match_all_pending_logs(db: Session, draw_no: int) -> Dict:
    """
    특정 회차의 모든 미매칭 추천 로그 매칭

    Args:
        db: DB 세션
        draw_no: 매칭할 회차 번호

    Returns:
        {
            "matched_count": 10,
            "plan_stats": {"free": {...}, "basic": {...}, ...}
        }
    """
    # 당첨 번호 조회
    draw = db.query(LottoDraw).filter(LottoDraw.draw_no == draw_no).first()
    if not draw:
        logger.warning(f"Draw {draw_no} not found")
        return {"error": "draw_not_found"}

    # 미매칭 로그 조회
    pending_logs = db.query(LottoRecommendLog).filter(
        LottoRecommendLog.target_draw_no == draw_no,
        LottoRecommendLog.is_matched == False
    ).all()

    if not pending_logs:
        logger.info(f"No pending logs for draw {draw_no}")
        return {"matched_count": 0, "plan_stats": {}}

    # 플랜별 통계 초기화
    plan_stats = {
        "free": _init_plan_stats(),
        "basic": _init_plan_stats(),
        "premium": _init_plan_stats(),
        "vip": _init_plan_stats()
    }

    matched_count = 0

    for log in pending_logs:
        result = match_recommend_log(db, log, draw)
        if not result:
            continue

        matched_count += 1
        plan_type = log.plan_type or "free"

        if plan_type in plan_stats:
            _update_plan_stats(plan_stats[plan_type], result)

    db.commit()

    # 플랜별 성과 통계 저장
    _save_plan_performance_stats(db, draw_no, plan_stats)

    logger.info(f"Matched {matched_count} logs for draw {draw_no}")

    return {
        "draw_no": draw_no,
        "matched_count": matched_count,
        "plan_stats": plan_stats
    }


def _init_plan_stats() -> Dict:
    """플랜 통계 초기화"""
    return {
        "total_lines": 0,
        "total_users": 0,
        "match_counts": {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, "5+bonus": 0, 6: 0},
        "total_match": 0,
        "best_rank": None
    }


def _update_plan_stats(stats: Dict, result: Dict) -> None:
    """플랜 통계 업데이트"""
    stats["total_users"] += 1
    stats["total_lines"] += result.get("total_lines", 0)
    stats["total_match"] += result.get("total_match_count", 0)

    for line_result in result.get("line_results", []):
        match_count = line_result["match_count"]
        bonus_match = line_result["bonus_match"]

        if match_count == 5 and bonus_match:
            stats["match_counts"]["5+bonus"] += 1
        else:
            stats["match_counts"][match_count] = stats["match_counts"].get(match_count, 0) + 1

    best = result.get("best_rank")
    if best:
        if stats["best_rank"] is None or best < stats["best_rank"]:
            stats["best_rank"] = best


def _save_plan_performance_stats(db: Session, draw_no: int, plan_stats: Dict) -> None:
    """플랜별 성과 통계 DB 저장"""
    for plan_type, stats in plan_stats.items():
        if stats["total_lines"] == 0:
            continue

        avg_match = stats["total_match"] / stats["total_lines"] if stats["total_lines"] > 0 else 0

        perf = PlanPerformanceStats(
            draw_no=draw_no,
            plan_type=plan_type,
            total_lines=stats["total_lines"],
            total_users=stats["total_users"],
            match_0=stats["match_counts"].get(0, 0),
            match_1=stats["match_counts"].get(1, 0),
            match_2=stats["match_counts"].get(2, 0),
            match_3=stats["match_counts"].get(3, 0),
            match_4=stats["match_counts"].get(4, 0),
            match_5=stats["match_counts"].get(5, 0),
            match_5_bonus=stats["match_counts"].get("5+bonus", 0),
            match_6=stats["match_counts"].get(6, 0),
            avg_match_count=avg_match
        )

        db.add(perf)

    db.commit()
    logger.info(f"Saved plan performance stats for draw {draw_no}")


def calculate_ml_hit_rates(
    db: Session,
    draw_no: int,
    stats: Dict
) -> Dict[str, float]:
    """
    ML 상위 번호 적중률 계산

    Args:
        db: DB 세션
        draw_no: 회차
        stats: 통계 데이터 (scores_logic1, scores_logic2, scores_logic3)

    Returns:
        {"top_10": 3, "top_15": 4, "top_20": 5}
    """
    draw = db.query(LottoDraw).filter(LottoDraw.draw_no == draw_no).first()
    if not draw:
        return {}

    winning_set = {draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6}

    # scores_final 계산
    scores1 = stats.get('scores_logic1', {})
    scores2 = stats.get('scores_logic2', {})
    scores3 = stats.get('scores_logic3', {})

    scores_final = {}
    for n in range(1, 46):
        scores_final[n] = (
            scores1.get(n, 0) * 0.33 +
            scores2.get(n, 0) * 0.33 +
            scores3.get(n, 0) * 0.34
        )

    # 상위 N개 추출
    sorted_nums = sorted(scores_final.items(), key=lambda x: x[1], reverse=True)

    top_10 = {n for n, _ in sorted_nums[:10]}
    top_15 = {n for n, _ in sorted_nums[:15]}
    top_20 = {n for n, _ in sorted_nums[:20]}

    return {
        "top_10": len(top_10 & winning_set),
        "top_15": len(top_15 & winning_set),
        "top_20": len(top_20 & winning_set)
    }


def get_plan_performance_summary(db: Session, recent_draws: int = 10) -> Dict:
    """
    최근 N회차 플랜별 성과 요약

    Returns:
        {
            "free": {"avg_match": 1.5, "best_rank": 5, ...},
            "basic": {"avg_match": 2.1, "best_rank": 4, ...},
            ...
        }
    """
    from sqlalchemy import func

    results = {}

    for plan_type in ["free", "basic", "premium", "vip"]:
        stats = db.query(
            func.sum(PlanPerformanceStats.total_lines).label("total_lines"),
            func.sum(PlanPerformanceStats.match_3).label("rank5"),
            func.sum(PlanPerformanceStats.match_4).label("rank4"),
            func.sum(PlanPerformanceStats.match_5).label("rank3"),
            func.sum(PlanPerformanceStats.match_5_bonus).label("rank2"),
            func.sum(PlanPerformanceStats.match_6).label("rank1"),
            func.avg(PlanPerformanceStats.avg_match_count).label("avg_match")
        ).filter(
            PlanPerformanceStats.plan_type == plan_type
        ).order_by(
            PlanPerformanceStats.draw_no.desc()
        ).limit(recent_draws).first()

        if stats and stats.total_lines:
            results[plan_type] = {
                "total_lines": stats.total_lines or 0,
                "rank1_count": stats.rank1 or 0,
                "rank2_count": stats.rank2 or 0,
                "rank3_count": stats.rank3 or 0,
                "rank4_count": stats.rank4 or 0,
                "rank5_count": stats.rank5 or 0,
                "avg_match": round(stats.avg_match or 0, 2)
            }

    return results
