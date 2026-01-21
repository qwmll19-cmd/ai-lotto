export const dashboardSummary = [
  { id: 'draws', title: '누적 회차 수', value: '1,149회', hint: '최신 회차 기준' },
  { id: 'top', title: '최다 출현 번호', value: '7 · 27 · 33', hint: '최근 200회' },
  { id: 'pattern', title: '최근 패턴 요약', value: '홀짝 3:3', hint: '평균 합계 147' },
]

export const dashboardHighlights = [
  { id: 'streak', title: '최근 10회 연속번호 등장', value: '6회', trend: '상승' },
  { id: 'range', title: '고빈도 구간(1~20)', value: '52%', trend: '보통' },
  { id: 'bonus', title: '보너스 상위 번호', value: '12 · 17 · 34', trend: '강세' },
]

export const statsTopNumbers = [
  { number: 7, count: 168 },
  { number: 27, count: 165 },
  { number: 33, count: 162 },
  { number: 12, count: 160 },
  { number: 19, count: 158 },
  { number: 41, count: 156 },
]

export const statsPatterns = [
  { title: '홀짝 비율', value: '3:3', numeric_value: 3, detail: '최근 100회 평균' },
  { title: '합계 평균', value: '147', numeric_value: 147, detail: '주요 구간 130~160' },
  { title: '연속 번호', value: '63%', numeric_value: 63, detail: '연속 1쌍 이상' },
]

export const historyRows = [
  {
    round: 1206,
    numbers: '1, 3, 17, 26, 27, 42',
    bonus: 23,
    ai: '추천 있음',
    date: '2026-01-10',
  },
  {
    round: 1205,
    numbers: '1, 4, 16, 23, 31, 41',
    bonus: 7,
    ai: '추천 없음',
    date: '2026-01-03',
  },
  {
    round: 1204,
    numbers: '7, 12, 20, 28, 37, 44',
    bonus: 9,
    ai: '추천 있음',
    date: '2025-12-27',
  },
]

export const latestDrawMock = {
  draw_no: 1206,
  numbers: [1, 3, 17, 26, 27, 42],
  bonus: 23,
  draw_date: '2026-01-10',
}

export const mypageSummary = [
  { id: 'weekly', label: '이번 회차 추천', value: '20줄' },
  { id: 'month', label: '최근 4주 추천', value: '70줄' },
  { id: 'hit', label: '평균 적중', value: '1.5개' },
]

export const mypageLines = [
  '4, 11, 18, 26, 33, 41',
  '2, 8, 19, 27, 34, 42',
  '5, 12, 21, 29, 37, 44',
]
