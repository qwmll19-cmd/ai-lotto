"""로또 번호 생성 (20줄) - 버그 수정 완료"""
import random
from typing import List, Dict, Tuple, Set
from itertools import combinations

def lucky_number(user_id: int, n: int = 6) -> List[int]:
    """유저ID 기반 행운 번호"""
    rng = random.Random(user_id)
    nums = sorted(rng.sample(range(1, 46), n))
    return nums

def get_top_candidates(ai_scores: Dict, n: int) -> List[int]:
    """AI 점수 상위 N개 후보"""
    sorted_items = sorted(ai_scores.items(), key=lambda x: float(x[1]), reverse=True)
    return [int(num) for num, _ in sorted_items[:n]]

def select_by_odd_even_balance(candidates: List[int], target: Tuple[int, int]) -> List[int]:
    """홀짝 밸런스에 맞춰 선택"""
    target_odd, target_even = target
    odds = [n for n in candidates if n % 2 == 1]
    evens = [n for n in candidates if n % 2 == 0]

    selected = set()
    selected.update(odds[:target_odd])
    selected.update(evens[:target_even])

    # 부족하면 추가
    while len(selected) < 6 and len(candidates) > len(selected):
        for c in candidates:
            if c not in selected:
                selected.add(c)
                if len(selected) >= 6:
                    break

    return sorted(list(selected))[:6]

def select_by_zone_balance(candidates: List[int], target: Tuple[int, int, int]) -> List[int]:
    """구간 밸런스에 맞춰 선택"""
    z1_cnt, z2_cnt, z3_cnt = target

    z1 = [n for n in candidates if 1 <= n <= 15]
    z2 = [n for n in candidates if 16 <= n <= 30]
    z3 = [n for n in candidates if 31 <= n <= 45]

    selected = set()
    selected.update(z1[:z1_cnt])
    selected.update(z2[:z2_cnt])
    selected.update(z3[:z3_cnt])

    # 부족하면 추가
    while len(selected) < 6 and len(candidates) > len(selected):
        for c in candidates:
            if c not in selected:
                selected.add(c)
                if len(selected) >= 6:
                    break

    return sorted(list(selected))[:6]

def has_consecutive(numbers: List[int]) -> bool:
    """연속 번호 쌍이 있는지 확인"""
    for i in range(len(numbers) - 1):
        if numbers[i+1] - numbers[i] == 1:
            return True
    return False

def calculate_sum(numbers: List[int]) -> int:
    """번호 합계"""
    return sum(numbers)

def is_duplicate(line1: List[int], line2: List[int], threshold: int = 5) -> bool:
    """두 조합이 중복인지 확인 (threshold개 이상 겹치면 중복)"""
    return len(set(line1) & set(line2)) >= threshold

