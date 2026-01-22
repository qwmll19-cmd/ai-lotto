const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const DEBUG_API = import.meta.env.DEV // 개발 환경에서만 로깅

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 토큰 관리 (Token 기반 인증)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

// API 로그 저장 (최근 50개)
function logApiCall(type, data) {
  if (!DEBUG_API) return

  const log = {
    timestamp: new Date().toISOString(),
    type,
    ...data,
  }

  console.log(`[API ${type}]`, log)

  try {
    const stored = JSON.parse(localStorage.getItem('ai_lotto_api_logs') || '[]')
    stored.unshift(log)
    localStorage.setItem('ai_lotto_api_logs', JSON.stringify(stored.slice(0, 50)))
  } catch {
    // 로깅 실패 무시
  }
}

async function refreshSession() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    logApiCall('REFRESH_SKIP', { reason: 'no_refresh_token' })
    return false
  }

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
      logApiCall('REFRESH_SUCCESS', { status: response.status })
      return true
    }

    // 401/403: refresh_token도 만료됨 - 재로그인 필요
    logApiCall('REFRESH_FAILED', { status: response.status })
  } catch (err) {
    // 네트워크 에러 - 토큰은 유지 (오프라인 상황 대비)
    logApiCall('REFRESH_NETWORK_ERROR', { error: err.message })
    // 네트워크 에러는 토큰 삭제하지 않음
    return false
  }

  // 갱신 실패 시 토큰 삭제 (401/403 등 인증 에러)
  saveTokens(null)
  return false
}

async function request(path, options = {}) {
  const startTime = performance.now()
  const method = options.method || 'GET'

  logApiCall('REQUEST', { method, path, body: options.body })

  // Authorization 헤더 구성 (Token 기반 인증)
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
      ...options,
    })
  } catch (networkError) {
    const duration = Math.round(performance.now() - startTime)
    logApiCall('NETWORK_ERROR', {
      method,
      path,
      error: networkError.message,
      duration,
    })
    throw networkError
  }

  const duration = Math.round(performance.now() - startTime)

  if (!response.ok) {
    // 401 시 토큰 갱신 시도
    if (response.status === 401 && !options._retry) {
      const refreshed = await refreshSession()
      if (refreshed) {
        return request(path, { ...options, _retry: true })
      }
    }
    let message = '요청에 실패했습니다.'
    try {
      const data = await response.json()
      message = data.detail || data.message || message
    } catch {
      const text = await response.text()
      if (text) message = text
    }

    logApiCall('ERROR', {
      method,
      path,
      status: response.status,
      message,
      duration,
    })

    const error = new Error(message)
    error.status = response.status
    throw error
  }

  const data = await response.json()

  logApiCall('SUCCESS', {
    method,
    path,
    status: response.status,
    duration,
  })

  return data
}

export { API_BASE_URL, request, getTokens, saveTokens, getAccessToken, getRefreshToken }
