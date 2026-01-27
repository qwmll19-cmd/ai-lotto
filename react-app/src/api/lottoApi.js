import { request } from './client.js'
import { buildQuery } from '../utils/apiUtils.js'

export function fetchDashboardSummary() {
  return request('/api/lotto/stats/overview')
}

export function fetchDashboardHighlights() {
  return request('/api/lotto/stats/highlights')
}

export function fetchStatsTopNumbers() {
  return request('/api/lotto/stats/number')
}

export function fetchStatsPatterns() {
  return request('/api/lotto/stats/patterns')
}

export function fetchHistory(params) {
  return request(`/api/lotto/history${buildQuery(params)}`)
}

export function fetchPublicHistory(params) {
  return request(`/api/lotto/history/public${buildQuery(params)}`)
}

export function fetchMyPageSummary() {
  return request('/api/lotto/mypage/summary')
}

export function fetchMyPageLines() {
  return request('/api/lotto/mypage/lines')
}

export function fetchLatestDraw() {
  return request('/api/lotto/latest')
}

export function getAiRecommendation(count = 5, checkOnly = false) {
  const params = new URLSearchParams({ count: String(count) })
  if (checkOnly) params.set('check_only', 'true')
  return request(`/api/lotto/recommend?${params.toString()}`)
}

// 비회원 공 뽑기
export function guestDraw(sessionId) {
  return request('/api/guest/draw', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  })
}

// 무료 추천 요청 (로그인 상태)
export function requestFreeRecommendation() {
  return request('/api/lotto/recommend/free', {
    method: 'POST',
  })
}

// 무료 추천 상태 조회
export function getFreeRecommendStatus() {
  return request('/api/lotto/recommend/free/status')
}

// =========================================
// 번호 풀 시스템 (BASIC/PREMIUM/VIP용)
// =========================================

// 1줄씩 받기 (풀에서 랜덤 1줄 뽑기)
export function requestOneLine() {
  return request('/api/lotto/recommend/one', {
    method: 'POST',
  })
}

// 한번에 받기 (풀 전체 받기)
export function requestAllLines() {
  return request('/api/lotto/recommend/all', {
    method: 'POST',
  })
}

// 풀 상태 조회
export function getPoolStatus() {
  return request('/api/lotto/recommend/pool-status')
}

// =========================================
// 고급 설정 (번호 제외/고정)
// =========================================

// AI 고정 후보 번호 조회 (PREMIUM: 2개, VIP: 3개)
// refresh=true면 새로 뽑기, false면 저장된 번호 반환
// checkOnly=true면 저장된 번호만 조회 (없으면 빈 배열, 새로 뽑지 않음)
export function getFixedCandidates(refresh = false, checkOnly = false) {
  const params = new URLSearchParams()
  if (refresh) params.set('refresh', 'true')
  if (checkOnly) params.set('check_only', 'true')
  const query = params.toString()
  return request(`/api/lotto/recommend/fixed-candidates${query ? '?' + query : ''}`)
}

// 고급 설정 적용하여 1줄씩 받기
export function requestOneLineAdvanced({ exclude = [], fixed = [] }) {
  return request('/api/lotto/recommend/advanced/one', {
    method: 'POST',
    body: JSON.stringify({ exclude, fixed }),
  })
}

// 고급 설정 적용하여 전체 받기
export function requestAllLinesAdvanced({ exclude = [], fixed = [] }) {
  return request('/api/lotto/recommend/advanced/all', {
    method: 'POST',
    body: JSON.stringify({ exclude, fixed }),
  })
}

// =========================================
// 프리미엄 통계 (BASIC/PREMIUM/VIP용)
// =========================================

// 프리미엄 통계 조회
export function fetchPremiumStats() {
  return request('/api/lotto/stats/premium')
}

// =========================================
// 결과 확인 완료 처리
// =========================================

// 특정 회차 결과 확인 완료 처리 (MyPage에서 호출)
export function markResultChecked(drawNo) {
  return request('/api/lotto/mark-checked', {
    method: 'POST',
    body: JSON.stringify({ draw_no: drawNo }),
  })
}
