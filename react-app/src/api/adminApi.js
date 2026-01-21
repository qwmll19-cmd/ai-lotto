import { request } from './client.js'
import { buildQuery } from '../utils/apiUtils.js'

// 대시보드
export function fetchAdminDashboard() {
  return request('/api/admin/dashboard')
}

// 회원 관리
export function fetchUsers(params) {
  return request(`/api/admin/users${buildQuery(params)}`)
}

export function updateUser(userId, data) {
  return request(`/api/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteUser(userId) {
  return request(`/api/admin/users/${userId}`, {
    method: 'DELETE',
  })
}

// 무료체험 관리
export function fetchFreeTrials(params) {
  return request(`/api/admin/free-trials${buildQuery(params)}`)
}

export function updateFreeTrialStatus(trialId, status) {
  return request(`/api/admin/free-trials/${trialId}/status?status=${status}`, {
    method: 'PUT',
  })
}

// 결제 관리
export function fetchPayments(params) {
  return request(`/api/admin/payments${buildQuery(params)}`)
}

export function refundPayment(paymentId, reason) {
  return request(`/api/admin/payments/${paymentId}/refund`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

// 구독 관리
export function fetchSubscriptions(params) {
  return request(`/api/admin/subscriptions${buildQuery(params)}`)
}

export function fetchSubscriptionDetail(id) {
  return request(`/api/admin/subscriptions/${id}`)
}

export function approveSubscription(id, durationDays = 30, userId = null) {
  const payload = { duration_days: durationDays }
  if (userId) payload.user_id = userId
  return request(`/api/admin/subscriptions/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function rejectSubscription(id, reason = '') {
  return request(`/api/admin/subscriptions/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export function extendSubscription(id, days) {
  return request(`/api/admin/subscriptions/${id}/extend`, {
    method: 'PUT',
    body: JSON.stringify({ days }),
  })
}

export function cancelSubscription(id) {
  return request(`/api/admin/subscriptions/${id}/cancel`, {
    method: 'POST',
  })
}

export function sendSubscriptionNumbers(id) {
  return request(`/api/admin/subscriptions/${id}/send-numbers`, {
    method: 'POST',
  })
}

// 로또 데이터 관리
export function fetchLottoDraws(params) {
  return request(`/api/admin/lotto/draws${buildQuery(params)}`)
}

export function createLottoDraw(data) {
  return request('/api/admin/lotto/draws', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateLottoDraw(drawNo, data) {
  return request(`/api/admin/lotto/draws/${drawNo}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteLottoDraw(drawNo) {
  return request(`/api/admin/lotto/draws/${drawNo}`, {
    method: 'DELETE',
  })
}

export function rebuildLottoCache() {
  return request('/api/admin/lotto/rebuild-cache', {
    method: 'POST',
  })
}

// 추천 로그
export function fetchRecommendLogs(params) {
  return request(`/api/admin/recommend-logs${buildQuery(params)}`)
}

export function updateRecommendLog(logId, data) {
  return request(`/api/admin/recommend-logs/${logId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteRecommendLog(logId) {
  return request(`/api/admin/recommend-logs/${logId}`, {
    method: 'DELETE',
  })
}

// 플랜별 성과
export function fetchPerformanceSummary(recentDraws = 10) {
  return request(`/api/admin/performance/summary?recent_draws=${recentDraws}`)
}

export function fetchPerformanceByDraw(drawNo) {
  return request(`/api/admin/performance/by-draw?draw_no=${drawNo}`)
}

export function fetchPerformanceHistory(params) {
  return request(`/api/admin/performance/history${buildQuery(params)}`)
}

// ML 학습 관리
export function fetchMLTrainingLogs(params) {
  return request(`/api/admin/ml/training-logs${buildQuery(params)}`)
}

export function fetchMLLatest() {
  return request('/api/admin/ml/latest')
}

export function fetchMLLogicAnalysis(recentDraws = 10) {
  return request(`/api/admin/ml/logic-analysis?recent_draws=${recentDraws}`)
}

export function triggerMLRetrain() {
  return request('/api/admin/ml/retrain', {
    method: 'POST',
  })
}

// 매칭 관리
export function fetchMatchStatus() {
  return request('/api/admin/match/status')
}

export function triggerMatch(drawNo) {
  return request(`/api/admin/match/trigger/${drawNo}`, {
    method: 'POST',
  })
}

// 백테스팅
export function fetchBacktestRange() {
  return request('/api/admin/backtest/available-range')
}

export function runBacktest(startDraw, endDraw) {
  return request('/api/admin/backtest/run', {
    method: 'POST',
    body: JSON.stringify({ start_draw: startDraw, end_draw: endDraw }),
  })
}

export function runSingleBacktest(drawNo) {
  return request(`/api/admin/backtest/single/${drawNo}`)
}

// 소셜 계정 관리
export function fetchSocialAccounts(params) {
  return request(`/api/admin/social-accounts${buildQuery(params)}`)
}

export function deleteSocialAccount(accountId) {
  return request(`/api/admin/social-accounts/${accountId}`, {
    method: 'DELETE',
  })
}
