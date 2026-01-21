import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { fetchPremiumStats, getFixedCandidates } from '../../api/lottoApi.js'
import LottoBall from '../../components/LottoBall.jsx'

function Stats() {
  const { isAuthed, isLoading: authLoading, user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // 추천 공 (고급설정 연동)
  const [recommendNumbers, setRecommendNumbers] = useState([])
  const [recommendLoading, setRecommendLoading] = useState(false)
  const [recommendMessage, setRecommendMessage] = useState(null)

  const planType = (user?.tier || user?.subscription_type || 'free').toLowerCase()
  const isPaidPlan = ['basic', 'premium', 'vip'].includes(planType)
  const canGetRecommend = ['premium', 'vip'].includes(planType)

  useEffect(() => {
    if (!isAuthed || !isPaidPlan) return

    let active = true
    setLoading(true)
    setError(null)

    const load = async () => {
      try {
        const data = await fetchPremiumStats()
        if (!active) return
        setStats(data)

        // PREMIUM/VIP면 저장된 추천 공만 가져오기 (새로 뽑지 않음)
        if (canGetRecommend) {
          try {
            const res = await getFixedCandidates(false, true) // checkOnly=true
            if (!active) return
            if (res.success && res.candidates?.length > 0) {
              setRecommendNumbers(res.candidates.sort((a, b) => a - b))
            }
          } catch {
            // 추천 공 조회 실패는 무시
          }
        }
      } catch (err) {
        if (!active) return
        setError(err.message || '통계를 불러오는데 실패했습니다.')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [isAuthed, isPaidPlan, canGetRecommend])

  // 추천 공 받기 (고급설정 API 호출)
  const handleGetRecommend = async (refresh = false) => {
    if (recommendLoading) return
    setRecommendLoading(true)
    setRecommendMessage(null)
    try {
      const res = await getFixedCandidates(refresh)
      if (res.success && res.candidates?.length > 0) {
        setRecommendNumbers(res.candidates.sort((a, b) => a - b))
        // 이미 발급된 번호인 경우 메시지 표시 (refresh=false이고 저장된 번호가 있을 때)
        if (!refresh && res.target_draw_no) {
          setRecommendMessage(`${res.target_draw_no}회차 번호가 이미 발급되어 있습니다.`)
        }
      } else if (!res.success) {
        setRecommendMessage(res.message || '추천 공 조회에 실패했습니다.')
      }
    } catch (err) {
      console.error('추천 공 조회 실패:', err)
      setRecommendMessage('추천 공 조회 중 오류가 발생했습니다.')
    } finally {
      setRecommendLoading(false)
    }
  }

  // 로딩 중
  if (authLoading) {
    return (
      <section className="stats">
        <div className="page-head">
          <h1>AI 패턴 분석</h1>
          <p>로딩 중...</p>
        </div>
      </section>
    )
  }

  // 비로그인
  if (!isAuthed) {
    return (
      <section className="stats">
        <div className="page-head">
          <h1>AI 패턴 분석</h1>
          <p>AI가 분석한 핵심 번호 정보를 제공합니다.</p>
        </div>
        <div className="stats__login-required">
          <div className="stats__login-card">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h2>로그인이 필요합니다</h2>
            <p>AI 패턴 분석은 회원 전용 서비스입니다.<br />로그인 후 이용해 주세요.</p>
            <Link to="/login" className="btn btn--primary btn--lg">
              로그인하기
            </Link>
          </div>
        </div>
      </section>
    )
  }

  // 무료 플랜
  if (!isPaidPlan) {
    return (
      <section className="stats">
        <div className="page-head">
          <h1>AI 패턴 분석</h1>
          <p>AI가 분석한 핵심 번호 정보를 제공합니다.</p>
        </div>
        <div className="stats__login-required">
          <div className="stats__login-card">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <h2>유료 플랜 전용</h2>
            <p>AI 패턴 분석은 BASIC 이상 플랜에서<br />이용 가능합니다.</p>
            <Link to="/pricing" className="btn btn--primary btn--lg">
              플랜 업그레이드
            </Link>
          </div>
        </div>
      </section>
    )
  }

  // 데이터 로딩 중
  if (loading) {
    return (
      <section className="stats">
        <div className="page-head">
          <h1>AI 패턴 분석</h1>
          <p>AI가 분석한 핵심 번호 정보를 제공합니다.</p>
        </div>
        <div className="stats__loading">
          <span className="spinner" />
          <p>AI가 패턴을 분석하고 있습니다...</p>
        </div>
      </section>
    )
  }

  // 에러
  if (error) {
    return (
      <section className="stats">
        <div className="page-head">
          <h1>AI 패턴 분석</h1>
          <p>AI가 분석한 핵심 번호 정보를 제공합니다.</p>
        </div>
        <div className="stats__error">
          <p>{error}</p>
          <button className="btn btn--primary" onClick={() => window.location.reload()}>
            다시 시도
          </button>
        </div>
      </section>
    )
  }

  // 메인 컨텐츠
  return (
    <section className="stats">
      <div className="page-head">
        <h1>AI 패턴 분석</h1>
        <p>
          {stats?.data_info?.analysis_period || '최근 50회차'} 기준 분석 결과
          <span className={`stats__plan-badge stats__plan-badge--${planType}`}>
            {planType.toUpperCase()}
          </span>
        </p>
      </div>

      <div className="stats__cards">
        {/* 추천 공 카드 - 플랜별 차등 */}
        <div className={`stats__card stats__card--recommend ${planType === 'basic' ? 'stats__card--locked' : ''}`}>
          <div className="stats__card-header">
            <span className="stats__card-icon">🎯</span>
            <h3>추천 공</h3>
            <span className="stats__card-count">
              {planType === 'vip' ? '3개' : planType === 'premium' ? '2개' : '-'}
            </span>
          </div>
          {planType === 'basic' ? (
            /* Basic: 전체 자물쇠 */
            <Link to="/pricing" className="stats__card-locked-content">
              <svg className="stats__lock-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <p>PREMIUM 이상 플랜에서 이용 가능</p>
              <span className="btn btn--outline btn--sm">플랜 업그레이드</span>
            </Link>
          ) : planType === 'premium' ? (
            /* Premium: 2개 + 자물쇠 1개 */
            recommendNumbers.length > 0 ? (
              <>
                <div className="stats__card-balls">
                  {recommendNumbers.slice(0, 2).map((num) => (
                    <LottoBall key={num} num={num} size="lg" />
                  ))}
                  <Link to="/pricing" className="stats__locked-ball" title="VIP 플랜에서 3개 이용 가능">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </Link>
                </div>
                <p className="stats__card-desc">AI가 분석한 유력 번호 <span className="stats__vip-hint">(VIP: 3개)</span></p>
              </>
            ) : (
              <div className="stats__card-empty">
                <p>추천 번호를 받아보세요</p>
                {recommendMessage && (
                  <p className="stats__card-message">{recommendMessage}</p>
                )}
                <button
                  className="btn btn--primary"
                  onClick={() => handleGetRecommend(false)}
                  disabled={recommendLoading}
                  type="button"
                >
                  {recommendLoading ? '로딩...' : '추천 공 받기'}
                </button>
              </div>
            )
          ) : (
            /* VIP: 3개 전부 */
            recommendNumbers.length > 0 ? (
              <>
                <div className="stats__card-balls">
                  {recommendNumbers.map((num) => (
                    <LottoBall key={num} num={num} size="lg" />
                  ))}
                </div>
                <p className="stats__card-desc">AI가 분석한 유력 번호</p>
              </>
            ) : (
              <div className="stats__card-empty">
                <p>추천 번호를 받아보세요</p>
                {recommendMessage && (
                  <p className="stats__card-message">{recommendMessage}</p>
                )}
                <button
                  className="btn btn--primary"
                  onClick={() => handleGetRecommend(false)}
                  disabled={recommendLoading}
                  type="button"
                >
                  {recommendLoading ? '로딩...' : '추천 공 받기'}
                </button>
              </div>
            )
          )}
        </div>

        {/* 제일 안나온 번호 카드 */}
        <div className="stats__card stats__card--avoid">
          <div className="stats__card-header">
            <span className="stats__card-icon">🔍</span>
            <h3>제일 안나온 번호</h3>
            <span className="stats__card-count">{stats?.avoid_count || 0}개</span>
          </div>
          <div className="stats__card-balls">
            {(stats?.avoid_numbers || []).map((num) => (
              <LottoBall key={num} num={num} size="lg" dimmed />
            ))}
          </div>
          <p className="stats__card-desc">최근 30회차 출현 빈도 최하위</p>
        </div>

        {/* 반등 기대 번호 카드 */}
        <div className="stats__card stats__card--comeback">
          <div className="stats__card-header">
            <span className="stats__card-icon">⏰</span>
            <h3>반등 기대 번호</h3>
            <span className="stats__card-count">{stats?.comeback_count || 0}개</span>
          </div>
          <div className="stats__card-balls">
            {(stats?.comeback_numbers || []).map((num) => (
              <LottoBall key={num} num={num} size="lg" />
            ))}
          </div>
          <p className="stats__card-desc">10회 이상 미출현 번호</p>
        </div>

        {/* 구간별 출현 현황 */}
        <div className="stats__card stats__card--zone">
          <div className="stats__card-header">
            <span className="stats__card-icon">📊</span>
            <h3>구간별 출현 현황</h3>
          </div>
          <div className="stats__zone-bars">
            {stats?.zone_ratio && Object.entries(stats.zone_ratio).map(([zone, ratio]) => (
              <div key={zone} className="stats__zone-item">
                <span className="stats__zone-label">{zone}</span>
                <div className="stats__zone-bar-wrap">
                  <div
                    className="stats__zone-bar"
                    style={{ width: `${Math.min(ratio * 3, 100)}%` }}
                  />
                </div>
                <span className="stats__zone-value">{ratio}%</span>
              </div>
            ))}
          </div>
          <p className="stats__card-desc">최근 50회차 기준</p>
        </div>

        {/* 홀짝 밸런스 */}
        <div className="stats__card stats__card--balance">
          <div className="stats__card-header">
            <span className="stats__card-icon">⚖️</span>
            <h3>홀짝 밸런스</h3>
          </div>
          <div className="stats__balance-gauge">
            <div className="stats__balance-labels">
              <span>홀수</span>
              <span>짝수</span>
            </div>
            <div className="stats__balance-bar-wrap">
              <div
                className="stats__balance-bar stats__balance-bar--odd"
                style={{ width: `${((stats?.odd_even_balance?.avg_odd || 3) / 6) * 100}%` }}
              />
            </div>
            <div className="stats__balance-values">
              <span className="stats__balance-value">
                {stats?.odd_even_balance?.avg_odd || 3}개
              </span>
              <span className="stats__balance-value">
                {stats?.odd_even_balance?.avg_even || 3}개
              </span>
            </div>
          </div>
          <p className="stats__card-desc">최근 {stats?.odd_even_balance?.recent_draws || 5}회차 평균</p>
        </div>
      </div>
    </section>
  )
}

export default Stats