def generate_20_lines(user_id: int, stats: Dict, ai_weights: Dict = None) -> Dict:
    """20줄 생성 (버그 수정)"""
    most = stats['most_common']
    least = stats['least_common']
    scores1 = stats['scores_logic1']
    scores2 = stats['scores_logic2']
    scores3 = stats['scores_logic3']
    bonus_top = stats.get('bonus_top', [])

    # ML 가중치 우선 사용 (없으면 기본값)
    default_weights = {'logic1': 0.33, 'logic2': 0.33, 'logic3': 0.34}
    if ai_weights is None:
        try:
            from app.services.lotto.ml_trainer import LottoMLTrainer
            trainer = LottoMLTrainer()
            if trainer.load_model():
                ai_weights = trainer.get_ai_weights()
            else:
                ai_weights = default_weights
        except (ImportError, FileNotFoundError, ValueError) as e:
            import logging
            logging.getLogger("lotto").warning("ML weights load failed: %s, using defaults", e)
            ai_weights = default_weights

    result = {
        'basic': [],
        'logic1': [],
        'logic2': [],
        'logic3': [],
        'final': [],
        'ai_core': []
    }

    all_generated = []  # 중복 체크용

    def _is_exact_duplicate(candidate: List[int]) -> bool:
        cset = set(candidate)
        return any(cset == set(existing) for existing in all_generated)

    def _unique_line(make_line, attempts: int = 8) -> List[int]:
        last = None
        for _ in range(attempts):
            line = make_line()
            last = line
            if not _is_exact_duplicate(line):
                return line
        return last if last is not None else []

    def _line_with_bonus(candidates: List[int]) -> List[int]:
        """보너스 번호를 포함한 조합 생성 (중복 대체용)."""
        for bonus in bonus_top:
            if bonus in candidates:
                pool = [n for n in candidates if n != bonus]
            else:
                pool = candidates[:]
            if len(pool) < 5:
                continue
            line = sorted([bonus] + random.sample(pool, 5))
            if not _is_exact_duplicate(line):
                return line
        return []

    def _ensure_unique(line: List[int], candidates: List[int]) -> List[int]:
        """전역 중복이면 보너스 기반으로 대체."""
        if not _is_exact_duplicate(line):
            return line
        bonus_line = _line_with_bonus(candidates)
        return bonus_line if bonus_line else line

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 기본 4줄
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    # ① 믹스
    line1 = set()
    line1.add(random.choice(most))
    line1.add(random.choice(least))
    while len(line1) < 6:
        line1.add(random.randint(1, 45))
    line1 = sorted(list(line1))
    result['basic'].append(line1)
    all_generated.append(line1)

    # ② 최다
    line2 = sorted(most[:6])
    result['basic'].append(line2)
    all_generated.append(line2)

    # ③ 최소
    line3 = sorted(least[:6])
    result['basic'].append(line3)
    all_generated.append(line3)

    # ④ 최다믹스
    line4 = set(most[:3])
    line4.update(random.sample(range(1, 46), 2))
    line4.add(lucky_number(user_id, 1)[0])
    line4 = sorted(list(line4))[:6]
    result['basic'].append(line4)
    all_generated.append(line4)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 로직1 3줄 (상위 15개)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    top1_15 = get_top_candidates(scores1, 15)

    line5 = _unique_line(lambda: select_by_odd_even_balance(random.sample(top1_15, len(top1_15)), (3, 3)))
    line5 = _ensure_unique(line5, top1_15)
    result['logic1'].append(line5)
    all_generated.append(line5)

    line6 = _unique_line(lambda: select_by_zone_balance(random.sample(top1_15, len(top1_15)), (2, 2, 2)))
    line6 = _ensure_unique(line6, top1_15)
    result['logic1'].append(line6)
    all_generated.append(line6)

    line7 = _unique_line(lambda: sorted(random.sample(top1_15, 6)))
    line7 = _ensure_unique(line7, top1_15)
    result['logic1'].append(line7)
    all_generated.append(line7)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 로직2 3줄 (상위 17개)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    top2_17 = get_top_candidates(scores2, 17)

    line8 = _unique_line(lambda: select_by_odd_even_balance(random.sample(top2_17, len(top2_17)), (3, 3)))
    line8 = _ensure_unique(line8, top2_17)
    result['logic2'].append(line8)
    all_generated.append(line8)

    line9 = _unique_line(lambda: select_by_zone_balance(random.sample(top2_17, len(top2_17)), (2, 2, 2)))
    line9 = _ensure_unique(line9, top2_17)
    result['logic2'].append(line9)
    all_generated.append(line9)

    # ⑩ 합계 최적화
    combos = list(combinations(top2_17[:12], 6))
    best_combo = None
    best_score = -999
    for combo in combos:
        s = calculate_sum(combo)
        if 130 <= s <= 140:
            combo_score = sum(scores2.get(n, 0) for n in combo)
            if combo_score > best_score and not _is_exact_duplicate(list(combo)):
                best_score = combo_score
                best_combo = combo

    if best_combo:
        line10 = sorted(list(best_combo))
    else:
        line10 = _unique_line(lambda: sorted(random.sample(top2_17, 6)))
    line10 = _ensure_unique(line10, top2_17)

    result['logic2'].append(line10)
    all_generated.append(line10)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 로직3 3줄 (상위 18개)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    top3_18 = get_top_candidates(scores3, 18)

    line11 = _unique_line(lambda: select_by_odd_even_balance(random.sample(top3_18, len(top3_18)), (3, 3)))
    line11 = _ensure_unique(line11, top3_18)
    result['logic3'].append(line11)
    all_generated.append(line11)

    line12 = _unique_line(lambda: select_by_zone_balance(random.sample(top3_18, len(top3_18)), (2, 2, 2)))
    line12 = _ensure_unique(line12, top3_18)
    result['logic3'].append(line12)
    all_generated.append(line12)

    # ⑬ 연속 최적화
    combos = list(combinations(top3_18[:12], 6))
    best_combo = None
    best_score = -999
    for combo in combos:
        sorted_combo = sorted(combo)
        if has_consecutive(sorted_combo):
            combo_score = sum(scores3.get(n, 0) for n in combo)
            if combo_score > best_score and not _is_exact_duplicate(sorted_combo):
                best_score = combo_score
                best_combo = sorted_combo

    if best_combo:
        line13 = best_combo
    else:
        line13 = _unique_line(lambda: sorted(random.sample(top3_18, 6)))
    line13 = _ensure_unique(line13, top3_18)

    result['logic3'].append(line13)
    all_generated.append(line13)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 종합 2줄
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    scores_final = {}
    for n in range(1, 46):
        scores_final[n] = (
            scores1.get(n, 0) * ai_weights.get('logic1', 0.33) +
            scores2.get(n, 0) * ai_weights.get('logic2', 0.33) +
            scores3.get(n, 0) * ai_weights.get('logic3', 0.34)
        )

    top_final_18 = get_top_candidates(scores_final, 18)

    line14 = _unique_line(lambda: select_by_zone_balance(random.sample(top_final_18, len(top_final_18)), (2, 2, 2)))
    line14 = _ensure_unique(line14, top_final_18)
    result['final'].append(line14)
    all_generated.append(line14)

    line15 = _unique_line(lambda: sorted(random.sample(top_final_18, 6)))
    line15 = _ensure_unique(line15, top_final_18)
    result['final'].append(line15)
    all_generated.append(line15)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # AI 핵심 5줄 (상위 15개, 다양성 보장)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    ai_core_15 = get_top_candidates(scores_final, 15)
    core_combos = list(combinations(ai_core_15, 6))

    # 각 조합 평가
    scored_combos = []
    for combo in core_combos:
        combo_list = sorted(list(combo))

        # 기존 15줄과 중복 체크
        is_dup = False
        for existing in all_generated:
            if is_duplicate(combo_list, existing, 6):  # 6개 모두 같으면
                is_dup = True
                break

        if is_dup:
            continue

        # 점수 계산
        score = sum(scores_final.get(n, 0) for n in combo)

        # 패턴 보너스
        odd_cnt = sum(1 for n in combo if n % 2 == 1)
        if odd_cnt == 3:
            score += 10

        z1 = sum(1 for n in combo if 1 <= n <= 15)
        z2 = sum(1 for n in combo if 16 <= n <= 30)
        z3 = sum(1 for n in combo if 31 <= n <= 45)
        if (z1, z2, z3) == (2, 2, 2):
            score += 10

        if has_consecutive(combo_list):
            score += 5

        s = calculate_sum(combo)
        if 130 <= s <= 140:
            score += 10

        scored_combos.append((combo_list, score))

    # 점수 상위 30개 중에서 랜덤하게 5줄 선택 (다양성 보장)
    scored_combos.sort(key=lambda x: x[1], reverse=True)
    top_30_combos = scored_combos[:30]  # 상위 30개 후보

    # 랜덤 셔플 후 5개 선택
    random.shuffle(top_30_combos)

    for combo, score in top_30_combos:
        # 이미 선택된 AI 핵심 번호와도 체크
        is_dup = False
        for existing in result['ai_core']:
            if is_duplicate(combo, existing, 5):  # 5개 이상 겹치면
                is_dup = True
                break

        if not is_dup:
            combo = _ensure_unique(combo, ai_core_15)
            result['ai_core'].append(combo)

        if len(result['ai_core']) >= 5:
            break

    # 부족하면 채우기
    while len(result['ai_core']) < 5:
        # 랜덤 조합
        random_combo = sorted(random.sample(ai_core_15, 6))
        result['ai_core'].append(random_combo)

    return result


