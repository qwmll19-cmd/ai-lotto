"""당첨 결과 매칭 서비스"""
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.db.models import LottoDraw, LottoRecommendLog, PlanPerformanceStats
from app.services.lotto.stats_calculator import LottoStatsCalculator
from app.utils import now_kst

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
            "matched_at": now_kst().isoformat()
        }

        # DB 업데이트
        recommend_log.match_results = json.dumps(match_data, ensure_ascii=False)
        recommend_log.is_matched = True
        recommend_log.matched_at = now_kst()

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
        # 먼저 최근 N회차의 draw_no를 가져옴
        recent_draw_nos = db.query(PlanPerformanceStats.draw_no).filter(
            PlanPerformanceStats.plan_type == plan_type
        ).order_by(
            PlanPerformanceStats.draw_no.desc()
        ).limit(recent_draws).all()

        if not recent_draw_nos:
            continue

        draw_no_list = [r[0] for r in recent_draw_nos]

        # 해당 회차들에 대해 집계
        stats = db.query(
            func.sum(PlanPerformanceStats.total_lines).label("total_lines"),
            func.sum(PlanPerformanceStats.match_3).label("rank5"),
            func.sum(PlanPerformanceStats.match_4).label("rank4"),
            func.sum(PlanPerformanceStats.match_5).label("rank3"),
            func.sum(PlanPerformanceStats.match_5_bonus).label("rank2"),
            func.sum(PlanPerformanceStats.match_6).label("rank1"),
            func.avg(PlanPerformanceStats.avg_match_count).label("avg_match")
        ).filter(
            PlanPerformanceStats.plan_type == plan_type,
            PlanPerformanceStats.draw_no.in_(draw_no_list)
        ).first()

        if stats and stats.total_lines:
            results[plan_type] = {
                "total_lines": stats.total_lines or 0,
                "rank1_count": stats.rank1 or 0,
                "rank2_count": stats.rank2 or 0,
                "rank3_count": stats.rank3 or 0,
                "rank4_count": stats.rank4 or 0,
                "rank5_count": stats.rank5 or 0,
                "avg_match": round(float(stats.avg_match or 0), 2)
            }

    return results


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Phase 4: 성능 추적 시스템 확장
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def get_user_performance_stats(db: Session, user_id: int) -> Dict:
    """
    특정 사용자의 성능 통계

    Returns:
        - total_lines: 전체 추천받은 줄 수
        - total_draws: 참여 회차 수
        - match_distribution: 일치 개수별 분포
        - best_rank: 역대 최고 등수
        - recent_performance: 최근 5회차 성과
        - win_rate: 당첨율 (3개 이상 일치)
    """
    import json as json_module
    from sqlalchemy import func, desc

    # 전체 추천 로그 조회
    logs = db.query(LottoRecommendLog).filter(
        LottoRecommendLog.user_id == user_id,
        LottoRecommendLog.is_matched == True
    ).order_by(desc(LottoRecommendLog.target_draw_no)).all()

    if not logs:
        return {
            "total_lines": 0,
            "total_draws": 0,
            "match_distribution": {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, "5+bonus": 0, 6: 0},
            "best_rank": None,
            "recent_performance": [],
            "win_rate": 0,
            "avg_match_count": 0,
        }

    total_lines = 0
    match_distribution = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, "5+bonus": 0, 6: 0}
    best_rank = None
    total_match = 0
    win_count = 0  # 3개 이상 일치
    recent_performance = []

    for log in logs:
        if not log.match_results:
            continue

        try:
            result = json_module.loads(log.match_results) if isinstance(log.match_results, str) else log.match_results
        except:
            continue

        line_results = result.get("line_results", [])
        total_lines += len(line_results)

        for line_result in line_results:
            match_count = line_result.get("match_count", 0)
            bonus_match = line_result.get("bonus_match", False)
            total_match += match_count

            if match_count == 5 and bonus_match:
                match_distribution["5+bonus"] += 1
                win_count += 1
            else:
                match_distribution[match_count] = match_distribution.get(match_count, 0) + 1
                if match_count >= 3:
                    win_count += 1

        log_best_rank = result.get("best_rank")
        if log_best_rank:
            if best_rank is None or log_best_rank < best_rank:
                best_rank = log_best_rank

        # 최근 성과 (최대 5개)
        if len(recent_performance) < 5:
            recent_performance.append({
                "draw_no": result.get("draw_no"),
                "total_lines": len(line_results),
                "total_match": result.get("total_match_count", 0),
                "best_rank": log_best_rank,
                "matched_at": result.get("matched_at"),
            })

    win_rate = (win_count / total_lines * 100) if total_lines > 0 else 0
    avg_match = total_match / total_lines if total_lines > 0 else 0

    return {
        "total_lines": total_lines,
        "total_draws": len(logs),
        "match_distribution": match_distribution,
        "best_rank": best_rank,
        "recent_performance": recent_performance,
        "win_rate": round(win_rate, 2),
        "avg_match_count": round(avg_match, 2),
    }


