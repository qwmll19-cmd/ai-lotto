import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNotification } from '../../context/NotificationContext.jsx'
import { historyRows, latestDrawMock } from '../../data/mockData.js'
import { fetchHistory, fetchLatestDraw } from '../../api/lottoApi.js'
import LottoBall from '../../components/LottoBall.jsx'
import { parseNumbers } from '../../utils/lottoUtils.js'

function History() {
  const { isAuthed, isLoading: authLoading } = useAuth()
  const { error: showError } = useNotification()
  const [rows, setRows] = useState(historyRows)
  const [latestDraw, setLatestDraw] = useState(latestDrawMock)
  const [search, setSearch] = useState('')
  const [aiFilter, setAiFilter] = useState('all')
  const [limit, setLimit] = useState('20')
  const [sortOrder, setSortOrder] = useState('desc')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(historyRows.length)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(null) // 에러 상태
  const [expandedCards, setExpandedCards] = useState({}) // 펼쳐진 카드 상태
  const [retentionDays, setRetentionDays] = useState(14) // 플랜별 보관 기간
  const [userPlan, setUserPlan] = useState('FREE')

  // 최신 당첨 번호 로드 (비로그인도 가능)
  useEffect(() => {
    const loadLatest = async () => {
      try {
        const data = await fetchLatestDraw()
        if (data) setLatestDraw(data)
      } catch {
        // 에러 시 mock 데이터 사용
      }
    }
    loadLatest()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, aiFilter, limit, sortOrder, pageSize])

  // 히스토리 데이터는 로그인 시에만 로드
  useEffect(() => {
    if (!isAuthed) return

    let active = true

    const load = async () => {
      setLoading(true)
      setFetchError(null)
      const params = {
        q: search.trim() || undefined,
        ai: aiFilter,
        sort: sortOrder,
        limit: limit === 'all' ? 500 : limit,
        page,
        page_size: pageSize,
      }
      try {
        const data = await fetchHistory(params)
        if (!active) return
        setRows(data.items || [])
        setTotal(data.meta?.total || data.items?.length || 0)
        setRetentionDays(data.meta?.retention_days || 14)
        setUserPlan(data.meta?.plan || 'FREE')
      } catch (err) {
        if (!active) return
        console.error('History fetch error:', err)
        setFetchError('히스토리를 불러오는 중 오류가 발생했습니다.')
        showError('히스토리를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.')
        setRows(historyRows)
        setTotal(historyRows.length)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [isAuthed, aiFilter, limit, page, pageSize, search, sortOrder, showError])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleCsvExport = () => {
    if (!rows.length) return
    const header = ['회차', '당첨 번호', '보너스', 'AI 추천 여부', '발표일']
    const lines = rows.map((row) => {
      const nums = Array.isArray(row.numbers) ? row.numbers.join(', ') : row.numbers
      return [row.round, nums, row.bonus, row.ai, row.date]
    })
    const csv = [header, ...lines].map((line) => line.join(',')).join('\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'lotto_history.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const toggleCard = (round) => {
    setExpandedCards((prev) => ({
      ...prev,
      [round]: !prev[round],
    }))
  }

  // 당첨번호 배열 파싱 (문자열 또는 배열 지원)
  const getWinningNumbers = (row) => {
    if (Array.isArray(row.numbers)) return row.numbers
    if (typeof row.numbers === 'string') {
      return row.numbers.split(',').map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n))
    }
    return []
  }

  // 매칭 분석 계산
  const calculateMatchAnalysis = (row) => {
    if (!row.my_lines || row.my_lines.length === 0) return null

    const winningNumbers = getWinningNumbers(row)
    const bonus = row.bonus

    const lineResults = row.my_lines.map((line) => {
      const nums = parseNumbers(line)
      const matchedNums = nums.filter((n) => winningNumbers.includes(n))
      const matchedBonus = nums.includes(bonus)
      const matchCount = matchedNums.length

      let rank = null
      if (matchCount === 6) rank = 1
      else if (matchCount === 5 && matchedBonus) rank = 2
      else if (matchCount === 5) rank = 3
      else if (matchCount === 4) rank = 4
      else if (matchCount === 3) rank = 5

      return { nums, matchedNums, matchedBonus, matchCount, rank }
    })

    const bestRank = lineResults.reduce((best, r) => {
      if (r.rank === null) return best
      if (best === null) return r.rank
      return Math.min(best, r.rank)
    }, null)

    const totalMatches = lineResults.reduce((sum, r) => sum + r.matchCount, 0)
    const avgMatches = (totalMatches / lineResults.length).toFixed(1)

    return { lineResults, bestRank, avgMatches }
  }

  // 로딩 중일 때
  if (authLoading) {
    return (
      <div className="page history-page">
        <section className="history-hero">
          <div className="history-hero__inner">
            <h1>당첨 번호 히스토리</h1>
            <p>로딩 중...</p>
          </div>
        </section>
      </div>
    )
  }

  // 비로그인 시 로그인 유도 화면
  if (!isAuthed) {
    return (
      <div className="page history-page">
        <section className="history-hero">
          <div className="history-hero__inner">
            <h1>당첨 번호 히스토리</h1>
            <p>회차별 당첨 번호를 확인하고 내 추천과 비교해보세요.</p>
          </div>
        </section>

        {/* 최신 당첨 번호만 표시 */}
        <section className="history-latest">
          <div className="history-latest__inner">
            <div className="history-latest__card">
              <div className="history-latest__header">
                <div>
                  <span className="history-latest__round">{latestDraw.draw_no}회</span>
                  <span className="history-latest__date">{latestDraw.draw_date}</span>
                </div>
                <span className="history-latest__badge">최신 당첨번호</span>
              </div>
              <div className="history-latest__numbers">
                {(latestDraw.numbers || []).map((num) => (
                  <LottoBall key={num} num={num} />
                ))}
                <span className="history-latest__plus">+</span>
                <LottoBall num={latestDraw.bonus} isBonus />
              </div>
            </div>
          </div>
        </section>

        {/* 로그인 유도 */}
        <section className="history-login-required">
          <div className="history-login-required__inner">
            <div className="history-login-required__card">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <h2>로그인이 필요합니다</h2>
              <p>전체 당첨 번호 히스토리는 회원 전용 서비스입니다.<br />로그인 후 이용해 주세요.</p>
              <Link to="/login" className="btn btn--primary btn--lg">
                로그인하기
              </Link>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page history-page">
      {/* Hero */}
      <section className="history-hero">
        <div className="history-hero__inner">
          <h1>당첨 번호 히스토리</h1>
          <p>회차별 당첨 번호를 확인하고 내 추천과 비교해보세요.</p>
        </div>
      </section>

      {/* 최신 당첨 번호 */}
      <section className="history-latest">
        <div className="history-latest__inner">
          <div className="history-latest__card">
            <div className="history-latest__header">
              <div>
                <span className="history-latest__round">{latestDraw.draw_no}회</span>
                <span className="history-latest__date">{latestDraw.draw_date}</span>
              </div>
              <span className="history-latest__badge">최신 당첨번호</span>
            </div>
            <div className="history-latest__numbers">
              {(latestDraw.numbers || []).map((num) => (
                <LottoBall key={num} num={num} />
              ))}
              <span className="history-latest__plus">+</span>
              <LottoBall num={latestDraw.bonus} isBonus />
            </div>
            <Link to="/mypage" className="history-latest__action">
              내 추천과 비교하기 →
            </Link>
          </div>
        </div>
      </section>

      {/* 플랜별 히스토리 제한 안내 */}
      <section className="history-plan-notice">
        <div className="history-plan-notice__inner">
          <div className="history-plan-notice__content">
            <span className="history-plan-notice__badge">{userPlan}</span>
            <span className="history-plan-notice__text">
              현재 플랜은 최근 <strong>{retentionDays}일</strong> 이내 히스토리만 조회 가능합니다.
            </span>
            {userPlan === 'FREE' && (
              <Link to="/pricing" className="history-plan-notice__link">
                플랜 업그레이드로 더 긴 기간 보기 →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* 필터 영역 */}
      <section className="history-filters">
        <div className="history-filters__inner">
          <div className="history-filters__row">
            <div className="history-filters__search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="회차 또는 번호 검색"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="history-filters__selects">
              <select value={aiFilter} onChange={(event) => setAiFilter(event.target.value)}>
                <option value="all">AI 추천 전체</option>
                <option value="yes">추천 있음</option>
                <option value="no">추천 없음</option>
              </select>
              <select value={limit} onChange={(event) => setLimit(event.target.value)}>
                <option value="20">최근 20회</option>
                <option value="50">최근 50회</option>
                <option value="100">최근 100회</option>
                <option value="all">전체</option>
              </select>
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                <option value="desc">최신순</option>
                <option value="asc">오래된순</option>
              </select>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
              >
                <option value={10}>10개씩</option>
                <option value={20}>20개씩</option>
                <option value={50}>50개씩</option>
              </select>
            </div>
            <button className="btn btn--ghost btn--sm" type="button" onClick={handleCsvExport}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              CSV 내보내기
            </button>
          </div>
        </div>
      </section>

      {/* 카드 리스트 */}
      <section className="history-content">
        <div className="history-content__inner">
          {loading && (
            <div className="history-loading">
              <span className="spinner" />
              로딩 중...
            </div>
          )}

          {!loading && fetchError ? (
            <div className="history-empty history-empty--error">
              <p>{fetchError}</p>
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => window.location.reload()}
              >
                새로고침
              </button>
            </div>
          ) : !loading && rows.length === 0 ? (
            <div className="history-empty">
              <p>조건에 맞는 회차가 없습니다. 필터를 조정해 주세요.</p>
            </div>
          ) : (
            <div className="history-cards">
              {rows.map((row) => {
                const isExpanded = expandedCards[row.round]
                const hasMyLines = row.my_lines && row.my_lines.length > 0
                const winningNumbers = getWinningNumbers(row)
                // 사용자가 MyPage에서 결과 확인을 완료한 경우에만 매칭 분석 표시
                const userChecked = row.user_checked === true
                const analysis = (hasMyLines && userChecked) ? calculateMatchAnalysis(row) : null

                return (
                  <div
                    key={row.round}
                    className={`history-card ${isExpanded ? 'history-card--expanded' : ''} ${analysis?.bestRank ? 'history-card--win' : ''}`}
                  >
                    {/* 카드 헤더 - 당첨번호 */}
                    <div className="history-card__header">
                      <div className="history-card__info">
                        <span className="history-card__round">{row.round}회</span>
                        <span className="history-card__date">{row.date}</span>
                        {hasMyLines && (
                          <span className="history-card__ai-badge">AI 추천</span>
                        )}
                        {analysis?.bestRank && (
                          <span className="history-card__rank-badge">
                            {analysis.bestRank}등 당첨!
                          </span>
                        )}
                        {hasMyLines && !userChecked && (
                          <span className="history-card__unchecked-badge">
                            결과 미확인
                          </span>
                        )}
                      </div>
                      <div className="history-card__numbers">
                        {winningNumbers.map((num) => (
                          <LottoBall key={num} num={num} size="sm" />
                        ))}
                        <span className="history-card__plus">+</span>
                        <LottoBall num={row.bonus} isBonus size="sm" />
                      </div>
                    </div>

                    {/* 내 번호 보기 버튼 또는 추천 없음 표시 */}
                    {hasMyLines ? (
                      <button
                        className="history-card__toggle"
                        onClick={() => toggleCard(row.round)}
                        type="button"
                      >
                        <span>📋 내가 받은 번호 ({row.my_lines.length}줄)</span>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={isExpanded ? 'rotated' : ''}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    ) : (
                      <div className="history-card__no-recommend">
                        <span>이 회차에 받은 AI 추천이 없습니다</span>
                      </div>
                    )}

                    {/* 펼침 영역 - 내 번호 + 분석 */}
                    {isExpanded && hasMyLines && (
                      <div className="history-card__detail">
                        {/* 결과 미확인 안내 */}
                        {!userChecked && (
                          <div className="history-card__unchecked-notice">
                            <p>내 조합 페이지에서 결과 확인 버튼을 눌러야 상세 결과를 볼 수 있습니다.</p>
                          </div>
                        )}

                        {/* 내 번호 리스트 (결과 확인 완료 시에만 매칭 정보 표시) */}
                        <div className="history-card__my-lines">
                          {(analysis?.lineResults || row.my_lines.map(line => ({ nums: parseNumbers(line) }))).map((result, idx) => (
                            <div
                              key={idx}
                              className={`history-card__line ${(analysis && result.rank) ? 'history-card__line--win' : ''}`}
                            >
                              <span className="history-card__line-label">{idx + 1}줄</span>
                              <div className="history-card__line-numbers">
                                {result.nums.map((num) => (
                                  <LottoBall
                                    key={num}
                                    num={num}
                                    size="sm"
                                    isMatch={analysis ? result.matchedNums?.includes(num) : false}
                                  />
                                ))}
                              </div>
                              {analysis ? (
                                <span className={`history-card__line-result ${result.matchCount >= 3 ? 'history-card__line-result--highlight' : ''}`}>
                                  {result.matchCount}개 일치
                                  {result.matchedBonus && ' +보너스'}
                                  {result.rank && ` (${result.rank}등)`}
                                </span>
                              ) : (
                                <span className="history-card__line-result history-card__line-result--pending">
                                  결과 미확인
                                </span>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* 분석 요약 (결과 확인 완료 시에만 표시) */}
                        {analysis && (
                          <div className="history-card__analysis">
                            <div className="history-card__analysis-item">
                              <span className="history-card__analysis-label">최고 등수</span>
                              <span className="history-card__analysis-value">
                                {analysis.bestRank ? `${analysis.bestRank}등` : '낙첨'}
                              </span>
                            </div>
                            <div className="history-card__analysis-item">
                              <span className="history-card__analysis-label">평균 일치</span>
                              <span className="history-card__analysis-value">{analysis.avgMatches}개</span>
                            </div>
                            <div className="history-card__analysis-item">
                              <span className="history-card__analysis-label">총 줄수</span>
                              <span className="history-card__analysis-value">{row.my_lines.length}줄</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* 페이지네이션 */}
          <div className="history-pagination">
            <button
              className="history-pagination__btn"
              type="button"
              onClick={() => setPage(1)}
              disabled={page === 1 || loading}
            >
              처음
            </button>
            <button
              className="history-pagination__btn"
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1 || loading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="history-pagination__info">
              <strong>{page}</strong> / {totalPages}
            </span>
            <button
              className="history-pagination__btn"
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || loading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <button
              className="history-pagination__btn"
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || loading}
            >
              마지막
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default History