# 하위 호환성
def generate_15_lines(user_id: int, stats: Dict) -> Dict[str, List[List[int]]]:
    """15줄 생성 (하위 호환용)"""
    result_20 = generate_20_lines(user_id, stats)

    result_15 = {
        'basic': result_20['basic'] + [result_20['logic1'][0]],
        'plan1': result_20['logic1'][1:] + result_20['logic2'][:2],
        'plan2': result_20['logic2'][2:] + result_20['logic3'][:2] + result_20['final']
    }

    return result_15


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 무료 버전 로직
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def generate_free_line(stats: Dict) -> List[int]:
    """
    무료 버전 1줄 생성

    - ML 상위 3개 (점수 제일 높은 번호)
    - 무작위 번호 2개
    - 제일 안 나온 번호 5개 중 1개 랜덤

    Returns:
        6개 번호 리스트
    """
    scores1 = stats['scores_logic1']
    scores2 = stats['scores_logic2']
    scores3 = stats['scores_logic3']
    least_common = stats['least_common']

    # ML 종합 점수 계산
    scores_final = {}
    for n in range(1, 46):
        scores_final[n] = (
            scores1.get(n, 0) * 0.33 +
            scores2.get(n, 0) * 0.33 +
            scores3.get(n, 0) * 0.34
        )

    # 1. ML 상위 3개
    ml_top_3 = get_top_candidates(scores_final, 3)

    # 2. 무작위 번호 2개 (ML 상위 3개와 겹치지 않게)
    available_random = [n for n in range(1, 46) if n not in ml_top_3]
    random_2 = random.sample(available_random, 2)

    # 3. 제일 안 나온 번호 5개 중 1개 (이미 선택된 번호와 겹치지 않게)
    selected = set(ml_top_3 + random_2)
    least_5 = [n for n in least_common[:5] if n not in selected]

    if least_5:
        least_1 = [random.choice(least_5)]
    else:
        # 만약 5개 모두 겹치면 나머지에서 선택
        remaining = [n for n in range(1, 46) if n not in selected]
        least_1 = [random.choice(remaining)]

    # 6개 조합
    result = sorted(ml_top_3 + random_2 + least_1)

    return result


