import { useState, Fragment } from 'react'
import LottoBall from './LottoBall.jsx'
import { parseNumbers } from '../utils/lottoUtils.js'

function HistoryTable({ rows, emptyMessage = '표시할 데이터가 없습니다.' }) {
  const [expandedRow, setExpandedRow] = useState(null)

  if (!rows.length) {
    return <div className="history__empty">{emptyMessage}</div>
  }

  const toggleExpand = (round) => {
    setExpandedRow(expandedRow === round ? null : round)
  }

  return (
    <div className="history__table history__table--enhanced">
      <table>
        <thead>
          <tr>
            <th>회차</th>
            <th>당첨 번호</th>
            <th>보너스</th>
            <th>AI 추천</th>
            <th>발표일</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const numbers = parseNumbers(row.numbers)
            const isExpanded = expandedRow === row.round

            return (
              <Fragment key={row.round}>
                <tr className={isExpanded ? 'history__row--expanded' : ''}>
                  <td>
                    <span className="history__round">{row.round}회</span>
                  </td>
                  <td>
                    <div className="history__numbers">
                      {numbers.map((num) => (
                        <LottoBall key={num} num={num} size="sm" />
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="history__bonus">
                      <span className="history__bonus-plus">+</span>
                      <LottoBall num={row.bonus} isBonus size="sm" />
                    </div>
                  </td>
                  <td>
                    <span className={`history__ai-badge ${row.ai === '추천 있음' ? 'history__ai-badge--yes' : 'history__ai-badge--no'}`}>
                      {row.ai === '추천 있음' ? '✓ 추천' : '미추천'}
                    </span>
                  </td>
                  <td>
                    <span className="history__date">{row.date}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="history__expand-btn"
                      onClick={() => toggleExpand(row.round)}
                      aria-label={isExpanded ? '접기' : '펼치기'}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={isExpanded ? 'history__expand-icon--open' : ''}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="history__detail-row">
                    <td colSpan={6}>
                      <div className="history__detail">
                        <div className="history__detail-section">
                          <h4>당첨 번호 분석</h4>
                          <div className="history__detail-stats">
                            <div className="history__detail-stat">
                              <span className="history__detail-label">합계</span>
                              <span className="history__detail-value">{numbers.reduce((a, b) => a + b, 0)}</span>
                            </div>
                            <div className="history__detail-stat">
                              <span className="history__detail-label">홀수</span>
                              <span className="history__detail-value">{numbers.filter(n => n % 2 === 1).length}개</span>
                            </div>
                            <div className="history__detail-stat">
                              <span className="history__detail-label">짝수</span>
                              <span className="history__detail-value">{numbers.filter(n => n % 2 === 0).length}개</span>
                            </div>
                            <div className="history__detail-stat">
                              <span className="history__detail-label">연속번호</span>
                              <span className="history__detail-value">
                                {numbers.sort((a, b) => a - b).reduce((count, num, i, arr) => {
                                  if (i > 0 && num - arr[i - 1] === 1) return count + 1
                                  return count
                                }, 0)}쌍
                              </span>
                            </div>
                          </div>
                        </div>
                        {row.ai === '추천 있음' && row.myLines && (
                          <div className="history__detail-section">
                            <h4>내 추천 번호 비교</h4>
                            <div className="history__detail-lines">
                              {row.myLines.map((line, idx) => {
                                const lineNums = parseNumbers(line)
                                const matchCount = lineNums.filter(n => numbers.includes(n)).length
                                return (
                                  <div key={idx} className="history__detail-line">
                                    <span className="history__detail-line-label">{idx + 1}줄</span>
                                    <div className="history__detail-line-numbers">
                                      {lineNums.map((num) => (
                                        <LottoBall
                                          key={num}
                                          num={num}
                                          size="sm"
                                          isMatch={numbers.includes(num)}
                                          isMiss={!numbers.includes(num)}
                                        />
                                      ))}
                                    </div>
                                    <span className={`history__detail-match ${matchCount >= 3 ? 'history__detail-match--win' : ''}`}>
                                      {matchCount}개 일치
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default HistoryTable
