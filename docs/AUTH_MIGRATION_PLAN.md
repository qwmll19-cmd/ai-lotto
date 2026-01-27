# 인증 시스템 재설계 개발 계획서

## 1. 현재 시스템 분석 요약

### 1.1 현재 구조 (쿠키 기반)
```
[로그인] → Backend가 쿠키에 JWT 저장 → 브라우저가 자동으로 쿠키 전송
```

### 1.2 문제점
| 환경 | 쿠키 동작 | 결과 |
|------|---------|------|
| PC Chrome/Firefox | 정상 | ✅ 동작 |
| 모바일 Safari | ITP 차단 | ❌ 로그인 실패 |
| 모바일 Chrome | 3rd party 제한 | ❌ 불안정 |
| 카카오/네이버 인앱 | 완전 차단 | ❌ 로그인 실패 |

### 1.3 영향받는 파일 목록

**Backend (수정 필요):**
| 파일 | 수정 내용 |
|------|---------|
| `backend/app/api/auth.py` | 쿠키 → JSON 응답, Authorization 헤더 읽기 |
| `backend/app/api/oauth.py` | 쿠키 → JSON 응답 (리다이렉트 방식 변경) |
| `backend/app/config/settings.py` | 쿠키 설정 제거 |

**Frontend (수정 필요):**
| 파일 | 수정 내용 |
|------|---------|
| `react-app/src/api/client.js` | Authorization 헤더 추가, credentials 제거 |
| `react-app/src/context/AuthContext.jsx` | 토큰 저장/관리 로직 추가 |
| `react-app/src/pages/Auth/OAuthCallback.jsx` | 토큰 저장 로직 수정 |
| `react-app/src/pages/Auth/Login.jsx` | 토큰 저장 로직 수정 |
| `react-app/src/pages/Auth/Signup.jsx` | 토큰 저장 로직 수정 |

---

## 2. 목표 구조 (Token 기반)

```
[로그인 성공]
     ↓
Backend → JSON { access_token, refresh_token, user } 응답
     ↓
Frontend → localStorage에 토큰 저장
     ↓
[모든 API 요청]
     ↓
Authorization: Bearer {access_token} 헤더로 전송
     ↓
[토큰 만료 시 (401)]
     ↓
refresh_token으로 자동 갱신 → 새 토큰 저장 → 원래 요청 재시도
```

---

## 3. 상세 개발 계획

### Phase 1: Backend 수정 (인증 응답 방식 변경)

#### 3.1.1 auth.py - 쿠키 설정 제거 및 JSON 응답
**파일**: `backend/app/api/auth.py`

**수정 1: _set_auth_cookies() 제거 또는 비활성화**
- 라인 89-109의 `_set_auth_cookies()` 함수 제거
- 대신 토큰을 JSON으로 반환

**수정 2: signup() 엔드포인트 (라인 112-193)**
```python
# Before (라인 184-186)
_set_auth_cookies(response, access_token, refresh_token)
return AuthResponse(user_id=user.id, identifier=user.identifier, token=access_token, is_admin=user.is_admin)

# After
return {
    "access_token": access_token,
    "refresh_token": refresh_token,
    "token_type": "Bearer",
    "expires_in": settings.JWT_TTL_SECONDS,
    "user": {
        "user_id": user.id,
        "identifier": user.identifier,
        "name": user.name,
        "phone_number": user.phone_number,
        "is_admin": user.is_admin,
        "tier": user.subscription_type or "free",
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }
}
```

**수정 3: login() 엔드포인트 (라인 196-215)**
- 동일하게 JSON 응답으로 변경

**수정 4: refresh() 엔드포인트 (라인 268-294)**
```python
# Before (라인 270)
token = request.cookies.get(REFRESH_COOKIE)

# After
auth_header = request.headers.get("Authorization")
if not auth_header or not auth_header.startswith("Bearer "):
    raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
token = auth_header.split(" ")[1]
```

**수정 5: get_current_user() 의존성 (라인 297-312)**
```python
# Before (라인 298)
token = request.cookies.get(ACCESS_COOKIE)

# After
auth_header = request.headers.get("Authorization")
if not auth_header or not auth_header.startswith("Bearer "):
    raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
token = auth_header.split(" ")[1]
```