def generate_free_lines(stats: Dict, count: int = 5) -> List[List[int]]:
    """
    무료 버전 여러 줄 생성

    Args:
        stats: 통계 데이터
        count: 생성할 줄 수

    Returns:
        번호 리스트들
    """
    lines = []
    for _ in range(count):
        line = generate_free_line(stats)
        lines.append(line)
    return lines


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 유료 버전 로직 (ML 상위 20개에서 랜덤 선택)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def generate_mixed_line(stats: Dict, issue_count: int) -> List[int]:
    """
    발급 횟수에 따라 무료/유료 번호 반환
    - 4번 무료 → 1번 유료 (5번째마다 유료)

    Args:
        stats: 통계 데이터
        issue_count: 해당 유저의 누적 발급 횟수 (1부터 시작)

    Returns:
        6개 번호 리스트
    """
    if issue_count % 5 == 0:
        # 5번째마다 유료 번호 (1줄)
        paid = generate_paid_lines(stats, 1)
        return paid[0]
    else:
        # 나머지는 무료 번호
        return generate_free_line(stats)


def generate_basic_lines(stats: Dict, count: int = 5) -> List[List[int]]:
    """
    베이직 플랜: ML 상위 20개에서 랜덤 N줄
    """
    scores1 = stats['scores_logic1']
    scores2 = stats['scores_logic2']
    scores3 = stats['scores_logic3']

    scores_final = {}
    for n in range(1, 46):
        scores_final[n] = (
            scores1.get(n, 0) * 0.33 +
            scores2.get(n, 0) * 0.33 +
            scores3.get(n, 0) * 0.34
        )

    ml_top_20 = get_top_candidates(scores_final, 20)

    lines = []
    generated_sets = []

    for _ in range(count):
        for _ in range(10):
            line = sorted(random.sample(ml_top_20, 6))
            line_set = tuple(line)
            if line_set not in generated_sets:
                lines.append(line)
                generated_sets.append(line_set)
                break
        else:
            lines.append(line)

    return lines


def generate_premium_lines(stats: Dict) -> List[List[int]]:
    """
    프리미엄 플랜 10줄:
    - 1~5줄: ML 상위 15개에서 랜덤 6개
    - 6~9줄: ML 상위 10개에서 랜덤 6개
    - 10줄 (AI핵심): ML 상위 10개 중 4개 + least_common 20개 중 2개
    """
    scores1 = stats['scores_logic1']
    scores2 = stats['scores_logic2']
    scores3 = stats['scores_logic3']
    least_common = stats['least_common']

    scores_final = {}
    for n in range(1, 46):
        scores_final[n] = (
            scores1.get(n, 0) * 0.33 +
            scores2.get(n, 0) * 0.33 +
            scores3.get(n, 0) * 0.34
        )

    ml_top_15 = get_top_candidates(scores_final, 15)
    ml_top_10 = get_top_candidates(scores_final, 10)

    lines = []
    generated_sets = []

    # 1~5줄: 상위 15개에서 랜덤 6개
    for _ in range(5):
        for _ in range(10):
            line = sorted(random.sample(ml_top_15, 6))
            line_set = tuple(line)
            if line_set not in generated_sets:
                lines.append(line)
                generated_sets.append(line_set)
                break
        else:
            lines.append(line)

    # 6~9줄: 상위 10개에서 랜덤 6개
    for _ in range(4):
        for _ in range(10):
            line = sorted(random.sample(ml_top_10, 6))
            line_set = tuple(line)
            if line_set not in generated_sets:
                lines.append(line)
                generated_sets.append(line_set)
                break
        else:
            lines.append(line)

    # 10줄 (AI핵심): 상위 10개 중 4개 + least_common 20개 중 2개
    ai_core_line = _generate_ai_core_line(scores_final, least_common, generated_sets)
    lines.append(ai_core_line)
    generated_sets.append(tuple(ai_core_line))

    return lines


