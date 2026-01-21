import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { fetchLatestDraw, getAiRecommendation } from '../api/lottoApi.js'
import { latestDrawMock } from '../data/mockData.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotification } from '../context/NotificationContext.jsx'
import LuckyBallBanner from './LuckyBallBanner.jsx'

function HeroSection() {
  const [latest, setLatest] = useState(null)
  const [recommendation, setRecommendation] = useState(null)
  const [loading, setLoading] = useState(false)
  const { isAuthed } = useAuth()
  const { error: showError } = useNotification()
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const data = await fetchLatestDraw()
        if (!active) return
        setLatest(data)
      } catch {
        if (!active) return
        setLatest(null)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const latestData = latest?.draw_no ? latest : latestDrawMock
  const latestRound = latestData?.draw_no ? `${latestData.draw_no}회` : '회차 미확정'
  const latestNumbers = Array.isArray(latestData?.numbers) ? latestData.numbers : []

  const handleGetAiNumbers = async () => {
    if (!isAuthed) {
      navigate('/signup')
      return
    }

    setLoading(true)
    try {
      const data = await getAiRecommendation()
      setRecommendation(data)
    } catch (err) {
      showError(err.message || 'AI 추천 번호를 가져오는데 실패했습니다.', '오류')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="hero" id="hero">
      <div className="hero__content">
        <div className="hero__badge">
          <span className="hero__badge-dot" />
          최신 회차 당첨번호 ·
        </div>
        <div className="hero__latest">
          <div className="hero__latest-table">
            <span className="hero__latest-round-pill">{latestRound}</span>
            {latestNumbers.length > 0 ? (
              latestNumbers.map((num) => (
                <span key={num} className="hero__latest-ball">
                  {num}
                </span>
              ))
            ) : (
              <span className="hero__latest-placeholder">데이터 준비중</span>
            )}
          </div>
        </div>
        <h1 className="hero__title">
          로또, 이제 감이 아니라
          <br />
          데이터로 고르세요.
        </h1>
        <p className="hero__desc">
          20년 이상 누적된 로또 당첨 데이터를 바탕으로,
          <br />
          번호별 출현 경향과 패턴을 분석해 <strong>비효율적인 조합</strong>을 먼저 걷어냅니다.
          <br />
          그 안에서 균형 잡힌 번호만 골라 추천해 드려요.
        </p>
        <div className="hero__actions">
          <button
            className="btn btn--primary"
            onClick={handleGetAiNumbers}
            disabled={loading}
          >
            {loading ? '로딩 중...' : '📩 이번 주 AI 번호 받기'}
          </button>
          <a className="btn btn--ghost" href="#why">
            어떻게 추천하나요?
          </a>
        </div>
        {recommendation && (
          <div className="hero__recommendation">
            <h3>🎯 AI 추천 번호</h3>
            <div className="hero__recommendation-numbers">
              {recommendation.numbers?.map((set, idx) => (
                <div key={idx} className="hero__recommendation-row">
                  <span className="hero__recommendation-label">{idx + 1}줄</span>
                  {set.map((num) => (
                    <span key={num} className="hero__latest-ball">{num}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="hero__footnote">
          본 서비스는 과거 통계 기반 정보 제공용이며, 당첨 및 수익을 보장하지 않습니다.
        </p>
      </div>
      <div className="hero__card" id="signup-card">
        <LuckyBallBanner />
      </div>
    </section>
  )
}

export default HeroSection
