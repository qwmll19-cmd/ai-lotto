import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { fetchLatestDraw } from '../api/lottoApi.js'
import { latestDrawMock } from '../data/mockData.js'
import LuckyBallBanner from './LuckyBallBanner.jsx'

function HeroSection() {
  const [latest, setLatest] = useState(null)
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

  // 번호 추천 페이지로 이동
  const handleGetAiNumbers = () => {
    navigate('/recommend')
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
          >
            이번 주 AI 번호 받기
          </button>
          <a className="btn btn--ghost" href="#why">
            어떻게 추천하나요?
          </a>
        </div>
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