def generate_vip_lines(stats: Dict) -> List[List[int]]:
    """
    VIP 플랜: 베이직 5줄 + 프리미엄 10줄 + 풀커버리지 5줄 = 20줄
    - 베이직 5줄 (상위 20개 랜덤)
    - 프리미엄 10줄:
      - 9줄 (상위 15개 랜덤)
      - 1줄 프리미엄 AI 핵심 (ML 상위 10개 중 4개 + least_common 20개 중 2개)
    - 풀커버리지 5줄:
      - 3줄 (상위 13개 랜덤)
      - 1줄 하이브리드 (상위 10개 중 5개 + 랜덤 1개)
      - 1줄 VIP 전용 AI 핵심 (ML 상위 5개 전부 + least_common 20개 중 1개)
    """
    lines = []
    generated_sets = []

    scores1 = stats['scores_logic1']
    scores2 = stats['scores_logic2']
    scores3 = stats['scores_logic3']
    least_common = stats['least_common']

    scores_final = {}
    for n in range(1, 46):
        scores_final[n] = (
            scores1.get(n, 0) * 0.33 +
            scores2.get(n, 0) * 0.33 +
            scores3.get(n, 0) * 0.34
        )

    # 1. 베이직 5줄 (상위 20개 랜덤)
    ml_top_20 = get_top_candidates(scores_final, 20)
    for _ in range(5):
        for _ in range(10):
            line = sorted(random.sample(ml_top_20, 6))
            line_set = tuple(line)
            if line_set not in generated_sets:
                lines.append(line)
                generated_sets.append(line_set)
                break
        else:
            lines.append(line)

    # 2. 프리미엄 9줄 (상위 15개 랜덤)
    ml_top_15 = get_top_candidates(scores_final, 15)
    for _ in range(9):
        for _ in range(10):
            line = sorted(random.sample(ml_top_15, 6))
            line_set = tuple(line)
            if line_set not in generated_sets:
                lines.append(line)
                generated_sets.append(line_set)
                break
        else:
            lines.append(line)

    # 3. 프리미엄 AI 핵심 1줄 (ML 상위 10개 중 4개 + least_common 20개 중 2개)
    ai_core_premium = _generate_ai_core_line(scores_final, least_common, generated_sets)
    lines.append(ai_core_premium)
    generated_sets.append(tuple(ai_core_premium))

    # 4. 상위 13개에서 랜덤 3줄 (고품질)
    ml_top_13 = get_top_candidates(scores_final, 13)
    for _ in range(3):
        for _ in range(10):
            line = sorted(random.sample(ml_top_13, 6))
            line_set = tuple(line)
            if line_set not in generated_sets:
                lines.append(line)
                generated_sets.append(line_set)
                break
        else:
            lines.append(line)

    # 5. 상위 10개 중 5개 + 랜덤 1개 = 1줄 (하이브리드)
    ml_top_10 = get_top_candidates(scores_final, 10)
    all_numbers = list(range(1, 46))
    for _ in range(1):
        for _ in range(10):
            top_5 = random.sample(ml_top_10, 5)
            remaining = [n for n in all_numbers if n not in ml_top_10]
            random_1 = random.choice(remaining)
            line = sorted(top_5 + [random_1])
            line_set = tuple(line)
            if line_set not in generated_sets:
                lines.append(line)
                generated_sets.append(line_set)
                break
        else:
            lines.append(line)

    # 6. VIP 전용 AI 핵심 1줄 (ML 상위 5개 전부 + least_common 20개 중 1개)
    ai_core_vip = _generate_vip_ai_core_line(scores_final, least_common, generated_sets)
    lines.append(ai_core_vip)
    generated_sets.append(tuple(ai_core_vip))

    return lines


