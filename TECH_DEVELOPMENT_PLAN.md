# AI 로또 시스템 기술개발계획서

## 버전: 1.0
## 작성일: 2026-01-14

---

# 1. 심각도 높음 (즉시 수정 필요)

## 1.1 Signup.jsx 환경변수 불일치

**파일**: `react-app/src/pages/Auth/Signup.jsx`
**라인**: 7

**현재 코드**:
```javascript
const API_BASE = import.meta.env.VITE_API_BASE || ''
```

**수정 코드**:
```javascript
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
```

**문제**: OAuth 링크가 `/auth/naver`로 생성되어 프론트엔드 라우터가 처리함
**예상 결과**: OAuth 링크가 `http://localhost:8000/auth/naver`로 정상 작동

---

## 1.2 subscription.py None 인덱싱 에러

**파일**: `backend/app/api/subscription.py`
**라인**: 93-114

**현재 코드**:
```python
latest = db.query(LottoDraw.draw_no).order_by(LottoDraw.draw_no.desc()).first()
# ... 중간 생략 ...
draw_no = latest[0] + 1 if latest else 1
```

**수정 코드**:
```python
latest = db.query(LottoDraw.draw_no).order_by(LottoDraw.draw_no.desc()).first()
# ... 중간 생략 ...
draw_no = (latest[0] + 1) if latest and latest[0] else 1
```

**문제**: latest가 None이 아니어도 latest[0]이 None일 수 있음
**예상 결과**: None 체크 강화로 인덱싱 에러 방지

---

## 1.3 free_trial.py 동일한 None 인덱싱 에러

**파일**: `backend/app/api/free_trial.py`
**라인**: 88-89

**현재 코드**:
```python
def _next_draw_no(db: Session) -> int:
    latest = db.query(LottoDraw.draw_no).order_by(LottoDraw.draw_no.desc()).first()
    return (latest[0] + 1) if latest else 1
```

**수정 코드**:
```python
def _next_draw_no(db: Session) -> int:
    latest = db.query(LottoDraw.draw_no).order_by(LottoDraw.draw_no.desc()).first()
    return (latest[0] + 1) if latest and latest[0] else 1
```

---

## 1.4 ops.py phone 길이 미검증

**파일**: `backend/app/api/ops.py`
**라인**: 77

**현재 코드**:
```python
f"{app.phone[:3]}****{app.phone[-4:]}"
```

**수정 코드**:
```python
f"{app.phone[:3]}****{app.phone[-4:]}" if len(app.phone) >= 7 else "***"
```

**문제**: phone 길이가 7자 미만일 때 인덱스 에러 발생
**예상 결과**: 짧은 전화번호도 안전하게 마스킹 처리

---

# 2. 심각도 중간 (조기 수정 권장)

## 2.1 LuckyBallBanner.jsx 메모리 누수

**파일**: `react-app/src/components/LuckyBallBanner.jsx`
**라인**: 117-152

**현재 코드**:
```javascript
useEffect(() => {
  // ... setTimeout 사용
  setTimeout(() => {
    // ...
  }, 1000)
}, [phase])
```

**수정 코드**:
```javascript
useEffect(() => {
  const timers = []

  const timer1 = setTimeout(() => {
    // ...
  }, 1000)
  timers.push(timer1)

  return () => {
    timers.forEach(t => clearTimeout(t))
  }
}, [phase])
```

**문제**: 컴포넌트 언마운트 시 타이머가 정리되지 않아 메모리 누수
**예상 결과**: cleanup 함수로 타이머 정리

---

## 2.2 MyPage.jsx 타이머 cleanup 누락

**파일**: `react-app/src/pages/Account/MyPage.jsx`
**라인**: 48

**현재 코드**:
```javascript
setTimeout(() => setSaveMessage(''), 3000)
```

**수정 코드**:
```javascript
const timerRef = useRef(null)

// 저장 시
if (timerRef.current) clearTimeout(timerRef.current)
timerRef.current = setTimeout(() => setSaveMessage(''), 3000)

// useEffect cleanup
useEffect(() => {
  return () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }
}, [])
```

---

## 2.3 OAuth 콜백 함수 중복 제거

**파일**: `backend/app/api/oauth.py`
**라인**: 102-170 (naver_callback), 192-258 (kakao_callback)

