# AI-LOTTO 개발 완료 계획서

> 작성일: 2026-02-02
> 현재 완료율: 93% → 목표: 100%
>
> **참고**: 결제(PG), 이메일, SMS 서비스는 대행사 인증 대기 중으로 본 계획에서 제외

---

## 목차

0. [Phase 0: 모바일 UI 긴급 수정](#phase-0-모바일-ui-긴급-수정)
1. [Phase 1: 긴급 수정](#phase-1-긴급-수정)
2. [Phase 2: 고급 번호 설정](#phase-2-고급-번호-설정)
3. [Phase 3: 패턴 분석 심화](#phase-3-패턴-분석-심화)
4. [Phase 4: 성능 추적 시스템](#phase-4-성능-추적-시스템)
5. [Phase 5: ML 모델 학습](#phase-5-ml-모델-학습)
6. [Phase 6: 푸시 알림 시스템](#phase-6-푸시-알림-시스템)

---

## 제외된 항목 (대행사 인증 대기)

다음 항목들은 대행사 인증 완료 후 별도 진행:

- **결제 시스템 (PG)**: 토스페이먼츠 연동
- **이메일 서비스**: SendGrid 연동
- **SMS 서비스**: 알림톡/SMS 발송

---

## Phase 0: 모바일 UI 긴급 수정

### 0.1 알림 드롭다운 닫기 버튼 (완료)

**문제**: 알림 드롭다운 열면 닫기 버튼이 없어서 앱을 재시작해야 함

**해결**:
- `Header.jsx`: 알림 드롭다운 하단에 "닫기" 버튼 추가
- `components.css`: `.notification-dropdown__footer`, `.notification-dropdown__close` 스타일 추가

**수정 파일**:
- `react-app/src/components/Header.jsx`
- `react-app/src/styles/components.css`

### 0.2 모바일 히스토리 페이지 가로 스크롤 (완료)

**문제**: 모바일에서 히스토리 페이지가 좌우 스크롤됨

**해결**:
- `components.css` 768px 미디어쿼리에 다음 추가:
  - `.history-page`, `.history-content`, `.history-content__inner`, `.history-cards`: `overflow-x: hidden; max-width: 100vw;`
  - `.history-card`: `overflow: hidden; max-width: 100%;`
  - 로또볼 크기 조정: `width: 32px; height: 32px;`

**수정 파일**:
- `react-app/src/styles/components.css`

### 0.3 확인 버튼 모바일 사이즈 (완료)

**문제**: 마이페이지/히스토리의 "확인" 버튼이 모바일에서 너무 작거나 레이아웃 깨짐

**해결**:
- `.mypage-lines__item-check-btn` 모바일 스타일 강화:
  - `width: 100%; padding: 12px 16px; font-size: 14px; min-height: 44px;`
- `.history-card__check-btn` 모바일 스타일 추가

**수정 파일**:
- `react-app/src/styles/components.css`

### 0.4 알림 시스템 구조 개선 (TODO)

**문제**: 로그인 알림이 토스트처럼 5초 후 자동 삭제되어 드롭다운에서 보이지 않음

**현재 동작**:
- `NotificationContext.jsx`에서 알림 추가 시 `autoClose !== false`면 5초 후 자동 삭제
- 드롭다운은 현재 남아있는 알림만 표시

**해결 방안 (2가지 중 선택)**:

**옵션 A: 토스트와 영구 알림 분리 (권장)**
```javascript
// NotificationContext.jsx
const [toasts, setToasts] = useState([])      // 토스트 (자동 삭제)
const [notifications, setNotifications] = useState([])  // 영구 (드롭다운용)

const addToast = (notification) => {
  // 5초 후 자동 삭제
}

const addNotification = (notification) => {
  // 영구 저장 (드롭다운용)
}
```

**옵션 B: 알림 유지 시간 연장 + localStorage 저장**
```javascript
// NotificationContext.jsx
const addNotification = useCallback((notification) => {
  // ...
  if (notification.autoClose !== false) {
    setTimeout(() => removeNotification(id), notification.duration || 30000) // 30초로 연장
  }
  // localStorage에도 저장
  const saved = JSON.parse(localStorage.getItem('notifications') || '[]')
  localStorage.setItem('notifications', JSON.stringify([newNotification, ...saved].slice(0, 20)))
}, [])
```

**수정 파일**:
- `react-app/src/context/NotificationContext.jsx`
- `react-app/src/components/Header.jsx`

### 0.5 플랜 설정 / 알림 설정 (TODO)

**문제**: 플랜 관리, 알림 설정 등이 마이페이지에서 "준비 중" 또는 기능 미동작

**현재 상태**:
- 플랜 관리: `/mypage?tab=subscription` - 구현됨 (결제 연동 대기)
- 알림 설정: `/mypage?tab=notifications` - localStorage 기반 구현됨

**추가 필요**:
- 플랜 관리: 결제 연동 대기 중 (대행사 인증 후 진행)
- 푸시 알림 설정 연동 (Phase 6 참조)

---

## Phase 1: 긴급 수정

### 1.1 OAuth 환경변수 통일

**문제**: Signup.jsx에서 `VITE_API_BASE` 사용 중 (다른 파일은 `VITE_API_BASE_URL`)

**수정 파일**:
- `react-app/src/pages/Auth/Signup.jsx`

**변경 내용**:
```javascript
// Before
const API_BASE = import.meta.env.VITE_API_BASE || ''

// After
import { API_BASE_URL } from '../../api/client.js'
```

**검증**: 소셜 로그인 버튼 클릭 시 올바른 URL로 리다이렉트 확인

---

## Phase 2: 고급 번호 설정

### 2.1 백엔드 API 확장

**수정 파일**: `backend/app/api/lotto.py`

```python
class AdvancedGenerateRequest(BaseModel):
    count: int = 5
    exclude_numbers: list[int] = []  # 제외할 번호
    fixed_numbers: list[int] = []    # 고정할 번호
    # 새로 추가
    range_filter: Optional[dict] = None  # {"min": 1, "max": 30}
    odd_even_ratio: Optional[str] = None  # "3:3", "4:2", "any"
    consecutive_limit: Optional[int] = None  # 최대 연속 번호 개수
    sum_range: Optional[dict] = None  # {"min": 100, "max": 150}

@router.post("/recommend/advanced")
def generate_advanced_numbers(
    req: AdvancedGenerateRequest,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    # 플랜별 제한 확인
    plan_limits = {
        "FREE": {"exclude": 0, "fixed": 0, "advanced": False},
        "BASIC": {"exclude": 0, "fixed": 0, "advanced": False},
        "PREMIUM": {"exclude": 2, "fixed": 2, "advanced": True},
        "VIP": {"exclude": 3, "fixed": 3, "advanced": True}
    }

    limits = plan_limits.get(user.tier, plan_limits["FREE"])

    if len(req.exclude_numbers) > limits["exclude"]:
        raise HTTPException(400, f"제외 번호는 최대 {limits['exclude']}개까지 가능합니다.")

    if len(req.fixed_numbers) > limits["fixed"]:
        raise HTTPException(400, f"고정 번호는 최대 {limits['fixed']}개까지 가능합니다.")

    if (req.range_filter or req.odd_even_ratio or req.consecutive_limit) and not limits["advanced"]:
        raise HTTPException(403, "고급 설정은 Premium 이상 플랜에서 사용 가능합니다.")

    # 번호 생성 로직
    numbers = generate_with_advanced_options(
        count=req.count,
        exclude=req.exclude_numbers,
        fixed=req.fixed_numbers,
        range_filter=req.range_filter,
        odd_even_ratio=req.odd_even_ratio,
        consecutive_limit=req.consecutive_limit,
        sum_range=req.sum_range
    )

    return {"numbers": numbers}
```

### 2.2 번호 생성 로직 확장

**수정 파일**: `backend/app/services/lotto/generator.py`

```python
def generate_with_advanced_options(
    count: int,
    exclude: list[int],
    fixed: list[int],
    range_filter: dict = None,
    odd_even_ratio: str = None,
    consecutive_limit: int = None,
    sum_range: dict = None
) -> list[list[int]]:
    results = []
    max_attempts = 1000

    for _ in range(count):
        for attempt in range(max_attempts):
            # 1. 기본 풀 생성 (1-45)
            pool = set(range(1, 46))

            # 2. 제외 번호 제거
            pool -= set(exclude)

            # 3. 범위 필터 적용
            if range_filter:
                pool = {n for n in pool if range_filter["min"] <= n <= range_filter["max"]}

            # 4. 고정 번호 시작
            line = list(fixed)
            remaining = 6 - len(fixed)
            pool -= set(fixed)

            # 5. 나머지 번호 선택
            candidates = list(pool)
            random.shuffle(candidates)
            line.extend(candidates[:remaining])
            line.sort()

            # 6. 검증
            if not validate_line(line, odd_even_ratio, consecutive_limit, sum_range):
                continue

            results.append(line)
            break

    return results

def validate_line(line: list[int], odd_even_ratio: str, consecutive_limit: int, sum_range: dict) -> bool:
    # 홀짝 비율 검증
    if odd_even_ratio and odd_even_ratio != "any":
        odd_count = sum(1 for n in line if n % 2 == 1)
        even_count = 6 - odd_count
        target_odd, target_even = map(int, odd_even_ratio.split(":"))
        if odd_count != target_odd or even_count != target_even:
            return False

    # 연속 번호 제한 검증
    if consecutive_limit:
        sorted_line = sorted(line)
        max_consecutive = 1
        current_consecutive = 1
        for i in range(1, len(sorted_line)):
            if sorted_line[i] == sorted_line[i-1] + 1:
                current_consecutive += 1
                max_consecutive = max(max_consecutive, current_consecutive)
            else:
                current_consecutive = 1
        if max_consecutive > consecutive_limit:
            return False

    # 합계 범위 검증
    if sum_range:
        total = sum(line)
        if not (sum_range["min"] <= total <= sum_range["max"]):
            return False

    return True
```

### 2.3 프론트엔드 UI 추가

**수정 파일**: `react-app/src/pages/Lotto/Recommend.jsx`

고급 설정 패널 UI 추가:
- 범위 필터 슬라이더 (1-45)
- 홀짝 비율 선택 (3:3, 4:2, 2:4, any)
- 연속 번호 제한 (1-3)
- 합계 범위 슬라이더 (21-255)

---

## Phase 3: 패턴 분석 심화

### 3.1 시간대별 당첨 분석

**수정 파일**: `backend/app/services/lotto/stats_calculator.py`

```python
def analyze_time_patterns(db: Session, limit: int = 100) -> dict:
    """발표 시간대별 당첨 번호 패턴 분석"""
    draws = db.query(LottoDraw).order_by(LottoDraw.round.desc()).limit(limit).all()

    # 요일별 분석
    weekday_stats = {i: {"count": 0, "numbers": [], "avg_sum": 0} for i in range(7)}

    # 월별 분석
    monthly_stats = {i: {"count": 0, "numbers": [], "avg_sum": 0} for i in range(1, 13)}

    # 계절별 분석
    season_stats = {
        "spring": {"months": [3, 4, 5], "count": 0, "numbers": []},
        "summer": {"months": [6, 7, 8], "count": 0, "numbers": []},
        "fall": {"months": [9, 10, 11], "count": 0, "numbers": []},
        "winter": {"months": [12, 1, 2], "count": 0, "numbers": []}
    }

    for draw in draws:
        draw_date = draw.draw_date
        weekday = draw_date.weekday()
        month = draw_date.month
        numbers = parse_numbers(draw.numbers)

        # 요일별 집계
        weekday_stats[weekday]["count"] += 1
        weekday_stats[weekday]["numbers"].extend(numbers)
        weekday_stats[weekday]["avg_sum"] += sum(numbers)

        # 월별 집계
        monthly_stats[month]["count"] += 1
        monthly_stats[month]["numbers"].extend(numbers)

        # 계절별 집계
        for season, data in season_stats.items():
            if month in data["months"]:
                data["count"] += 1
                data["numbers"].extend(numbers)

    # 통계 계산
    result = {
        "weekday": {},
        "monthly": {},
        "seasonal": {}
    }

    weekday_names = ["월", "화", "수", "목", "금", "토", "일"]
    for i, name in enumerate(weekday_names):
        if weekday_stats[i]["count"] > 0:
            numbers = weekday_stats[i]["numbers"]
            result["weekday"][name] = {
                "count": weekday_stats[i]["count"],
                "top_numbers": Counter(numbers).most_common(10),
                "avg_sum": weekday_stats[i]["avg_sum"] / weekday_stats[i]["count"]
            }

    return result

def analyze_number_cycles(db: Session, number: int, limit: int = 200) -> dict:
    """특정 번호의 출현 주기 분석"""
    draws = db.query(LottoDraw).order_by(LottoDraw.round.desc()).limit(limit).all()

    appearances = []
    last_round = None
    gaps = []

    for draw in draws:
        numbers = parse_numbers(draw.numbers)
        if number in numbers:
            appearances.append(draw.round)
            if last_round:
                gaps.append(last_round - draw.round)
            last_round = draw.round

    return {
        "number": number,
        "total_appearances": len(appearances),
        "appearance_rate": len(appearances) / limit * 100,
        "avg_gap": sum(gaps) / len(gaps) if gaps else 0,
        "min_gap": min(gaps) if gaps else 0,
        "max_gap": max(gaps) if gaps else 0,
        "last_appearance": appearances[0] if appearances else None,
        "current_gap": draws[0].round - appearances[0] if appearances else None
    }
```

### 3.2 API 엔드포인트 추가

**수정 파일**: `backend/app/api/lotto.py`

```python
@router.get("/stats/time-patterns")
def get_time_patterns(db: Session = Depends(get_db)):
    """시간대별 패턴 분석"""
    return analyze_time_patterns(db)

@router.get("/stats/number-cycle/{number}")
def get_number_cycle(number: int, db: Session = Depends(get_db)):
    """특정 번호 출현 주기 분석"""
    if not 1 <= number <= 45:
        raise HTTPException(400, "번호는 1-45 사이여야 합니다.")
    return analyze_number_cycles(db, number)

@router.get("/stats/hot-cold")
def get_hot_cold_numbers(db: Session = Depends(get_db), period: int = 10):
    """핫/콜드 번호 분석"""
    draws = db.query(LottoDraw).order_by(LottoDraw.round.desc()).limit(period).all()

    counter = Counter()
    for draw in draws:
        numbers = parse_numbers(draw.numbers)
        counter.update(numbers)

    hot = counter.most_common(10)
    cold = counter.most_common()[-10:]

    return {
        "period": period,
        "hot_numbers": [{"number": n, "count": c} for n, c in hot],
        "cold_numbers": [{"number": n, "count": c} for n, c in reversed(cold)]
    }
```

### 3.3 프론트엔드 Stats 페이지 확장

**수정 파일**: `react-app/src/pages/Lotto/Stats.jsx`

새로운 탭/섹션 추가:
- 시간대별 패턴 차트
- 번호별 출현 주기 검색
- 핫/콜드 번호 시각화

---

## Phase 4: 성능 추적 시스템

### 4.1 개별 사용자 성능 추적

**수정 파일**: `backend/app/services/lotto/performance_evaluator.py`

```python
def evaluate_user_performance(db: Session, user_id: int, period_rounds: int = 10) -> dict:
    """개별 사용자의 AI 추천 적중률 평가"""

    # 사용자의 추천 이력 조회
    recommendations = db.query(RecommendationHistory).filter(
        RecommendationHistory.user_id == user_id
    ).order_by(RecommendationHistory.round.desc()).limit(period_rounds).all()

    results = {
        "total_lines": 0,
        "matches": {"0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0},
        "total_prize": 0,
        "best_match": 0,
        "rounds_analyzed": 0
    }

    for rec in recommendations:
        draw = db.query(LottoDraw).filter(LottoDraw.round == rec.round).first()
        if not draw or not draw.numbers:
            continue

        winning_numbers = set(parse_numbers(draw.numbers))
        user_lines = rec.lines  # JSON 저장된 추천 번호들

        results["rounds_analyzed"] += 1

        for line in user_lines:
            results["total_lines"] += 1
            match_count = len(set(line) & winning_numbers)
            results["matches"][str(match_count)] += 1
            results["best_match"] = max(results["best_match"], match_count)

            # 상금 계산 (근사치)
            prize_table = {3: 5000, 4: 50000, 5: 1500000, 6: 2000000000}
            results["total_prize"] += prize_table.get(match_count, 0)

    # 적중률 계산
    if results["total_lines"] > 0:
        results["match_rate_3plus"] = (
            results["matches"]["3"] + results["matches"]["4"] +
            results["matches"]["5"] + results["matches"]["6"]
        ) / results["total_lines"] * 100
    else:
        results["match_rate_3plus"] = 0

    return results

def compare_with_average(db: Session, user_id: int) -> dict:
    """전체 사용자 평균 대비 성능 비교"""
    user_perf = evaluate_user_performance(db, user_id)

    # 전체 사용자 평균 계산
    all_users = db.query(User).filter(User.tier != "FREE").all()
    avg_match_rate = 0

    for user in all_users:
        perf = evaluate_user_performance(db, user.id)
        avg_match_rate += perf.get("match_rate_3plus", 0)

    avg_match_rate /= len(all_users) if all_users else 1

    return {
        "user_performance": user_perf,
        "average_performance": avg_match_rate,
        "percentile": calculate_percentile(user_perf["match_rate_3plus"], all_users)
    }
```

### 4.2 플랜별 성능 비교

**수정 파일**: `backend/app/api/admin.py`

```python
@router.get("/stats/performance-by-plan")
def get_performance_by_plan(db: Session = Depends(get_db), admin = Depends(require_admin)):
    """플랜별 AI 추천 성능 비교"""
    plans = ["FREE", "BASIC", "PREMIUM", "VIP"]
    results = {}

    for plan in plans:
        users = db.query(User).filter(User.tier == plan).all()
        if not users:
            results[plan] = {"users": 0, "avg_match_rate": 0}
            continue

        total_rate = 0
        for user in users:
            perf = evaluate_user_performance(db, user.id)
            total_rate += perf.get("match_rate_3plus", 0)

        results[plan] = {
            "users": len(users),
            "avg_match_rate": total_rate / len(users)
        }

    return results
```

### 4.3 마이페이지 성능 탭

**새 파일**: `react-app/src/pages/Account/components/PerformanceTab.jsx`

```javascript
function PerformanceTab() {
  const [performance, setPerformance] = useState(null)

  useEffect(() => {
    fetchMyPerformance().then(setPerformance)
  }, [])

  return (
    <div className="performance-tab">
      <h3>내 AI 추천 성적</h3>

      {performance && (
        <>
          <div className="performance-summary">
            <div className="stat-card">
              <span className="label">분석된 회차</span>
              <span className="value">{performance.rounds_analyzed}회</span>
            </div>
            <div className="stat-card">
              <span className="label">총 추천 라인</span>
              <span className="value">{performance.total_lines}줄</span>
            </div>
            <div className="stat-card">
              <span className="label">3개 이상 적중률</span>
              <span className="value">{performance.match_rate_3plus.toFixed(1)}%</span>
            </div>
            <div className="stat-card">
              <span className="label">최고 적중</span>
              <span className="value">{performance.best_match}개</span>
            </div>
          </div>

          <div className="match-distribution">
            <h4>적중 분포</h4>
            {/* 차트 컴포넌트 */}
          </div>
        </>
      )}
    </div>
  )
}
```

---

## Phase 5: ML 모델 학습

### 5.1 학습 데이터셋 구성

**새 파일**: `backend/app/services/lotto/ml_dataset.py`

```python
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split

def prepare_training_data(db: Session, lookback: int = 10) -> tuple:
    """ML 학습용 데이터셋 생성"""
    draws = db.query(LottoDraw).order_by(LottoDraw.round.asc()).all()

    features = []
    labels = []

    for i in range(lookback, len(draws)):
        # 이전 N회차 데이터로 특성 생성
        prev_draws = draws[i-lookback:i]

        feature_vector = []

        # 1. 각 번호별 출현 빈도 (45개)
        freq = [0] * 45
        for draw in prev_draws:
            for num in parse_numbers(draw.numbers):
                freq[num - 1] += 1
        feature_vector.extend(freq)

        # 2. 홀짝 비율 평균
        odd_ratios = []
        for draw in prev_draws:
            nums = parse_numbers(draw.numbers)
            odd_ratios.append(sum(1 for n in nums if n % 2 == 1) / 6)
        feature_vector.append(np.mean(odd_ratios))

        # 3. 합계 평균/표준편차
        sums = [sum(parse_numbers(d.numbers)) for d in prev_draws]
        feature_vector.append(np.mean(sums))
        feature_vector.append(np.std(sums))

        # 4. 연속 번호 출현 빈도
        consecutive_counts = []
        for draw in prev_draws:
            nums = sorted(parse_numbers(draw.numbers))
            cons = sum(1 for j in range(len(nums)-1) if nums[j+1] - nums[j] == 1)
            consecutive_counts.append(cons)
        feature_vector.append(np.mean(consecutive_counts))

        features.append(feature_vector)

        # 레이블: 다음 회차 당첨 번호 (원-핫 인코딩)
        next_numbers = parse_numbers(draws[i].numbers)
        label = [1 if (j+1) in next_numbers else 0 for j in range(45)]
        labels.append(label)

    X = np.array(features)
    y = np.array(labels)

    return train_test_split(X, y, test_size=0.2, random_state=42)
```

### 5.2 ML 모델 구현

**수정 파일**: `backend/app/services/lotto/ml_trainer.py`

```python
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import precision_score, recall_score
import joblib
import os

MODEL_PATH = "models/lotto_predictor.joblib"

class LottoMLTrainer:
    def __init__(self):
        self.model = None
        self.model_type = "ensemble"

    def train(self, db: Session):
        """모델 학습"""
        X_train, X_test, y_train, y_test = prepare_training_data(db)

        # 앙상블 모델 (각 번호별 개별 분류기)
        self.models = {}

        for num_idx in range(45):
            # 각 번호에 대해 개별 분류기 학습
            clf = GradientBoostingClassifier(
                n_estimators=100,
                max_depth=5,
                random_state=42
            )
            clf.fit(X_train, y_train[:, num_idx])
            self.models[num_idx] = clf

        # 모델 평가
        predictions = self.predict_proba(X_test)
        metrics = self.evaluate(y_test, predictions)

        # 모델 저장
        self.save_model()

        return metrics

    def predict_proba(self, X) -> np.ndarray:
        """각 번호의 출현 확률 예측"""
        probas = np.zeros((len(X), 45))

        for num_idx, clf in self.models.items():
            probas[:, num_idx] = clf.predict_proba(X)[:, 1]

        return probas

    def generate_numbers(self, db: Session, count: int = 6) -> list[int]:
        """학습된 모델로 번호 생성"""
        # 최근 데이터로 특성 생성
        X = prepare_current_features(db)

        # 확률 예측
        probas = self.predict_proba(X)[0]

        # 상위 확률 번호 중 랜덤 선택
        top_indices = np.argsort(probas)[-15:]  # 상위 15개
        selected = np.random.choice(top_indices, size=count, replace=False)

        return sorted([idx + 1 for idx in selected])

    def save_model(self):
        os.makedirs("models", exist_ok=True)
        joblib.dump(self.models, MODEL_PATH)

    def load_model(self):
        if os.path.exists(MODEL_PATH):
            self.models = joblib.load(MODEL_PATH)
            return True
        return False

    def evaluate(self, y_true, y_pred_proba, threshold=0.5) -> dict:
        """모델 성능 평가"""
        y_pred = (y_pred_proba > threshold).astype(int)

        precision = precision_score(y_true, y_pred, average='micro')
        recall = recall_score(y_true, y_pred, average='micro')

        return {
            "precision": precision,
            "recall": recall,
            "f1": 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
        }
```

### 5.3 학습 스케줄러

**수정 파일**: `backend/app/scheduler/jobs.py`

```python
@scheduler.scheduled_job('cron', day_of_week='sun', hour=3, minute=0)
def retrain_ml_model():
    """매주 일요일 03시 - ML 모델 재학습"""
    from app.services.lotto.ml_trainer import LottoMLTrainer
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        trainer = LottoMLTrainer()
        metrics = trainer.train(db)
        print(f"ML Model retrained: {metrics}")
    finally:
        db.close()
```

### 5.4 관리자 ML 탭

**수정 파일**: `react-app/src/pages/Admin/components/MLTab.jsx`

- 모델 학습 현황
- 정확도 지표 표시
- 수동 재학습 버튼
- 학습 이력 로그

---

## Phase 6: 푸시 알림 시스템

### 6.1 Firebase Cloud Messaging 설정

**설치**:
```bash
# 백엔드
pip install firebase-admin

# 프론트엔드
npm install firebase
```

### 6.2 백엔드 FCM 서비스

**새 파일**: `backend/app/services/push/fcm_client.py`

```python
import firebase_admin
from firebase_admin import credentials, messaging
import os

cred = credentials.Certificate(os.getenv("FIREBASE_CREDENTIALS_PATH"))
firebase_admin.initialize_app(cred)

class FCMClient:
    def send_to_user(self, user_token: str, title: str, body: str, data: dict = None):
        """개별 사용자에게 푸시 알림 발송"""
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
            token=user_token
        )
        return messaging.send(message)

    def send_to_topic(self, topic: str, title: str, body: str, data: dict = None):
        """토픽 구독자 전체에게 발송"""
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
            topic=topic
        )
        return messaging.send(message)

    def send_weekly_numbers_push(self, user_token: str, round_no: int):
        """주간 번호 발송 푸시"""
        return self.send_to_user(
            user_token,
            f"[팡팡로또] {round_no}회차 추천 번호",
            "이번 주 AI 추천 번호가 도착했습니다. 지금 확인하세요!",
            {"type": "weekly_numbers", "round": str(round_no)}
        )

    def send_result_push(self, user_token: str, round_no: int, match_count: int):
        """당첨 결과 푸시"""
        return self.send_to_user(
            user_token,
            f"[팡팡로또] {round_no}회차 결과",
            f"최고 {match_count}개 일치! 자세한 결과를 확인하세요.",
            {"type": "result", "round": str(round_no), "match": str(match_count)}
        )
```

### 6.3 FCM 토큰 저장

**DB 모델 추가** (`backend/app/db/models.py`):

```python
class UserDevice(Base):
    __tablename__ = "user_devices"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    fcm_token = Column(String(500), nullable=False)
    device_type = Column(String(20))  # web, android, ios
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
```

### 6.4 프론트엔드 FCM 설정

**새 파일**: `react-app/src/services/firebase.js`

```javascript
import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

const app = initializeApp(firebaseConfig)
const messaging = getMessaging(app)

export async function requestNotificationPermission() {
  const permission = await Notification.requestPermission()
  if (permission === 'granted') {
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
    })
    return token
  }
  return null
}

export function onForegroundMessage(callback) {
  return onMessage(messaging, (payload) => {
    callback(payload)
  })
}
```

### 6.5 Service Worker

**새 파일**: `react-app/public/firebase-messaging-sw.js`

```javascript
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: '...',
  projectId: '...',
  messagingSenderId: '...',
  appId: '...'
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification
  self.registration.showNotification(title, {
    body,
    icon: '/logo192.png'
  })
})
```

### 6.6 알림 설정 UI

**수정 파일**: `react-app/src/pages/Account/components/NotificationsTab.jsx`

```javascript
import { requestNotificationPermission } from '../../../services/firebase'
import { registerFCMToken } from '../../../api/authApi'

function NotificationsTab() {
  const [pushEnabled, setPushEnabled] = useState(false)

  const enablePush = async () => {
    const token = await requestNotificationPermission()
    if (token) {
      await registerFCMToken(token)
      setPushEnabled(true)
    }
  }

  return (
    <div className="notifications-tab">
      <div className="notification-setting">
        <label>푸시 알림</label>
        <button onClick={enablePush} disabled={pushEnabled}>
          {pushEnabled ? '활성화됨' : '활성화하기'}
        </button>
      </div>

      {pushEnabled && (
        <div className="notification-options">
          <label>
            <input type="checkbox" /> 주간 추천 번호 알림
          </label>
          <label>
            <input type="checkbox" /> 당첨 결과 알림
          </label>
          <label>
            <input type="checkbox" /> 구독 만료 알림
          </label>
        </div>
      )}
    </div>
  )
}
```

---

## 체크리스트

### Phase 0 (모바일 UI)
- [x] 알림 드롭다운 닫기 버튼
- [x] 히스토리 페이지 가로 스크롤 수정
- [x] 확인 버튼 모바일 사이즈
- [ ] 알림 시스템 구조 개선 (토스트/영구 분리)
- [ ] 플랜 설정 / 알림 설정 완성

### Phase 1 (긴급 수정)
- [ ] OAuth 환경변수 통일

### Phase 2 (고급 번호 설정)
- [ ] 백엔드 API 확장
- [ ] 번호 생성 로직 확장
- [ ] 프론트엔드 UI 추가

### Phase 3 (패턴 분석)
- [ ] 시간대별 패턴 분석
- [ ] 번호 주기 분석
- [ ] 핫/콜드 번호 분석
- [ ] Stats 페이지 UI 확장

### Phase 4 (성능 추적)
- [ ] 개별 사용자 성능 추적
- [ ] 플랜별 성능 비교
- [ ] 마이페이지 성능 탭

### Phase 5 (ML 모델)
- [ ] 학습 데이터셋 구성
- [ ] ML 모델 구현
- [ ] 모델 평가 시스템
- [ ] 학습 스케줄러
- [ ] 관리자 ML 탭

### Phase 6 (푸시 알림)
- [ ] Firebase 프로젝트 생성
- [ ] FCM 백엔드 서비스
- [ ] FCM 토큰 관리
- [ ] 프론트엔드 FCM 연동
- [ ] Service Worker 설정
- [ ] 알림 설정 UI

---

## 대행사 인증 완료 후 추가 작업

인증 완료 시 별도 계획서 작성 예정:

1. **결제 시스템 (PG)**
   - 토스페이먼츠 연동
   - 결제 API 구현
   - 웹훅 설정

2. **이메일 서비스**
   - SendGrid 연동
   - 비밀번호 재설정 이메일
   - 구독 알림 이메일
   - 주간 번호 발송 이메일

3. **SMS 서비스**
   - 알림톡/SMS 발송
   - 구독 만료 알림
   - 주간 번호 발송 알림

---

## 우선순위 정리

1. **즉시**: Phase 0.4, 0.5 (모바일 UX 완성)
2. **높음**: Phase 1 (긴급 수정)
3. **중간**: Phase 2, 3, 4 (고급 설정, 패턴 분석, 성능 추적)
4. **낮음**: Phase 5, 6 (ML, 푸시)

---

*이 문서는 개발 진행에 따라 업데이트됩니다.*
*대행사 인증 완료 시 결제/이메일/SMS 관련 Phase 추가 예정.*