def _generate_ai_core_line(scores_final: Dict, least_common: List[int], existing_sets: List[tuple]) -> List[int]:
    """
    프리미엄 AI 핵심 1줄 생성
    - ML 상위 10개 중 랜덤 4개
    - least_common 20개 중 랜덤 2개 (중복 제외)
    """
    # ML 상위 10개 번호
    ml_top_10 = get_top_candidates(scores_final, 10)

    # least_common 20개 중 상위 10개와 겹치지 않는 번호
    available_least = [n for n in least_common[:20] if n not in ml_top_10]

    for _ in range(10):  # 중복 회피 시도
        # 상위 10개 중 랜덤 4개
        random_4 = random.sample(ml_top_10, 4)

        # least_common에서 랜덤 2개
        if len(available_least) >= 2:
            random_2 = random.sample(available_least, 2)
        else:
            remaining = [n for n in range(1, 46) if n not in ml_top_10]
            random_2 = random.sample(remaining, 2)

        result = sorted(random_4 + random_2)

        # 기존 줄과 중복 체크
        if tuple(result) not in existing_sets:
            return result

    # 10번 시도해도 중복이면 그냥 반환
    return result


def _generate_vip_ai_core_line(scores_final: Dict, least_common: List[int], existing_sets: List[tuple]) -> List[int]:
    """
    VIP 전용 AI 핵심 1줄 생성
    - ML 상위 5개 전부
    - least_common 20개 중 랜덤 1개 (중복 제외)
    """
    # ML 상위 5개 번호
    ml_top_5 = get_top_candidates(scores_final, 5)

    # least_common 20개 중 상위 5개와 겹치지 않는 번호
    available_least = [n for n in least_common[:20] if n not in ml_top_5]

    for _ in range(10):  # 중복 회피 시도
        # 상위 5개 전부
        top_5 = list(ml_top_5)

        # least_common에서 랜덤 1개
        if len(available_least) >= 1:
            random_1 = random.choice(available_least)
        else:
            remaining = [n for n in range(1, 46) if n not in ml_top_5]
            random_1 = random.choice(remaining)

        result = sorted(top_5 + [random_1])

        # 기존 줄과 중복 체크
        if tuple(result) not in existing_sets:
            return result

    # 10번 시도해도 중복이면 그냥 반환
    return result


# 하위 호환성 (기존 generate_paid_lines 유지)
def generate_paid_lines(stats: Dict, count: int = 5) -> List[List[int]]:
    """베이직 플랜과 동일 (하위 호환용)"""
    return generate_basic_lines(stats, count)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# AI 고정 후보 및 제외/고정 지원 함수
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def get_ai_fixed_candidates(stats: Dict, plan_type: str) -> List[int]:
    """
    플랜별 AI 고정 후보 번호 반환
    - PREMIUM: ML 상위 15개 중 상위 2개
    - VIP: ML 상위 15개 중 상위 3개
    - BASIC/FREE: 빈 리스트 (고정 기능 없음)
    """
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

    plan_type = plan_type.lower()

    if plan_type == "premium":
        # 상위 15개 중 최상위 2개
        return get_top_candidates(scores_final, 2)
    elif plan_type == "vip":
        # 상위 15개 중 최상위 3개
        return get_top_candidates(scores_final, 3)
    else:
        return []


def generate_basic_lines_with_exclude(
    stats: Dict,
    count: int = 5,
    exclude: List[int] = None,
) -> List[List[int]]:
    """
    베이직 플랜: ML 상위 20개에서 제외 번호 빼고 랜덤 N줄
    """
    exclude = exclude or []
    exclude_set = set(exclude)

    scores1 = stats['scores_logic1']
    scores2 = stats['scores_logic2']
    scores3 = stats['scores_logic3']

    scores_final = {}
    for n in range(1, 46):
        scores_final[n] = (
            scores1.get(n, 0) * 0.33 +
            scores2.get(n, 0) * 0.33 +
            scores3.get(n, 0) * 0.34
        )

    # 상위 20개에서 제외 번호 빼기
    ml_top_20 = get_top_candidates(scores_final, 20)
    candidates = [n for n in ml_top_20 if n not in exclude_set]

    # 후보가 6개 미만이면 제외 번호 빼고 추가
    if len(candidates) < 6:
        all_nums = [n for n in range(1, 46) if n not in exclude_set]
        candidates = sorted(all_nums, key=lambda x: scores_final.get(x, 0), reverse=True)[:20]

    lines = []
    generated_sets = []

    for _ in range(count):
        for _ in range(10):
            line = sorted(random.sample(candidates, min(6, len(candidates))))
            # 후보가 부족하면 추가
            if len(line) < 6:
                remaining = [n for n in range(1, 46) if n not in exclude_set and n not in line]
                line.extend(sorted(random.sample(remaining, 6 - len(line))))
                line = sorted(line)
            line_set = tuple(line)
            if line_set not in generated_sets:
                lines.append(line)
                generated_sets.append(line_set)
                break
        else:
            lines.append(line)

    return lines