**수정 방안**: 공통 함수 추출
```python
async def _handle_oauth_callback(
    provider: str,
    code: str,
    state: Optional[str],
    exchange_token_func,
    get_profile_func,
    db: Session,
    response: Response
):
    """OAuth 콜백 공통 처리"""
    # state 검증, 토큰 교환, 프로필 조회, JWT 발급 공통 로직
    pass

@router.get("/naver/callback")
async def naver_callback(code: str, state: str, ...):
    return await _handle_oauth_callback(
        "naver", code, state,
        exchange_naver_token, get_naver_profile, db, response
    )

@router.get("/kakao/callback")
async def kakao_callback(code: str, ...):
    return await _handle_oauth_callback(
        "kakao", code, None,
        exchange_kakao_token, get_kakao_profile, db, response
    )
```

---

## 2.4 JSON 파싱 에러 처리 강화

**파일**: `backend/app/api/lotto.py`
**라인**: 314, 338, 541, 614

**현재 코드**:
```python
try:
    lines = json.loads(latest.lines)
except:
    lines = []
```

**수정 코드**:
```python
try:
    lines = json.loads(latest.lines) if latest.lines else []
except json.JSONDecodeError as e:
    logger.warning(f"JSON 파싱 실패: {e}")
    lines = []
```

**추가 파일**:
- `backend/app/api/subscription.py:287`
- `backend/app/api/lotto.py:666`

---

## 2.5 Recommend.jsx useEffect 의존성 수정

**파일**: `react-app/src/pages/Lotto/Recommend.jsx`
**라인**: 68-76

**현재 코드**:
```javascript
useEffect(() => {
  if (isFree) {
    loadFreeStatus()
  } else {
    loadPaidStatus()
  }
}, [user])
```

**수정 코드**:
```javascript
useEffect(() => {
  if (isFree) {
    loadFreeStatus()
  } else {
    loadPaidStatus()
  }
}, [user, isFree])
```

---

## 2.6 History.jsx useEffect 무한 루프 방지

**파일**: `react-app/src/pages/Lotto/History.jsx`
**라인**: 72

**현재 코드**:
```javascript
useEffect(() => {
  loadData()
}, [page, search, matchFilter, sortBy])
```

**수정 코드**:
```javascript
// 검색어 디바운싱 추가
const debouncedSearch = useMemo(
  () => debounce((value) => setDebouncedSearchTerm(value), 300),
  []
)

useEffect(() => {
  debouncedSearch(search)
  return () => debouncedSearch.cancel()
}, [search, debouncedSearch])

useEffect(() => {
  loadData()
}, [page, debouncedSearchTerm, matchFilter, sortBy])
```

---

## 2.7 Dashboard.jsx 에러 처리 강화

**파일**: `react-app/src/pages/Lotto/Dashboard.jsx`
**라인**: 42

**현재 코드**:
```javascript
Promise.all([...]).catch(() => {})
```

**수정 코드**:
```javascript
Promise.all([...]).catch((err) => {
  console.error('Dashboard 데이터 로드 실패:', err)
  setError('데이터를 불러오는데 실패했습니다.')
})
```

---

# 3. 심각도 낮음 (향후 리팩토링)

## 3.1 auth.py 토큰 생성 코드 중복 제거

**파일**: `backend/app/api/auth.py`
**라인**: 49-61, 133, 212, 219

**수정 방안**: `_create_tokens()` 함수를 모든 토큰 생성 위치에서 사용

---

## 3.2 admin.py 페이지네이션 패턴 공통화

**파일**: `backend/app/api/admin.py`
**라인**: 119-146, 232-259, 306-332, 421-445

**수정 방안**:
```python
def paginate_query(query, page: int, size: int) -> tuple:
    """공통 페이지네이션 처리"""
    total = query.count()
    offset = (page - 1) * size
    items = query.offset(offset).limit(size).all()
    return items, total, (total + size - 1) // size
```

---

## 3.3 History.jsx 공 색상 로직 중복 제거

**파일**: `react-app/src/pages/Lotto/History.jsx`
**라인**: 96-109

**수정 방안**: `LottoBall.jsx` 컴포넌트 재사용
```javascript
// History.jsx에서
import LottoBall from '../../components/LottoBall.jsx'

// renderBall 함수 제거하고 LottoBall 컴포넌트 사용
{numbers.map(n => <LottoBall key={n} number={n} />)}
```

---

## 3.4 PropTypes 추가

