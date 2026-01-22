/**
 * 로또 번호 공 컴포넌트
 * 번호 범위에 따라 색상 자동 적용
 */
function LottoBall({ num, isBonus = false, isMatch = false, isMiss = false, dimmed = false, size = 'md' }) {
  // 색상 결정: 1-10 노랑, 11-20 파랑, 21-30 빨강, 31-40 회색, 41-45 초록
  let colorClass = ''
  if (num <= 10) colorClass = 'lotto-ball--yellow'
  else if (num <= 20) colorClass = 'lotto-ball--blue'
  else if (num <= 30) colorClass = 'lotto-ball--red'
  else if (num <= 40) colorClass = 'lotto-ball--gray'
  else colorClass = 'lotto-ball--green'

  // 상태 클래스
  const bonusClass = isBonus ? 'lotto-ball--bonus' : ''
  const matchClass = isMatch ? 'lotto-ball--match' : ''
  const missClass = isMiss ? 'lotto-ball--miss' : ''
  const dimmedClass = dimmed ? 'lotto-ball--dimmed' : ''
  const sizeClass = size === 'sm' ? 'lotto-ball--sm' : size === 'lg' ? 'lotto-ball--lg' : ''

  return (
    <span className={`lotto-ball ${colorClass} ${sizeClass} ${bonusClass} ${matchClass} ${missClass} ${dimmedClass}`.trim()}>
      {num}
    </span>
  )
}

export default LottoBall