def generate_premium_lines_with_fixed(
    stats: Dict,
    exclude: List[int] = None,
    fixed: List[int] = None,
) -> List[List[int]]:
    """
    프리미엄 플랜 10줄 (제외/고정 지원):
    - 고정 번호가 있으면 해당 번호를 포함하고 나머지만 랜덤 선택
    - 1~5줄: ML 상위 15개에서 (고정 제외 후) 랜덤
    - 6~9줄: ML 상위 10개에서 (고정 제외 후) 랜덤
    - 10줄 (AI핵심): ML 상위 10개 중 4개 + least_common 20개 중 2개
    """
    exclude = exclude or []
    fixed = fixed or []
    exclude_set = set(exclude)
    fixed_set = set(fixed)

    scores1 = stats['scores_logic1']
    scores2 = stats['scores_logic2']
    scores3 = stats['scores_logic3']
    least_common = stats['least_common']

    scores_final = {}
    for n in range(1, 46):
        scores_final[n] = (
            scores1.get(n, 0) * 0.33 +
            scores2.get(n, 0) * 0.33 +
            scores3.get(n, 0) * 0.34
        )

    # 상위 후보에서 제외 번호 빼기
    ml_top_15_raw = get_top_candidates(scores_final, 15)
    ml_top_10_raw = get_top_candidates(scores_final, 10)

    ml_top_15 = [n for n in ml_top_15_raw if n not in exclude_set]
    ml_top_10 = [n for n in ml_top_10_raw if n not in exclude_set]

    # 고정 번호가 후보에 없으면 추가 (고정 번호는 제외보다 우선)
    for f in fixed:
        if f not in ml_top_15 and f not in exclude_set:
            ml_top_15.append(f)
        if f not in ml_top_10 and f not in exclude_set:
            ml_top_10.append(f)

    lines = []
    generated_sets = []

    # 고정 번호 (제외 번호가 아닌 것만)
    valid_fixed = [f for f in fixed if f not in exclude_set]
    need_count = 6 - len(valid_fixed)

    # 1~5줄: 상위 15개에서 (고정 제외 후) 랜덤
    pool_15 = [n for n in ml_top_15 if n not in fixed_set]
    for _ in range(5):
        for _ in range(10):
            if len(pool_15) >= need_count:
                random_picks = random.sample(pool_15, need_count)
            else:
                # 후보 부족 시 전체에서 추가
                remaining = [n for n in range(1, 46) if n not in exclude_set and n not in fixed_set]
                random_picks = random.sample(remaining, need_count)
            line = sorted(valid_fixed + random_picks)
            line_set = tuple(line)
            if line_set not in generated_sets:
                lines.append(line)
                generated_sets.append(line_set)
                break
        else:
            lines.append(line)

    # 6~9줄: 상위 10개에서 (고정 제외 후) 랜덤
    pool_10 = [n for n in ml_top_10 if n not in fixed_set]
    for _ in range(4):
        for _ in range(10):
            if len(pool_10) >= need_count:
                random_picks = random.sample(pool_10, need_count)
            else:
                remaining = [n for n in range(1, 46) if n not in exclude_set and n not in fixed_set]
                random_picks = random.sample(remaining, need_count)
            line = sorted(valid_fixed + random_picks)
            line_set = tuple(line)
            if line_set not in generated_sets:
                lines.append(line)
                generated_sets.append(line_set)
                break
        else:
            lines.append(line)

    # 10줄 (AI핵심): 상위 10개 중 4개 + least_common 20개 중 2개
    # AI 핵심은 고정 번호 로직과 별개로 유지
    ai_core_line = _generate_ai_core_line(scores_final, least_common, generated_sets)
    lines.append(ai_core_line)

    return lines


