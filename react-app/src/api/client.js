const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const DEBUG_API = import.meta.env.DEV // 개발 환경에서만 로깅

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
  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  return response.ok
}

async function request(path, options = {}) {
  const startTime = performance.now()
  const method = options.method || 'GET'

  logApiCall('REQUEST', { method, path, body: options.body })

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
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

export { API_BASE_URL, request }
