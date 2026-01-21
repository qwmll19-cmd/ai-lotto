import { useState, useEffect } from 'react'
import { fetchBacktestRange, runBacktest, runSingleBacktest } from '../../../api/adminApi.js'

function BacktestTab() {
  const [range, setRange] = useState(null)
  const [startDraw, setStartDraw] = useState('')
  const [endDraw, setEndDraw] = useState('')
  const [singleDraw, setSingleDraw] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [singleResult, setSingleResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadRange()
  }, [])

  async function loadRange() {
    try {
      const data = await fetchBacktestRange()
      setRange(data)
      if (data.min_draw && data.max_draw) {
        // 기본값: 최근 10회차
        setStartDraw(Math.max(data.min_draw, data.max_draw - 9))
        setEndDraw(data.max_draw)
      }
    } catch (err) {
      setError('범위 조회 실패: ' + err.message)
    }
  }

  async function handleRunBacktest() {
    if (!startDraw || !endDraw) {
      setError('시작/종료 회차를 입력하세요')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await runBacktest(Number(startDraw), Number(endDraw))
      setResult(data)
    } catch (err) {
      setError('백테스팅 실패: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSingleBacktest() {
    if (!singleDraw) {
      setError('회차를 입력하세요')
      return
    }
    setLoading(true)
    setError('')
    setSingleResult(null)
    try {
      const data = await runSingleBacktest(Number(singleDraw))
      setSingleResult(data)
    } catch (err) {
      setError('단일 백테스팅 실패: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin__backtest">
      <div className="admin__section">
        <h3>백테스팅 (알고리즘 성능 검증)</h3>
        <p className="admin__hint">
          과거 데이터로 추천 알고리즘의 성능을 테스트합니다.
          각 회차에 대해 이전 데이터로 번호를 생성하고, 실제 당첨번호와 비교합니다.
        </p>

        {range && (
          <p className="admin__info">
            테스트 가능 범위: {range.min_draw}회 ~ {range.max_draw}회 (총 {range.total_draws}개 회차)
          </p>
        )}
      </div>

      {error && <div className="admin__error">{error}</div>}

      {/* 다중 회차 백테스팅 */}
      <div className="admin__section">
        <h4>다중 회차 백테스팅</h4>
        <div className="admin__form-row">
          <label>
            시작 회차:
            <input
              type="number"
              value={startDraw}
              onChange={(e) => setStartDraw(e.target.value)}
              min={range?.min_draw}
              max={range?.max_draw}
            />
          </label>
          <label>
            종료 회차:
            <input
              type="number"
              value={endDraw}
              onChange={(e) => setEndDraw(e.target.value)}
              min={range?.min_draw}
              max={range?.max_draw}
            />
          </label>
          <button
            className="admin__btn admin__btn--primary"
            onClick={handleRunBacktest}
            disabled={loading}
          >
            {loading ? '테스트 중...' : '백테스팅 실행'}
          </button>
        </div>
      </div>

      {/* 다중 회차 결과 */}
      {result && (
        <div className="admin__section">
          <h4>백테스팅 결과 요약</h4>
          <div className="admin__stats-grid">
            <div className="admin__stat-card">
              <h5>테스트 회차</h5>
              <p className="admin__stat-value">{result.summary.total_draws}회</p>
            </div>
            <div className="admin__stat-card">
              <h5>총 생성 줄</h5>
              <p className="admin__stat-value">{result.summary.total_lines}줄</p>
            </div>
            <div className="admin__stat-card">
              <h5>평균 성능 점수</h5>
              <p className="admin__stat-value">{result.summary.avg_performance_score}/100</p>
            </div>
            <div className="admin__stat-card">
              <h5>줄당 평균 적중</h5>
              <p className="admin__stat-value">{result.summary.avg_matches_per_line}개</p>
            </div>
          </div>

          <h5>당첨 통계</h5>
          <table className="admin__table">
            <thead>
              <tr>
                <th>등수</th>
                <th>적중 조건</th>
                <th>횟수</th>
                <th>적중률</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>5등</td>
                <td>3개 일치</td>
                <td>{result.summary.total_match_3}줄</td>
                <td>{result.summary.match_3_rate}%</td>
              </tr>
              <tr>
                <td>4등</td>
                <td>4개 일치</td>
                <td>{result.summary.total_match_4}줄</td>
                <td>{result.summary.match_4_rate}%</td>
              </tr>
              <tr>
                <td>3등</td>
                <td>5개 일치</td>
                <td>{result.summary.total_match_5}줄</td>
                <td>{result.summary.match_5_rate}%</td>
              </tr>
              <tr>
                <td>1등</td>
                <td>6개 일치</td>
                <td>{result.summary.total_match_6}줄</td>
                <td>{result.summary.match_6_rate}%</td>
              </tr>
            </tbody>
          </table>

          <h5>로직별 평균 성능</h5>
          <table className="admin__table">
            <thead>
              <tr>
                <th>로직</th>
                <th>평균 적중 개수</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.summary.logic_avg_scores).map(([logic, score]) => (
                <tr key={logic}>
                  <td>{logic}</td>
                  <td>{score}개/줄</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h5>회차별 상세 결과</h5>
          <div className="admin__table-wrapper">
            <table className="admin__table">
              <thead>
                <tr>
                  <th>회차</th>
                  <th>줄 수</th>
                  <th>3개</th>
                  <th>4개</th>
                  <th>5개</th>
                  <th>6개</th>
                  <th>평균</th>
                  <th>점수</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r) => (
                  <tr key={r.draw_no}>
                    <td>{r.draw_no}회</td>
                    <td>{r.total_lines}</td>
                    <td>{r.match_3}</td>
                    <td>{r.match_4}</td>
                    <td>{r.match_5}</td>
                    <td>{r.match_6}</td>
                    <td>{r.avg_matches_per_line}</td>
                    <td>{r.performance_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 단일 회차 백테스팅 */}
      <div className="admin__section">
        <h4>단일 회차 백테스팅</h4>
        <div className="admin__form-row">
          <label>
            회차:
            <input
              type="number"
              value={singleDraw}
              onChange={(e) => setSingleDraw(e.target.value)}
              placeholder="예: 1150"
            />
          </label>
          <button
            className="admin__btn"
            onClick={handleSingleBacktest}
            disabled={loading}
          >
            테스트
          </button>
        </div>
      </div>

      {/* 단일 회차 결과 */}
      {singleResult && (
        <div className="admin__section">
          <h4>{singleResult.draw_no}회차 백테스팅 결과</h4>
          <p>
            <strong>당첨번호:</strong> {singleResult.winning_numbers.join(', ')} + {singleResult.bonus}
          </p>
          <div className="admin__stats-grid">
            <div className="admin__stat-card">
              <h5>생성 줄</h5>
              <p className="admin__stat-value">{singleResult.result.total_lines}줄</p>
            </div>
            <div className="admin__stat-card">
              <h5>3개 적중</h5>
              <p className="admin__stat-value">{singleResult.result.match_3}줄</p>
            </div>
            <div className="admin__stat-card">
              <h5>4개 적중</h5>
              <p className="admin__stat-value">{singleResult.result.match_4}줄</p>
            </div>
            <div className="admin__stat-card">
              <h5>5개 적중</h5>
              <p className="admin__stat-value">{singleResult.result.match_5}줄</p>
            </div>
            <div className="admin__stat-card">
              <h5>6개 적중</h5>
              <p className="admin__stat-value">{singleResult.result.match_6}줄</p>
            </div>
            <div className="admin__stat-card">
              <h5>성능 점수</h5>
              <p className="admin__stat-value">{singleResult.result.performance_score}/100</p>
            </div>
          </div>

          <h5>로직별 성능</h5>
          <table className="admin__table">
            <thead>
              <tr>
                <th>로직</th>
                <th>적중 개수</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(singleResult.result.logic_scores).map(([logic, score]) => (
                <tr key={logic}>
                  <td>{logic}</td>
                  <td>{score}개/줄</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default BacktestTab