**대상 파일**:
- `react-app/src/components/ChartCard.jsx`
- `react-app/src/components/HighlightCard.jsx`
- `react-app/src/components/SummaryCard.jsx`
- `react-app/src/components/StatCard.jsx`
- `react-app/src/components/LinePill.jsx`
- `react-app/src/components/PatternOverviewChart.jsx`
- `react-app/src/components/NumberFrequencyChart.jsx`
- `react-app/src/components/LottoBall.jsx`
- `react-app/src/components/HistoryTable.jsx`

**수정 예시**:
```javascript
import PropTypes from 'prop-types'

LottoBall.propTypes = {
  number: PropTypes.number.isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  isBonus: PropTypes.bool
}

LottoBall.defaultProps = {
  size: 'md',
  isBonus: false
}
```

---

## 3.5 타입 힌트 추가

**대상 파일 및 함수**:
- `backend/app/api/lotto.py:44` - `stats_overview() -> dict`
- `backend/app/api/lotto.py:93` - `stats_highlights() -> dict`
- `backend/app/api/lotto.py:142` - `stats_numbers() -> dict`
- `backend/app/api/lotto.py:201` - `history(user: User) -> dict`
- `backend/app/api/lotto.py:373` - `_generate_free_line() -> List[int]`
- `backend/app/api/oauth.py:86` - `naver_login() -> RedirectResponse`
- `backend/app/api/oauth.py:102` - `naver_callback() -> RedirectResponse`

---

## 3.6 API 응답 모델 통일

**대상 엔드포인트**:
- `backend/app/api/lotto.py:345` - `latest_draw()`
- `backend/app/api/lotto.py:439` - `request_free_recommendation()`
- `backend/app/api/subscription.py:323` - `list_subscriptions()`
- `backend/app/api/admin.py:892-977` - 성능 관련 엔드포인트

**수정 방안**: Pydantic 응답 모델 정의 및 적용

---

# 4. 작업 우선순위

| 순서 | 항목 | 파일 | 예상 작업량 |
|-----|------|------|-----------|
| 1 | Signup.jsx 환경변수 | react-app/src/pages/Auth/Signup.jsx:7 | 1줄 |
| 2 | subscription.py None 체크 | backend/app/api/subscription.py:93-114 | 1줄 |
| 3 | free_trial.py None 체크 | backend/app/api/free_trial.py:88-89 | 1줄 |
| 4 | ops.py phone 길이 검증 | backend/app/api/ops.py:77 | 1줄 |
| 5 | LuckyBallBanner 타이머 cleanup | react-app/src/components/LuckyBallBanner.jsx:117-152 | 15줄 |
| 6 | MyPage 타이머 cleanup | react-app/src/pages/Account/MyPage.jsx:48 | 10줄 |
| 7 | JSON 파싱 에러 처리 | backend/app/api/lotto.py (4곳) | 8줄 |
| 8 | useEffect 의존성 수정 | react-app/src/pages/Lotto/Recommend.jsx:68-76 | 1줄 |
| 9 | OAuth 콜백 중복 제거 | backend/app/api/oauth.py | 50줄 |
| 10 | Dashboard 에러 처리 | react-app/src/pages/Lotto/Dashboard.jsx:42 | 5줄 |

---

# 5. 테스트 계획

## 5.1 심각도 높음 수정 후 테스트

1. **OAuth 로그인 테스트**
   - 회원가입 페이지에서 네이버/카카오 로그인 버튼 클릭
   - 정상적으로 백엔드 `/auth/naver`, `/auth/kakao`로 리다이렉트 확인

2. **구독 생성 테스트**
   - 빈 DB에서 구독 생성 API 호출
   - draw_no가 1로 정상 설정되는지 확인

3. **운영 대시보드 테스트**
   - 짧은 전화번호(7자 미만)가 있는 데이터로 ops/summary API 호출
   - 에러 없이 마스킹 처리되는지 확인

## 5.2 심각도 중간 수정 후 테스트

1. **메모리 누수 테스트**
   - LuckyBallBanner 컴포넌트 반복 마운트/언마운트
   - 개발자 도구에서 메모리 사용량 확인

2. **무한 루프 테스트**
   - History 페이지에서 빠르게 검색어 입력
   - 네트워크 요청이 디바운싱되는지 확인

---

# 6. 롤백 계획

각 수정 사항은 개별 커밋으로 관리하여 문제 발생 시 해당 커밋만 롤백

```bash
# 커밋 구조 예시
git commit -m "fix: Signup.jsx 환경변수 불일치 수정"
git commit -m "fix: subscription.py None 인덱싱 방지"
git commit -m "fix: LuckyBallBanner 타이머 cleanup 추가"
```

---

## 문서 종료