**수정 6: me() 엔드포인트 (라인 218-247)**
- 쿠키 대신 Authorization 헤더에서 토큰 읽기

**수정 7: logout() 엔드포인트 (라인 250-265)**
- 쿠키 삭제 로직 제거
- DB의 refresh_token_hash만 무효화

**수정 8: exchange_oauth_token() 엔드포인트 (라인 971-1029)**
```python
# Before (라인 1010)
_set_auth_cookies(response, access_token, refresh_token)

# After - JSON 응답에 토큰 포함
return ExchangeTokenResponse(
    success=True,
    message="로그인 성공",
    access_token=access_token,  # 추가
    refresh_token=refresh_token,  # 추가
    user_id=user.id,
    # ... 나머지 필드
)
```

#### 3.1.2 oauth.py - OAuth 콜백 수정
**파일**: `backend/app/api/oauth.py`

**수정 1: _set_auth_cookies() 제거 (라인 57-90)**

**수정 2: naver_callback() (라인 121-200)**
```python
# Before (라인 176-185) - 일반 브라우저
redirect_url = f"{settings.FRONTEND_URL}/mypage?login=success"
refresh_token = _set_auth_cookies(response, user.id, identifier)

# After - 모든 브라우저에서 동일하게 처리
one_time_token = create_oauth_one_time_token(user.id)
redirect_url = f"{settings.FRONTEND_URL}/oauth/callback?token={one_time_token}"
```

**수정 3: kakao_callback() (라인 222-300)**
- 동일하게 수정

**핵심 변경**: 인앱 브라우저 감지 로직 제거, 모든 OAuth 콜백을 one-time token 방식으로 통일

#### 3.1.3 settings.py - 쿠키 설정 정리
**파일**: `backend/app/config/settings.py`

**수정**: 쿠키 관련 설정 제거 또는 deprecated 표시 (라인 96-97, 143-152)
```python
# 제거 대상
COOKIE_SECURE: str = os.getenv("AI_LOTTO_COOKIE_SECURE", "")
COOKIE_SAMESITE: str = os.getenv("AI_LOTTO_COOKIE_SAMESITE", "")

def get_cookie_settings() -> tuple[bool, str]:
    # deprecated - 향후 제거
    pass
```

---

### Phase 2: Frontend 수정 (토큰 관리)

#### 3.2.1 client.js - Authorization 헤더 추가
**파일**: `react-app/src/api/client.js`

**수정 1: 토큰 관리 함수 추가**
```javascript
// 새로 추가
const TOKEN_KEY = 'ai_lotto_tokens'

function getTokens() {
  try {
    const stored = localStorage.getItem(TOKEN_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function saveTokens(tokens) {
  if (tokens) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

function getAccessToken() {
  const tokens = getTokens()
  return tokens?.access_token || null
}

function getRefreshToken() {
  const tokens = getTokens()
  return tokens?.refresh_token || null
}

export { getTokens, saveTokens, getAccessToken, getRefreshToken }
```

**수정 2: request() 함수 수정 (라인 33-101)**
```javascript
async function request(path, options = {}) {
  const startTime = performance.now()
  const method = options.method || 'GET'

  // Authorization 헤더 추가
  const accessToken = getAccessToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers,
      // credentials: 'include' 제거
      ...options,
    })
  } catch (networkError) {
    // ... 에러 처리
  }

  // 401 시 토큰 갱신
  if (response.status === 401 && !options._retry) {
    const refreshed = await refreshSession()
    if (refreshed) {
      return request(path, { ...options, _retry: true })
    }
  }

  // ... 나머지 로직
}
```