def get_global_performance_summary(db: Session) -> Dict:
    """
    전체 시스템 성능 요약 (관리자/공개용)

    Returns:
        - total_recommendations: 전체 추천 수
        - total_users: 참여 사용자 수
        - total_wins: 전체 당첨 횟수 (3개 이상)
        - rank_distribution: 등수별 분포
        - plan_comparison: 플랜별 성과 비교
        - trend: 최근 10회차 성과 추이
    """
    import json as json_module
    from sqlalchemy import func, desc

    # 전체 통계
    total_recommendations = db.query(func.count(LottoRecommendLog.id)).filter(
        LottoRecommendLog.is_matched == True
    ).scalar() or 0

    total_users = db.query(func.count(func.distinct(LottoRecommendLog.user_id))).filter(
        LottoRecommendLog.is_matched == True
    ).scalar() or 0

    # 플랜별 성과 요약
    plan_comparison = get_plan_performance_summary(db, recent_draws=20)

    # 최근 10회차 성과 추이
    recent_draws = db.query(PlanPerformanceStats.draw_no).distinct().order_by(
        desc(PlanPerformanceStats.draw_no)
    ).limit(10).all()

    trend = []
    for (draw_no,) in recent_draws:
        draw_stats = db.query(
            func.sum(PlanPerformanceStats.total_lines).label("total_lines"),
            func.sum(PlanPerformanceStats.match_3 + PlanPerformanceStats.match_4 +
                     PlanPerformanceStats.match_5 + PlanPerformanceStats.match_5_bonus +
                     PlanPerformanceStats.match_6).label("total_wins"),
            func.avg(PlanPerformanceStats.avg_match_count).label("avg_match"),
        ).filter(
            PlanPerformanceStats.draw_no == draw_no
        ).first()

        if draw_stats and draw_stats.total_lines:
            trend.append({
                "draw_no": draw_no,
                "total_lines": draw_stats.total_lines or 0,
                "total_wins": draw_stats.total_wins or 0,
                "avg_match": round(draw_stats.avg_match or 0, 2),
            })

    # 등수별 전체 분포 계산
    rank_totals = db.query(
        func.sum(PlanPerformanceStats.match_3).label("rank5"),
        func.sum(PlanPerformanceStats.match_4).label("rank4"),
        func.sum(PlanPerformanceStats.match_5).label("rank3"),
        func.sum(PlanPerformanceStats.match_5_bonus).label("rank2"),
        func.sum(PlanPerformanceStats.match_6).label("rank1"),
    ).first()

    rank_distribution = {
        "1등": rank_totals.rank1 or 0,
        "2등": rank_totals.rank2 or 0,
        "3등": rank_totals.rank3 or 0,
        "4등": rank_totals.rank4 or 0,
        "5등": rank_totals.rank5 or 0,
    } if rank_totals else {}

    total_wins = sum(rank_distribution.values())

    return {
        "total_recommendations": total_recommendations,
        "total_users": total_users,
        "total_wins": total_wins,
        "rank_distribution": rank_distribution,
        "plan_comparison": plan_comparison,
        "trend": trend,
    }


def get_draw_performance_detail(db: Session, draw_no: int) -> Dict:
    """
    특정 회차의 성능 상세

    Returns:
        - draw_info: 당첨 번호 정보
        - plan_stats: 플랜별 통계
        - top_matched_lines: 가장 많이 맞춘 줄들 (상위 5개)
    """
    import json as json_module

    draw = db.query(LottoDraw).filter(LottoDraw.draw_no == draw_no).first()
    if not draw:
        return {"error": "draw_not_found"}

    draw_info = {
        "draw_no": draw.draw_no,
        "winning_numbers": [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6],
        "bonus": draw.bonus,
        "draw_date": draw.draw_date.isoformat() if draw.draw_date else None,
    }

    # 플랜별 통계 조회
    plan_stats_list = db.query(PlanPerformanceStats).filter(
        PlanPerformanceStats.draw_no == draw_no
    ).all()

    plan_stats = {}
    for ps in plan_stats_list:
        plan_stats[ps.plan_type] = {
            "total_lines": ps.total_lines,
            "total_users": ps.total_users,
            "match_distribution": {
                0: ps.match_0,
                1: ps.match_1,
                2: ps.match_2,
                3: ps.match_3,
                4: ps.match_4,
                5: ps.match_5,
                "5+bonus": ps.match_5_bonus,
                6: ps.match_6,
            },
            "avg_match": ps.avg_match_count,
        }

    # 가장 많이 맞춘 줄들 (상위 5개)
    logs = db.query(LottoRecommendLog).filter(
        LottoRecommendLog.target_draw_no == draw_no,
        LottoRecommendLog.is_matched == True
    ).all()

    top_lines = []
    for log in logs:
        if not log.match_results:
            continue

        try:
            result = json_module.loads(log.match_results) if isinstance(log.match_results, str) else log.match_results
        except:
            continue

        for line_result in result.get("line_results", []):
            if line_result.get("match_count", 0) >= 4:  # 4개 이상 일치만
                top_lines.append({
                    "match_count": line_result.get("match_count"),
                    "matched_numbers": line_result.get("matched_numbers"),
                    "bonus_match": line_result.get("bonus_match"),
                    "rank": line_result.get("rank"),
                    "plan_type": log.plan_type,
                })

    # match_count 높은 순으로 정렬, 상위 5개
    top_lines = sorted(top_lines, key=lambda x: (-x["match_count"], -int(x["bonus_match"])))[:5]

    return {
        "draw_info": draw_info,
        "plan_stats": plan_stats,
        "top_matched_lines": top_lines,
    }
