/**
 * 관리자 페이지 공용 유틸리티 함수
 */

export function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

export function formatMoney(value) {
  if (!value) return '0'
  return value.toLocaleString('ko-KR')
}

export const TABS = [
  { id: 'dashboard', label: '대시보드' },
  { id: 'users', label: '회원 관리' },
  { id: 'subscriptions', label: '구독 관리' },
  { id: 'trials', label: '무료체험' },
  { id: 'payments', label: '결제 관리' },
  { id: 'lotto', label: '로또 데이터' },
  { id: 'ml', label: 'ML 분석' },
  { id: 'performance', label: '플랜 성과' },
  { id: 'matching', label: '매칭 관리' },
  { id: 'backtest', label: '백테스팅' },
]