**수정 3: refreshSession() 함수 수정 (라인 25-31)**
```javascript
async function refreshSession() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshToken}`,
      },
    })

    if (response.ok) {
      const data = await response.json()
      saveTokens({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })
      return true
    }
  } catch {
    // 갱신 실패
  }

  // 갱신 실패 시 토큰 삭제
  saveTokens(null)
  return false
}
```

#### 3.2.2 AuthContext.jsx - 토큰 저장 로직 수정
**파일**: `react-app/src/context/AuthContext.jsx`

**수정 1: import 추가**
```javascript
import { saveTokens, getAccessToken } from '../api/client.js'
```

**수정 2: signup() 수정 (라인 34-53)**
```javascript
const signup = async ({ name, identifier, password, phone, sms_verified_token }) => {
  try {
    const response = await apiSignup({ name, identifier, password, phone, sms_verified_token })

    // 토큰 저장 추가
    saveTokens({
      access_token: response.access_token,
      refresh_token: response.refresh_token,
    })

    const nextUser = {
      id: response.user.user_id,
      name: response.user.name || name,
      identifier: response.user.identifier || identifier,
      isAdmin: response.user.is_admin || false,
      tier: response.user.tier || 'FREE',
      created_at: response.user.created_at || null,
    }
    setUser(nextUser)
    saveUserToStorage(nextUser)
    return { ok: true }
  } catch (err) {
    return { ok: false, message: err?.message || '회원가입에 실패했습니다.' }
  }
}
```

**수정 3: login() 수정 (라인 76-94)**
```javascript
const login = async ({ identifier, password }) => {
  try {
    const response = await apiLogin({ identifier, password })

    // 토큰 저장 추가
    saveTokens({
      access_token: response.access_token,
      refresh_token: response.refresh_token,
    })

    const nextUser = {
      id: response.user.user_id,
      identifier: response.user.identifier || identifier,
      isAdmin: response.user.is_admin || false,
      tier: response.user.tier || 'FREE',
      // ...
    }
    setUser(nextUser)
    saveUserToStorage(nextUser)
    return { ok: true }
  } catch {
    return { ok: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' }
  }
}
```

**수정 4: logout() 수정 (라인 96-104)**
```javascript
const logout = async () => {
  try {
    await apiLogout()
  } catch {
    // ignore
  }
  saveTokens(null)  // 토큰 삭제 추가
  setUser(null)
  saveUserToStorage(null)
}
```

**수정 5: useEffect 초기화 수정 (라인 106-164)**
```javascript
useEffect(() => {
  let active = true

  const load = async () => {
    // 토큰이 있는지 먼저 확인
    const accessToken = getAccessToken()

    if (accessToken) {
      try {
        const data = await request('/api/auth/me')
        if (!active) return
        const verifiedUser = {
          id: data.user_id,
          identifier: data.identifier,
          // ...
        }
        setUser(verifiedUser)
        saveUserToStorage(verifiedUser)
      } catch {
        if (!active) return
        // 토큰 무효 - 삭제
        saveTokens(null)
        setUser(null)
        saveUserToStorage(null)
      }
    } else {
      // 토큰 없음 - 비로그인 상태
      setUser(null)
    }

    if (active) setAuthLoading(false)
  }

  load()
  return () => { active = false }
}, [])
```

#### 3.2.3 OAuthCallback.jsx - 토큰 저장 추가
**파일**: `react-app/src/pages/Auth/OAuthCallback.jsx`

**수정: processCallback() (라인 42-81)**
```javascript
try {
  const data = await request('/api/auth/exchange-token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })

  if (data.success) {
    // 토큰 저장 추가
    saveTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    })

    const userData = {
      id: data.user_id,
      identifier: data.identifier,
      name: data.name || null,
      // ...
    }

    setUser(userData)
    // ...
  }
} catch (err) {
  // ...
}
```

---

### Phase 3: API 응답 스키마 변경

#### 3.3.1 새로운 응답 스키마

**로그인/회원가입 응답:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 21600,
  "user": {
    "user_id": 1,
    "identifier": "testuser",
    "name": "홍길동",
    "phone_number": "01012345678",
    "is_admin": false,
    "tier": "FREE",
    "created_at": "2025-01-22T10:00:00"
  }
}
```

