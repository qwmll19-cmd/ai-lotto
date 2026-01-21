"""로또 비즈니스 로직 모듈"""
from typing import List
from .stats_calculator import LottoStatsCalculator


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 공통 유틸리티 함수
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def format_line(numbers: List[int]) -> str:
    """번호 리스트를 문자열로 포맷팅 (예: '1, 2, 3, 4, 5, 6')"""
    return ", ".join(str(n) for n in sorted(numbers))


def validate_phone(phone: str) -> str:
    """휴대폰 번호 검증 및 정규화"""
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) < 10 or len(digits) > 11:
        raise ValueError("전화번호 형식이 올바르지 않습니다.")
    return digits


def draws_to_dict_list(draws) -> List[dict]:
    """LottoDraw 객체 리스트를 딕셔너리 리스트로 변환"""
    return [{
        'draw_no': d.draw_no,
        'n1': d.n1, 'n2': d.n2, 'n3': d.n3,
        'n4': d.n4, 'n5': d.n5, 'n6': d.n6,
        'bonus': d.bonus
    } for d in draws]


def get_next_draw_no(db) -> int:
    """다음 회차 번호 반환 (DB 세션 필요)"""
    from backend.app.db.models import LottoDraw
    latest = db.query(LottoDraw.draw_no).order_by(LottoDraw.draw_no.desc()).first()
    return (latest[0] + 1) if latest and latest[0] else 1
from .generator import generate_15_lines, generate_20_lines, generate_free_line, generate_free_lines, generate_mixed_line, generate_paid_lines, generate_basic_lines, generate_premium_lines, generate_vip_lines, lucky_number
from .ml_trainer import LottoMLTrainer
from .result_matcher import (
    match_single_line,
    match_recommend_log,
    match_all_pending_logs,
    get_plan_performance_summary
)
from .pool_service import PoolService
# 미사용 모듈 (향후 사용 가능성 있음 - 파일 유지)
# from .ml_predictor import LottoMLPredictor
# from .performance_evaluator import evaluate_single_draw, evaluate_latest_draw, backtest_multiple_draws, print_backtest_summary


def build_stats_from_draws(draws: List[dict]) -> dict:
    """
    generator.py 함수들이 필요로 하는 stats 딕셔너리 생성

    Args:
        draws: 로또 회차 리스트 [{'draw_no': 1, 'n1': 1, ..., 'bonus': 7}, ...]

    Returns:
        stats 딕셔너리
    """
    if not draws:
        return None

    most_common, least_common = LottoStatsCalculator.calculate_most_least(draws)
    scores_logic1 = LottoStatsCalculator.calculate_ai_scores_logic1(draws)
    scores_logic2 = LottoStatsCalculator.calculate_ai_scores_logic2(draws)
    scores_logic3 = LottoStatsCalculator.calculate_ai_scores_logic3(draws)

    # 보너스 번호 통계
    bonus_counts = {}
    for d in draws:
        bonus = d.get("bonus")
        if bonus:
            bonus_counts[bonus] = bonus_counts.get(bonus, 0) + 1
    bonus_top = [num for num, _ in sorted(bonus_counts.items(), key=lambda x: x[1], reverse=True)]

    return {
        "most_common": most_common,
        "least_common": least_common,
        "scores_logic1": scores_logic1,
        "scores_logic2": scores_logic2,
        "scores_logic3": scores_logic3,
        "patterns": {},
        "best_patterns": {},
        "bonus_top": bonus_top,
    }

__all__ = [
    # 유틸리티
    'format_line',
    'validate_phone',
    'draws_to_dict_list',
    'get_next_draw_no',
    # 통계
    'LottoStatsCalculator',
    'build_stats_from_draws',
    # 생성기
    'generate_15_lines',
    'generate_20_lines',
    'generate_free_line',
    'generate_free_lines',
    'generate_mixed_line',
    'generate_paid_lines',
    'generate_basic_lines',
    'generate_premium_lines',
    'generate_vip_lines',
    'lucky_number',
    # ML
    'LottoMLTrainer',
    # 매칭
    'match_single_line',
    'match_recommend_log',
    'match_all_pending_logs',
    'get_plan_performance_summary',
    # 풀 관리 (통합 서비스)
    'PoolService',
]
