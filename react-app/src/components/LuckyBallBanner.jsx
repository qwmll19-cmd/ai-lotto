import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { guestDraw } from '../api/lottoApi.js'
import LottoBall from './LottoBall.jsx'

/**
 * 비회원용 공 뽑기 배너
 * - 회차당 1회 제한 (localStorage)
 * - AI가 선정한 이번 주 TOP 번호 1개 공개
 * - 회원가입 유도
 */
function LuckyBallBanner() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('IDLE') // IDLE | DRAWING | REVEAL | DONE
  const [drawnNumber, setDrawnNumber] = useState(null)
  const [hasDrawnThisRound, setHasDrawnThisRound] = useState(false)
  const [error, setError] = useState('')
  const [shufflingNumber, setShufflingNumber] = useState(null)
  const timersRef = useRef([])

  // 타이머 정리 함수
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [])

  // 랜덤 공 애니메이션용
  const [bouncingBalls] = useState(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      num: Math.floor(Math.random() * 45) + 1,
      x: Math.random() * 70 + 15,
      y: Math.random() * 50 + 25,
      delay: Math.random() * 1.5,
      duration: 1.5 + Math.random() * 1,
    }))
  )

  // 이번 회차에 이미 뽑았는지 확인
  useEffect(() => {
    getOrCreateSessionId() // 세션 ID 초기화
    const lastDrawRound = localStorage.getItem('luckyBall_round')
    const lastDrawNumber = localStorage.getItem('luckyBall_number')
    const currentRound = getCurrentRound()

    if (lastDrawRound === String(currentRound) && lastDrawNumber) {
      setHasDrawnThisRound(true)
      setDrawnNumber(parseInt(lastDrawNumber, 10))
      setStatus('DONE')
    }
  }, [])

  // 세션 ID 생성/조회
  const getOrCreateSessionId = () => {
    let sessionId = localStorage.getItem('luckyBall_sessionId')
    if (!sessionId) {
      sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('luckyBall_sessionId', sessionId)
    }
    return sessionId
  }

  // 현재 회차 계산 (간단히 주 단위로)
  const getCurrentRound = () => {
    const now = new Date()
    const year = now.getFullYear()
    const weekNumber = Math.ceil(
      ((now - new Date(year, 0, 1)) / 86400000 + new Date(year, 0, 1).getDay() + 1) / 7
    )
    return `${year}${weekNumber}`
  }

  // 숫자 셔플 애니메이션
  const startShuffleAnimation = (finalNumber, callback) => {
    let count = 0
    const maxCount = 20 // 셔플 횟수
    const intervalTime = 80 // 처음 속도 (ms)

    const shuffle = () => {
      count++
      // 랜덤 숫자 표시
      setShufflingNumber(Math.floor(Math.random() * 45) + 1)

      if (count < maxCount) {
        // 점점 느려지는 효과
        const delay = intervalTime + (count * 15)
        const timerId = setTimeout(shuffle, delay)
        timersRef.current.push(timerId)
      } else {
        // 최종 번호 표시 전 잠시 멈춤
        const timerId = setTimeout(() => {
          setShufflingNumber(null)
          callback(finalNumber)
        }, 300)
        timersRef.current.push(timerId)
      }
    }

    shuffle()
  }

  // 공 뽑기 실행
  const handleDraw = async () => {
    if (hasDrawnThisRound) {
      setError('이번 회차에 이미 한 번 뽑으셨습니다.')
      return
    }

    setStatus('DRAWING')
    setError('')

    try {
      const sessionId = getOrCreateSessionId()
      const result = await guestDraw(sessionId)

      if (result.alreadyDrawn) {
        setDrawnNumber(result.number)
        setHasDrawnThisRound(true)
        setStatus('DONE')
        return
      }

      const finalNumber = result.number || Math.floor(Math.random() * 45) + 1

      // 1.5초 후 셔플 애니메이션 시작
      const timer1 = setTimeout(() => {
        startShuffleAnimation(finalNumber, (number) => {
          setStatus('REVEAL')
          setDrawnNumber(number)

          // localStorage에 저장
          const currentRound = getCurrentRound()
          localStorage.setItem('luckyBall_round', currentRound)
          localStorage.setItem('luckyBall_number', String(number))

          // REVEAL 후 DONE으로 전환
          const timer2 = setTimeout(() => {
            setHasDrawnThisRound(true)
            setStatus('DONE')
          }, 1500)
          timersRef.current.push(timer2)
        })
      }, 1500)
      timersRef.current.push(timer1)
    } catch {
      // API 실패 시 클라이언트에서 랜덤 생성 (데모용)
      const finalNumber = Math.floor(Math.random() * 45) + 1

      const timer3 = setTimeout(() => {
        startShuffleAnimation(finalNumber, (number) => {
          setStatus('REVEAL')
          setDrawnNumber(number)

          const currentRound = getCurrentRound()
          localStorage.setItem('luckyBall_round', currentRound)
          localStorage.setItem('luckyBall_number', String(number))

          const timer4 = setTimeout(() => {
            setHasDrawnThisRound(true)
            setStatus('DONE')
          }, 1500)
          timersRef.current.push(timer4)
        })
      }, 1500)
      timersRef.current.push(timer3)
    }
  }

  // 회원가입 페이지로 이동
  const goToSignup = () => {
    navigate('/signup')
  }

  return (
    <section className="lucky-ball-banner">
      <div className="lucky-ball-banner__inner">
        {/* IDLE 상태 - 공 뽑기 전 */}
        {status === 'IDLE' && (
          <>
            <div className="lucky-ball-banner__header">
              <span className="lucky-ball-banner__badge">AI Pick</span>
              <h2>이번 주 번호, 공 뽑기로 가볍게 맛보기</h2>
              <p>버튼 한 번이면 AI가 이번 회차 후보 중 번호 1개를 대신 골라 드립니다.</p>
              <p>한 회차에 한 번만 참여할 수 있고, 전체 6개 조합은 가입 후 확인하실 수 있어요.</p>
            </div>

            <div className="lucky-ball-banner__machine" onClick={handleDraw}>
              <div className="lucky-ball-banner__balls">
                {bouncingBalls.map((ball) => (
                  <div
                    key={ball.id}
                    className="lucky-ball-banner__bouncing-ball"
                    style={{
                      left: `${ball.x}%`,
                      top: `${ball.y}%`,
                      animationDelay: `${ball.delay}s`,
                      animationDuration: `${ball.duration}s`,
                    }}
                  >
                    <LottoBall num={ball.num} size="sm" />
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn--primary lucky-ball-banner__btn">
                AI 공 뽑기 시작하기
              </button>
            </div>
            <p className="lucky-ball-banner__disclaimer">게임 결과는 참고용이며, 실제 당첨을 보장하지 않습니다.</p>
          </>
        )}

        {/* DRAWING 상태 - 뽑는 중 */}
        {status === 'DRAWING' && (
          <div className="lucky-ball-banner__drawing">
            <h2>{shufflingNumber ? 'AI가 번호를 고르는 중...' : '공을 섞는 중...'}</h2>
            <div className="lucky-ball-banner__shuffle-container">
              {shufflingNumber ? (
                <div className="lucky-ball-banner__shuffle-ball">
                  <LottoBall num={shufflingNumber} size="xl" />
                </div>
              ) : (
                <div className="lucky-ball-banner__spinner">
                  <div className="lucky-ball-banner__spinner-balls">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div
                        key={i}
                        className="lucky-ball-banner__spinner-ball"
                        style={{
                          animationDelay: `${i * 0.08}s`,
                          '--rotation': `${i * 45}deg`
                        }}
                      >
                        <LottoBall num={Math.floor(Math.random() * 45) + 1} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="lucky-ball-banner__drawing-hint">잠시만 기다려주세요...</p>
          </div>
        )}

        {/* REVEAL 상태 - 최종 번호 공개 */}
        {status === 'REVEAL' && drawnNumber && (
          <div className="lucky-ball-banner__reveal">
            <div className="lucky-ball-banner__reveal-effect">
              <div className="lucky-ball-banner__reveal-glow" />
              <div className="lucky-ball-banner__reveal-ball">
                <LottoBall num={drawnNumber} size="xl" />
              </div>
              <div className="lucky-ball-banner__reveal-sparkles">
                {[...Array(12)].map((_, i) => (
                  <span
                    key={i}
                    className="lucky-ball-banner__sparkle"
                    style={{ '--angle': `${i * 30}deg`, '--delay': `${i * 0.05}s` }}
                  />
                ))}
              </div>
            </div>
            <h2 className="lucky-ball-banner__reveal-text">
              <span className="lucky-ball-banner__reveal-number">{drawnNumber}</span>
              번!
            </h2>
          </div>
        )}

        {/* DONE 상태 - 결과 표시 */}
        {status === 'DONE' && drawnNumber && (
          <>
            <div className="lucky-ball-banner__header">
              <span className="lucky-ball-banner__badge">AI Pick</span>
              <h2>AI가 뽑은 이번 주 번호</h2>
              <p>지금 뽑힌 숫자는 이번 회차 후보 중 AI가 골라 준 번호 1개입니다.</p>
              <p>이 번호를 포함한 전체 6개 조합과 매주 1줄 자동 추천은 무료 회원부터 이용하실 수 있어요.</p>
            </div>

            <div className="lucky-ball-banner__result">
              <div className="lucky-ball-banner__result-ball">
                <LottoBall num={drawnNumber} size="xl" />
              </div>
              <p className="lucky-ball-banner__result-text">
                AI가 뽑은 이번 주 번호는 <strong>{drawnNumber}</strong> 입니다.
              </p>
            </div>

            <div className="lucky-ball-banner__cta">
              <p className="lucky-ball-banner__cta-summary">
                전체 조합까지 보고 싶다면, 무료 회원으로 가입해 이번 주 2줄을 먼저 받아보세요.
              </p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={goToSignup}
              >
                무료로 가입하고 오늘 2줄 받기
              </button>
              <p className="lucky-ball-banner__disclaimer">가입 첫 회차에만 2줄이 제공되며, 이후에는 매주 1줄씩 무료로 발급됩니다.</p>
              {/* 개발용 초기화 버튼 - 배포 시 삭제 */}
              {import.meta.env.DEV && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{ marginTop: '16px', fontSize: '12px', opacity: 0.6 }}
                  onClick={() => {
                    localStorage.removeItem('luckyBall_round')
                    localStorage.removeItem('luckyBall_number')
                    localStorage.removeItem('luckyBall_sessionId')
                    setStatus('IDLE')
                    setDrawnNumber(null)
                    setHasDrawnThisRound(false)
                  }}
                >
                  [DEV] 초기화하고 다시 뽑기
                </button>
              )}
            </div>
          </>
        )}

        {error && <p className="lucky-ball-banner__error">{error}</p>}
      </div>
    </section>
  )
}

export default LuckyBallBanner