**토큰 갱신 응답:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 21600
}
```

**OAuth 토큰 교환 응답:**
```json
{
  "success": true,
  "message": "로그인 성공",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": 1,
  "identifier": "testuser",
  "name": "홍길동",
  "phone_number": "01012345678",
  "is_admin": false,
  "tier": "FREE",
  "created_at": "2025-01-22T10:00:00"
}
```

---

## 4. 마이그레이션 전략

### 4.1 점진적 마이그레이션 (권장)

**단계 1: 백엔드에서 두 방식 모두 지원**
```python
def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    # 1. Authorization 헤더 우선 확인
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    else:
        # 2. 쿠키에서 확인 (기존 호환)
        token = request.cookies.get(ACCESS_COOKIE)

    if not token:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

    # ... 토큰 검증
```

**단계 2: 프론트엔드 점진적 전환**
- 새로운 client.js 배포
- 기존 사용자는 쿠키로 계속 동작
- 새 로그인/회원가입은 토큰 방식

**단계 3: 완전 전환 후 쿠키 지원 제거**
- 2주 후 쿠키 지원 코드 제거

### 4.2 배포 순서

```
1. Backend 배포 (두 방식 지원)
   ↓
2. Frontend 배포
   ↓
3. 모니터링 (1-2주)
   ↓
4. Backend 쿠키 지원 제거
```

---

## 5. 테스트 체크리스트

### 5.1 Backend 테스트
- [ ] POST /api/auth/signup - 토큰 JSON 응답 확인
- [ ] POST /api/auth/login - 토큰 JSON 응답 확인
- [ ] POST /api/auth/refresh - Authorization 헤더로 갱신 확인
- [ ] GET /api/auth/me - Authorization 헤더 인증 확인
- [ ] POST /api/auth/logout - refresh_token 무효화 확인
- [ ] GET /auth/naver/callback - one-time token 리다이렉트 확인
- [ ] GET /auth/kakao/callback - one-time token 리다이렉트 확인
- [ ] POST /api/auth/exchange-token - 토큰 교환 및 JSON 응답 확인

### 5.2 Frontend 테스트
- [ ] 회원가입 후 localStorage에 토큰 저장 확인
- [ ] 로그인 후 localStorage에 토큰 저장 확인
- [ ] API 요청 시 Authorization 헤더 포함 확인
- [ ] 토큰 만료 시 자동 갱신 확인
- [ ] 로그아웃 시 토큰 삭제 확인
- [ ] 페이지 새로고침 시 로그인 유지 확인
- [ ] 네이버 OAuth 로그인 확인
- [ ] 카카오 OAuth 로그인 확인

### 5.3 환경별 테스트
- [ ] PC Chrome
- [ ] PC Safari
- [ ] PC Firefox
- [ ] 모바일 Safari (iOS)
- [ ] 모바일 Chrome (Android)
- [ ] 카카오톡 인앱 브라우저
- [ ] 네이버 앱 인앱 브라우저

---

## 6. 수정 대상 파일 요약

| 파일 | 수정 유형 | 우선순위 |
|------|---------|---------|
| `backend/app/api/auth.py` | 대폭 수정 | 1 |
| `backend/app/api/oauth.py` | 대폭 수정 | 1 |
| `react-app/src/api/client.js` | 대폭 수정 | 2 |
| `react-app/src/context/AuthContext.jsx` | 중간 수정 | 2 |
| `react-app/src/pages/Auth/OAuthCallback.jsx` | 소폭 수정 | 3 |
| `react-app/src/pages/Auth/Login.jsx` | 소폭 수정 | 3 |
| `react-app/src/pages/Auth/Signup.jsx` | 소폭 수정 | 3 |
| `backend/app/config/settings.py` | 정리 | 4 |

---

## 7. 예상 작업 시간

| Phase | 작업 내용 | 예상 코드 변경량 |
|-------|---------|----------------|
| Phase 1 | Backend 수정 | ~200줄 |
| Phase 2 | Frontend 수정 | ~150줄 |
| Phase 3 | 스키마 변경 | ~50줄 |
| 테스트 | 전체 테스트 | - |

---

## 8. 롤백 계획

문제 발생 시:
1. Backend에서 쿠키 지원 유지하고 있으므로 즉시 롤백 가능
2. Frontend만 이전 버전으로 롤백
3. 기존 사용자는 쿠키로 계속 로그인 가능