def generate_vip_lines_with_fixed(
    stats: Dict,
    exclude: List[int] = None,
    fixed: List[int] = None,
) -> List[List[int]]:
    """
    VIP 플랜 20줄 (제외/고정 지원):
    - 고정 번호가 있으면 해당 번호를 포함하고 나머지만 랜덤 선택
    - 베이직 5줄 (상위 20개 랜덤)
    - 프리미엄 10줄: 9줄 (상위 15개 랜덤) + 1줄 AI 핵심
    - 풀커버리지 5줄: 3줄 (상위 13개 랜덤) + 1줄 하이브리드 + 1줄 VIP AI 핵심
    """
    exclude = exclude or []
    fixed = fixed or []
    exclude_set = set(exclude)
    fixed_set = set(fixed)

    lines = []
    generated_sets = []

    scores1 = stats['scores_logic1']
    scores2 = stats['scores_logic2']
    scores3 = stats['scores_logic3']
    least_common = stats['least_common']

    scores_final = {}
    for n in range(1, 46):
        scores_final[n] = (
            scores1.get(n, 0) * 0.33 +
            scores2.get(n, 0) * 0.33 +
            scores3.get(n, 0) * 0.34
        )

    # 상위 후보에서 제외 번호 빼기
    ml_top_20 = [n for n in get_top_candidates(scores_final, 20) if n not in exclude_set]
    ml_top_15 = [n for n in get_top_candidates(scores_final, 15) if n not in exclude_set]
    ml_top_13 = [n for n in get_top_candidates(scores_final, 13) if n not in exclude_set]
    ml_top_10 = [n for n in get_top_candidates(scores_final, 10) if n not in exclude_set]

    # 고정 번호 (제외 번호가 아닌 것만)
    valid_fixed = [f for f in fixed if f not in exclude_set]
    need_count = 6 - len(valid_fixed)

    def _gen_line_with_fixed(pool: List[int]) -> List[int]:
        """고정 번호 포함하여 라인 생성"""
        available = [n for n in pool if n not in fixed_set]
        if len(available) >= need_count:
            random_picks = random.sample(available, need_count)
        else:
            remaining = [n for n in range(1, 46) if n not in exclude_set and n not in fixed_set]
            random_picks = random.sample(remaining, need_count)
        return sorted(valid_fixed + random_picks)

    # 1. 베이직 5줄 (상위 20개 랜덤)
    for _ in range(5):
        for _ in range(10):
            line = _gen_line_with_fixed(ml_top_20)
            line_set = tuple(line)
            if line_set not in generated_sets:
                lines.append(line)
                generated_sets.append(line_set)
                break
        else:
            lines.append(line)

    # 2. 프리미엄 9줄 (상위 15개 랜덤)
    for _ in range(9):
        for _ in range(10):
            line = _gen_line_with_fixed(ml_top_15)
            line_set = tuple(line)
            if line_set not in generated_sets:
                lines.append(line)
                generated_sets.append(line_set)
                break
        else:
            lines.append(line)

    # 3. 프리미엄 AI 핵심 1줄
    ai_core_premium = _generate_ai_core_line(scores_final, least_common, generated_sets)
    lines.append(ai_core_premium)
    generated_sets.append(tuple(ai_core_premium))

    # 4. 상위 13개에서 랜덤 3줄 (고품질)
    for _ in range(3):
        for _ in range(10):
            line = _gen_line_with_fixed(ml_top_13)
            line_set = tuple(line)
            if line_set not in generated_sets:
                lines.append(line)
                generated_sets.append(line_set)
                break
        else:
            lines.append(line)

    # 5. 상위 10개 중 5개 + 랜덤 1개 = 1줄 (하이브리드)
    all_numbers = [n for n in range(1, 46) if n not in exclude_set]
    for _ in range(1):
        for _ in range(10):
            top_pool = [n for n in ml_top_10 if n not in fixed_set]
            if len(valid_fixed) >= 5:
                # 고정이 5개 이상이면 고정만 사용
                top_5 = valid_fixed[:5]
            elif len(valid_fixed) > 0:
                # 고정 + 나머지 상위에서
                top_5 = valid_fixed + random.sample(top_pool, min(5 - len(valid_fixed), len(top_pool)))
            else:
                top_5 = random.sample(top_pool, min(5, len(top_pool)))

            remaining = [n for n in all_numbers if n not in ml_top_10 and n not in fixed_set]
            if remaining:
                random_1 = random.choice(remaining)
            else:
                random_1 = random.choice([n for n in all_numbers if n not in top_5])
            line = sorted(top_5 + [random_1])
            line_set = tuple(line)
            if line_set not in generated_sets:
                lines.append(line)
                generated_sets.append(line_set)
                break
        else:
            lines.append(line)

    # 6. VIP 전용 AI 핵심 1줄
    ai_core_vip = _generate_vip_ai_core_line(scores_final, least_common, generated_sets)
    lines.append(ai_core_vip)
    generated_sets.append(tuple(ai_core_vip))

    return lines
