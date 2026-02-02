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
export function requestOneLineAdvanced({
  exclude = [],
  fixed = [],
  range_filter = null,
  odd_even_ratio = null,
  consecutive_limit = null,
  sum_range = null,
}) {
  return request('/api/lotto/recommend/advanced/one', {
    method: 'POST',
    body: JSON.stringify({
      exclude,
      fixed,
      range_filter,
      odd_even_ratio,
      consecutive_limit,
      sum_range,
    }),
  })
}

// 고급 설정 적용하여 전체 받기
export function requestAllLinesAdvanced({
  exclude = [],
  fixed = [],
  range_filter = null,
  odd_even_ratio = null,
  consecutive_limit = null,
  sum_range = null,
}) {
  return request('/api/lotto/recommend/advanced/all', {
    method: 'POST',
    body: JSON.stringify({
      exclude,
      fixed,
      range_filter,
      odd_even_ratio,
      consecutive_limit,
      sum_range,
    }),
  })
}

// 고급 옵션으로 번호 생성 (PREMIUM/VIP 전용)
export function generateAdvancedNumbers({
  exclude = [],
  fixed = [],
  range_filter = null,
  odd_even_ratio = null,
  consecutive_limit = null,
  sum_range = null,
}) {
  return request('/api/lotto/recommend/generate-advanced', {
    method: 'POST',
    body: JSON.stringify({
      exclude,
      fixed,
      range_filter,
      odd_even_ratio,
      consecutive_limit,
      sum_range,
    }),
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

// =========================================
// 패턴 분석 심화 API (Phase 3)
// =========================================

// 동반 출현 분석 (BASIC 이상)
export function fetchPairFrequency(topN = 20) {
  return request(`/api/lotto/stats/pair-frequency?top_n=${topN}`)
}

// 특정 번호 상세 분석 (BASIC 이상)
export function fetchNumberDetail(number) {
  return request(`/api/lotto/stats/number/${number}`)
}

// 출현 주기 분석 (PREMIUM 이상)
export function fetchCyclePattern() {
  return request('/api/lotto/stats/cycle-pattern')
}

// 위치별 패턴 분석 (PREMIUM 이상)
export function fetchPositionPattern() {
  return request('/api/lotto/stats/position-pattern')
}

// =========================================
// 성능 추적 API (Phase 4)
// =========================================

// 내 성능 통계 조회
export function fetchMyPerformance() {
  return request('/api/lotto/stats/my-performance')
}

// 전체 시스템 성능 요약 (공개)
export function fetchGlobalPerformance() {
  return request('/api/lotto/stats/global-performance')
}

// 특정 회차 성능 상세 (BASIC 이상)
export function fetchDrawPerformance(drawNo) {
  return request(`/api/lotto/stats/draw-performance/${drawNo}`)
}

// 플랜별 성과 비교 (공개)
export function fetchPlanComparison(recentDraws = 10) {
  return request(`/api/lotto/stats/plan-comparison?recent_draws=${recentDraws}`)
}

// =========================================
// ML 모델 API (Phase 5)
// =========================================

// ML 모델 상태 조회 (공개)
export function fetchMLStatus() {
  return request('/api/lotto/ml/status')
}

// ML 모델 학습 (관리자 전용)
export function trainMLModel() {
  return request('/api/lotto/ml/train', { method: 'POST' })
}

// ML 백테스트 (PREMIUM 이상)
export function fetchMLBacktest(testDraws = 20) {
  return request(`/api/lotto/ml/backtest?test_draws=${testDraws}`)
}

// ML 예측 리포트 (PREMIUM 이상)
export function fetchMLPrediction() {
  return request('/api/lotto/ml/prediction')
}

// =========================================
// 푸시 알림 API (Phase 6)
// =========================================

// VAPID 공개키 조회
export function fetchVapidPublicKey() {
  return request('/api/notification/vapid-public-key')
}

// 푸시 알림 구독
export function subscribePush(subscription) {
  return request('/api/notification/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    }),
  })
}

// 푸시 알림 구독 해제
export function unsubscribePush(endpoint) {
  return request('/api/notification/unsubscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint }),
  })
}

// 알림 설정 조회
export function fetchNotificationSettings() {
  return request('/api/notification/settings')
}

// 알림 설정 업데이트
export function updateNotificationSettings(settings) {
  return request('/api/notification/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

// 알림 히스토리 조회
export function fetchNotificationHistory(limit = 20) {
  return request(`/api/notification/history?limit=${limit}`)
}
