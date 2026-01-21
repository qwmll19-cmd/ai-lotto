/**
 * 파일 다운로드 유틸리티 함수
 */

/**
 * 텍스트 데이터를 파일로 다운로드
 * @param {string} content - 파일 내용
 * @param {string} filename - 파일명
 * @param {string} mimeType - MIME 타입 (기본: text/plain)
 */
export function downloadTextFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * 로또 추천 번호를 텍스트 파일로 다운로드
 * @param {Array} lines - 번호 배열들의 배열
 * @param {string} prefix - 파일명 접두사 (기본: 'ai-lotto-추천번호')
 */
export function downloadLottoNumbers(lines, prefix = 'ai-lotto-추천번호') {
  if (!lines || lines.length === 0) return

  const text = lines.map((nums, idx) => {
    const numStr = Array.isArray(nums) ? nums.join(', ') : nums
    return `${idx + 1}줄: ${numStr}`
  }).join('\n')

  const date = new Date().toISOString().slice(0, 10)
  const filename = `${prefix}-${date}.txt`

  downloadTextFile(text, filename)
}

/**
 * CSV 형식으로 데이터 다운로드
 * @param {Array} data - 객체 배열
 * @param {string} filename - 파일명
 * @param {Array} headers - 헤더 이름 배열 (선택)
 */
export function downloadCSV(data, filename, headers = null) {
  if (!data || data.length === 0) return

  const keys = headers || Object.keys(data[0])
  const csvHeader = keys.join(',')
  const csvRows = data.map(row =>
    keys.map(key => {
      const value = row[key]
      // 쉼표나 줄바꿈이 포함된 값은 따옴표로 감싸기
      if (typeof value === 'string' && (value.includes(',') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value ?? ''
    }).join(',')
  )

  const csvContent = [csvHeader, ...csvRows].join('\n')
  downloadTextFile(csvContent, filename, 'text/csv;charset=utf-8')
}
