/**
 * 번호 배열을 파싱하여 숫자 배열로 반환
 */
export function parseNumbers(numbersStr) {
  if (Array.isArray(numbersStr)) return numbersStr
  if (typeof numbersStr === 'string') {
    return numbersStr.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n))
  }
  return []
}
