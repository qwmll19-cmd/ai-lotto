import { useEffect, useState, useRef } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNotification } from '../../context/NotificationContext.jsx'
import { usePushNotification } from '../../hooks/usePushNotification.js'
import { latestDrawMock } from '../../data/mockData.js'
import { fetchMyPageLines, fetchLatestDraw, getFreeRecommendStatus, getPoolStatus, markResultChecked } from '../../api/lottoApi.js'
import { changePassword, deleteAccount } from '../../api/authApi.js'
import LottoBall from '../../components/LottoBall.jsx'
import { parseNumbers } from '../../utils/lottoUtils.js'

function MyPage() {
  const { user, setUser, logout } = useAuth()
  const { info, success } = useNotification()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'lines')
  const [lines, setLines] = useState([])
  const [targetDrawNo, setTargetDrawNo] = useState(null)
  const [latestDraw, setLatestDraw] = useState(latestDrawMock)
  const [saveMessage, setSaveMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [freeStatus, setFreeStatus] = useState({ weekly_used: 0, weekly_limit: 1, remaining: 1, is_first_week: false, lines: [] })
  const [showWaitMessage, setShowWaitMessage] = useState(false)
  const [showMatchResult, setShowMatchResult] = useState(false)
  const [matchResults, setMatchResults] = useState([])
  const [checkedLines, setCheckedLines] = useState({}) // 개별 줄 확인 상태 { lineIdx: { matchCount, matchedNums, matchedBonus, rank } }
  const [isDrumRolling, setIsDrumRolling] = useState(false) // 드럼롤 상태
  // 풀 시스템 상태 (BASIC/PREMIUM/VIP용)
  const [poolStatus, setPoolStatus] = useState({ pool_total: 0, revealed_count: 0, revealed_lines: [], all_revealed: false })
  // 현재 회차 카드 접기/펴기 (기본 접힘)
  const [currentExpanded, setCurrentExpanded] = useState(false)
  // 이전 회차 결과 확인용 상태
  const [prevDraw, setPrevDraw] = useState(null) // { draw_no, winning_numbers, bonus, my_lines, match_results, has_data }
  const [prevExpanded, setPrevExpanded] = useState(false) // 이전 회차 섹션 펼침/접힘 (기본 접힘)
  const [prevChecked, setPrevChecked] = useState(false) // 이전 회차 결과 확인 완료
  const [prevMatchResults, setPrevMatchResults] = useState([]) // 이전 회차 매칭 결과
  const [prevIsDrumRolling, setPrevIsDrumRolling] = useState(false) // 이전 회차 드럼롤 상태
  const [prevCheckedLines, setPrevCheckedLines] = useState({}) // 이전 회차 개별 줄 확인 상태
  const messageTimerRef = useRef(null)
  // 닉네임 설정 상태
  const [isEditingNickname, setIsEditingNickname] = useState(false)
  const [nicknameInput, setNicknameInput] = useState(user?.nickname || '')
  const [nicknameLoading, setNicknameLoading] = useState(false)
  const [nicknameError, setNicknameError] = useState('')
  // 웹 푸시 알림 훅
  const {
    isSupported: isPushSupported,
    isSubscribed: isPushSubscribed,
    isLoading: isPushLoading,
    permission: pushPermission,
    settings: pushSettings,
    error: pushError,
    subscribe: subscribePush,
    unsubscribe: unsubscribePushNotification,
    toggleSetting: togglePushSetting
  } = usePushNotification()
  // 비밀번호 변경 상태
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  // 계정 삭제 상태
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // 타이머 정리
  useEffect(() => {
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current)
    }
  }, [])

  // 티어 정보 (handleSaveLines에서 사용하기 위해 미리 선언)
  const userTier = user?.tier || 'FREE'
  const isFree = userTier === 'FREE'

  const handleSaveLines = () => {
    // 플랜에 따라 다른 데이터 소스 사용
    const linesToSave = isFree
      ? (freeStatus.lines || [])
      : (poolStatus.revealed_lines?.length > 0 ? poolStatus.revealed_lines : lines)

    if (linesToSave.length === 0) {
      setSaveMessage('저장할 추천 번호가 없습니다.')
      return
    }
    const text = linesToSave.map((line, idx) => {
      const nums = parseNumbers(line)
      return `${idx + 1}줄: ${nums.join(', ')}`
    }).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-lotto-추천번호-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setSaveMessage('추천 번호가 저장되었습니다!')
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current)
    messageTimerRef.current = setTimeout(() => setSaveMessage(''), 3000)
  }

  // 개별 줄 당첨 확인 - 팡 터지면서 결과 표시
  const handleCheckLine = (lineIdx, nums) => {
    const winningNumbers = latestDraw.numbers || []
    const bonusNumber = latestDraw.bonus

    const matchedNums = nums.filter(n => winningNumbers.includes(n))
    const matchedBonus = nums.includes(bonusNumber)
    const matchCount = matchedNums.length

    // 등수 계산
    let rank = null
    if (matchCount === 6) rank = 1
    else if (matchCount === 5 && matchedBonus) rank = 2
    else if (matchCount === 5) rank = 3
    else if (matchCount === 4) rank = 4
    else if (matchCount === 3) rank = 5

    // 클릭 즉시 폭죽 효과 (일치 개수에 따라 다르게)
    if (matchCount >= 3) {
      // 3개 이상: 큰 폭죽
      confetti({
        particleCount: 100 + matchCount * 50,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#ec4899', '#f472b6', '#fbbf24', '#34d399', '#60a5fa']
      })
    } else if (matchCount >= 1) {
      // 1~2개: 작은 폭죽
      confetti({
        particleCount: 30 + matchCount * 20,
        spread: 50,
        origin: { y: 0.6 },
        colors: ['#ec4899', '#f9a8d4']
      })
    } else {
      // 0개: 아쉬움 표현 (작은 회색 효과)
      confetti({
        particleCount: 20,
        spread: 30,
        origin: { y: 0.6 },
        colors: ['#9ca3af', '#d1d5db'],
        gravity: 1.5
      })
    }

    setCheckedLines(prev => ({
      ...prev,
      [lineIdx]: { matchCount, matchedNums, matchedBonus, rank }
    }))
  }

  // 전체 당첨번호 확인하기 - 드럼롤 후 결과 표시
  const handleCheckResult = () => {
    // 드럼롤 시작
    setIsDrumRolling(true)

    // 드럼롤 동안 작은 폭죽들 터뜨리기 (두구두구 느낌)
    const drumInterval = setInterval(() => {
      confetti({
        particleCount: 15,
        spread: 30,
        origin: { x: Math.random(), y: 0.5 },
        colors: ['#ec4899', '#f472b6', '#fbbf24'],
        gravity: 1.2,
        scalar: 0.8
      })
    }, 150)

    // 2초 후 결과 표시
    setTimeout(() => {
      clearInterval(drumInterval)
      setIsDrumRolling(false)

      const winningNumbers = latestDraw.numbers || []
      const bonusNumber = latestDraw.bonus

      // 내 번호들과 당첨번호 비교
      const linesToCheck = isFree
        ? (freeStatus.lines || [])
        : (poolStatus.revealed_lines?.length > 0 ? poolStatus.revealed_lines : lines)

      const results = linesToCheck.map((line, idx) => {
        const nums = parseNumbers(line)
        const matchedMain = nums.filter(n => winningNumbers.includes(n))
        const matchedBonus = nums.includes(bonusNumber)
        const matchCount = matchedMain.length

        // 등수 계산
        let rank = null
        if (matchCount === 6) rank = 1
        else if (matchCount === 5 && matchedBonus) rank = 2
        else if (matchCount === 5) rank = 3
        else if (matchCount === 4) rank = 4
        else if (matchCount === 3) rank = 5

        return {
          lineNo: idx + 1,
          numbers: nums,
          matchedMain,
          matchedBonus,
          matchCount,
          rank
        }
      })

      setMatchResults(results)
      setShowMatchResult(true)

      // 결과 발표 시 큰 폭죽
      const hasWin = results.some(r => r.rank !== null)
      if (hasWin) {
        // 당첨! 화려한 폭죽
        confetti({
          particleCount: 200,
          spread: 120,
          origin: { y: 0.5 },
          colors: ['#ec4899', '#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#a855f7']
        })
        setTimeout(() => {
          confetti({
            particleCount: 100,
            angle: 60,
            spread: 80,
            origin: { x: 0 }
          })
          confetti({
            particleCount: 100,
            angle: 120,
            spread: 80,
            origin: { x: 1 }
          })
        }, 300)
      } else {
        // 당첨 없음 - 작은 위로 폭죽
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#9ca3af', '#d1d5db', '#f9a8d4']
        })
      }
    }, 2000)
  }

  // 이전 회차 개별 줄 당첨 확인 - 팡 터지면서 결과 표시
  const handleCheckPrevLine = (lineIdx, nums) => {
    if (!prevDraw) return

    const winningNumbers = prevDraw.winning_numbers || []
    const bonusNumber = prevDraw.bonus

    const matchedNums = nums.filter(n => winningNumbers.includes(n))
    const matchedBonus = nums.includes(bonusNumber)
    const matchCount = matchedNums.length

    // 등수 계산
    let rank = null
    if (matchCount === 6) rank = 1
    else if (matchCount === 5 && matchedBonus) rank = 2
    else if (matchCount === 5) rank = 3
    else if (matchCount === 4) rank = 4
    else if (matchCount === 3) rank = 5

    // 클릭 즉시 폭죽 효과
    if (matchCount >= 3) {
      confetti({
        particleCount: 100 + matchCount * 50,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#ec4899', '#f472b6', '#fbbf24', '#34d399', '#60a5fa']
      })
    } else if (matchCount >= 1) {
      confetti({
        particleCount: 30 + matchCount * 20,
        spread: 50,
        origin: { y: 0.6 },
        colors: ['#ec4899', '#f9a8d4']
      })
    } else {
      confetti({
        particleCount: 20,
        spread: 30,
        origin: { y: 0.6 },
        colors: ['#9ca3af', '#d1d5db'],
        gravity: 1.5
      })
    }

    setPrevCheckedLines(prev => ({
      ...prev,
      [lineIdx]: { matchCount, matchedNums, matchedBonus, rank }
    }))
  }

  // 이전 회차 당첨번호 확인하기 - 드럼롤 후 결과 표시
  const handleCheckPrevResult = async () => {
    if (!prevDraw || !prevDraw.has_data) return

    setPrevIsDrumRolling(true)

    // 드럼롤 동안 작은 폭죽들 터뜨리기
    const drumInterval = setInterval(() => {
      confetti({
        particleCount: 15,
        spread: 30,
        origin: { x: Math.random(), y: 0.5 },
        colors: ['#ec4899', '#f472b6', '#fbbf24'],
        gravity: 1.2,
        scalar: 0.8
      })
    }, 150)

    // 백엔드에 결과 확인 완료 기록 (비동기)
    try {
      await markResultChecked(prevDraw.draw_no)
    } catch (err) {
      console.error('Failed to mark result checked:', err)
      // 실패해도 UI는 계속 진행
    }

    // 2초 후 결과 표시
    setTimeout(() => {
      clearInterval(drumInterval)
      setPrevIsDrumRolling(false)

      const winningNumbers = prevDraw.winning_numbers || []
      const bonusNumber = prevDraw.bonus

      const results = (prevDraw.my_lines || []).map((line, idx) => {
        const nums = parseNumbers(line)
        const matchedMain = nums.filter(n => winningNumbers.includes(n))
        const matchedBonus = nums.includes(bonusNumber)
        const matchCount = matchedMain.length

        let rank = null
        if (matchCount === 6) rank = 1
        else if (matchCount === 5 && matchedBonus) rank = 2
        else if (matchCount === 5) rank = 3
        else if (matchCount === 4) rank = 4
        else if (matchCount === 3) rank = 5

        return {
          lineNo: idx + 1,
          numbers: nums,
          matchedMain,
          matchedBonus,
          matchCount,
          rank
        }
      })

      setPrevMatchResults(results)
      setPrevChecked(true)

      // 결과 발표 시 폭죽
      const hasWin = results.some(r => r.rank !== null)
      if (hasWin) {
        confetti({
          particleCount: 200,
          spread: 120,
          origin: { y: 0.5 },
          colors: ['#ec4899', '#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#a855f7']
        })
        setTimeout(() => {
          confetti({ particleCount: 100, angle: 60, spread: 80, origin: { x: 0 } })
          confetti({ particleCount: 100, angle: 120, spread: 80, origin: { x: 1 } })
        }, 300)
      } else {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#9ca3af', '#d1d5db', '#f9a8d4']
        })
      }
    }, 2000)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [linesData, latestData, freeStatusData] = await Promise.all([
        fetchMyPageLines(),
        fetchLatestDraw(),
        getFreeRecommendStatus(),
      ])
      setLines(linesData?.items || [])
      if (linesData?.target_draw_no) setTargetDrawNo(linesData.target_draw_no)
      if (latestData) setLatestDraw(latestData)
      if (freeStatusData) setFreeStatus(freeStatusData)

      // 이전 회차 데이터 설정
      if (linesData?.previous_draw) {
        setPrevDraw(linesData.previous_draw)
        // 이미 백엔드에서 매칭된 결과가 있으면 데이터만 저장 (UI는 사용자가 확인 버튼 클릭 시 표시)
        if (linesData.previous_draw.match_results?.line_results) {
          setPrevMatchResults(linesData.previous_draw.match_results.line_results.map((r, idx) => ({
            lineNo: idx + 1,
            numbers: linesData.previous_draw.my_lines?.[idx] || [],
            matchedMain: r.matched_numbers || [],
            matchedBonus: r.bonus_match || false,
            matchCount: r.match_count || 0,
            rank: r.rank,
          })))
        }
      }

      // 유료 플랜이면 풀 상태도 로드
      const tier = user?.tier || 'FREE'
      if (tier !== 'FREE') {
        try {
          const poolData = await getPoolStatus()
          if (poolData) setPoolStatus(poolData)
        } catch {
          // 풀이 아직 없는 경우 무시
          console.log('풀 상태 없음 (최초 요청 전)')
        }
      }
    } catch (error) {
      // API 실패시 빈 배열 유지 (mock 데이터 사용 안함)
      if (error?.status !== 401) {
        console.error('데이터 로드 실패:', error)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // URL의 tab 파라미터가 변경되면 activeTab 업데이트
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['lines', 'account', 'subscription', 'notifications'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const tabs = [
    { id: 'lines', label: '내 조합', icon: '🎯' },
    { id: 'account', label: '계정 설정', icon: '👤' },
    { id: 'subscription', label: '플랜 관리', icon: '💳' },
    { id: 'notifications', label: '알림 설정', icon: '🔔' },
  ]

  // API에서 받아온 무료 추천 상태 사용
  const weeklyUsage = {
    used: freeStatus.weekly_used,
    max: freeStatus.weekly_limit,
    remaining: freeStatus.remaining,
    isFirstWeek: freeStatus.is_first_week,
  }

  const renderLinesTab = () => {
    // FREE 유저는 freeStatus.lines 사용, 유료 유저는 poolStatus.revealed_lines 또는 lines 사용
    const displayLines = isFree
      ? (freeStatus.lines || [])
      : (poolStatus.revealed_lines?.length > 0 ? poolStatus.revealed_lines : lines)

    return (
      <div className="mypage-lines">
        {/* 이번 주 무료 혜택 카드 */}
        {isFree && (
          <div className="mypage-lines__benefit">
            <div className="mypage-lines__benefit-header">
              <span className="mypage-lines__benefit-icon">🎁</span>
              <h3>이번 주 무료 혜택</h3>
            </div>
            <div className="mypage-lines__benefit-status">
              <span className="mypage-lines__benefit-count">
                {weeklyUsage.used}/{weeklyUsage.max}줄
              </span>
              <span className="mypage-lines__benefit-label">받음</span>
            </div>
            {weeklyUsage.remaining > 0 ? (
              <Link to="/recommend" className="btn btn--primary btn--sm">
                무료 1줄 받기
              </Link>
            ) : (
              <p className="mypage-lines__benefit-note">
                {weeklyUsage.isFirstWeek
                  ? '다음 회차부터는 매주 1줄씩 받을 수 있습니다.'
                  : '이번 주 무료 추천을 모두 사용했습니다.'}
              </p>
            )}
            <Link to="/pricing" className="mypage-lines__benefit-upgrade">
              더 많은 조합이 필요하다면? 업그레이드하기 →
            </Link>
          </div>
        )}

        {/* 현재 회차 카드 */}
        <div className="mypage-lines__card">
          <div
            className="mypage-lines__card-header"
            onClick={() => setCurrentExpanded(!currentExpanded)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setCurrentExpanded(!currentExpanded)}
          >
            <h3>🎯 {targetDrawNo || (latestDraw.draw_no + 1)}회 AI 추천 번호</h3>
            <div className="mypage-lines__card-actions">
              {displayLines.length > 0 && (
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={(e) => { e.stopPropagation(); handleSaveLines(); }}
                  type="button"
                >
                  저장
                </button>
              )}
              <span className={`mypage-lines__card-toggle ${currentExpanded ? 'expanded' : ''}`}>
                {currentExpanded ? '▲' : '▼'}
              </span>
            </div>
          </div>

          {currentExpanded && (
            <div className="mypage-lines__card-content">
              {saveMessage && <p className="mypage-lines__save-message">{saveMessage}</p>}

              {loading ? (
                <div className="mypage-lines__loading">
                  <span className="spinner" />
                  로딩 중...
                </div>
              ) : displayLines.length === 0 ? (
                <div className="mypage-lines__empty">
                  <p>{targetDrawNo || (latestDraw.draw_no + 1)}회 번호를 아직 받지 않았습니다.</p>
                  <Link to="/recommend" className="btn btn--primary">
                    AI 추천 받기
                  </Link>
                  {prevDraw?.has_data && (
                    <p className="mypage-lines__empty-hint">
                      아래에서 {prevDraw.draw_no}회 결과를 확인할 수 있습니다 ↓
                    </p>
                  )}
                </div>
              ) : (
            <>
              <div className="mypage-lines__items">
                {displayLines.map((line, idx) => {
                  const nums = parseNumbers(line)
                  const isDrawComplete = targetDrawNo && targetDrawNo <= latestDraw.draw_no
                  const lineResult = checkedLines[idx]

                  return (
                    <div key={idx} className={`mypage-lines__item ${lineResult?.rank ? 'mypage-lines__item--win' : ''}`}>
                      <span className="mypage-lines__item-label">{idx + 1}줄</span>
                      <div className="mypage-lines__item-numbers">
                        {nums.map((num) => (
                          <LottoBall
                            key={num}
                            num={num}
                            isMatch={lineResult?.matchedNums?.includes(num)}
                          />
                        ))}
                      </div>
                      {isDrawComplete ? (
                        lineResult ? (
                          <span className={`mypage-lines__item-result ${lineResult.matchCount >= 3 ? 'mypage-lines__item-result--win' : ''}`}>
                            {lineResult.matchCount}개 일치
                            {lineResult.matchedBonus && ' +보너스'}
                            {lineResult.rank && ` (${lineResult.rank}등!)`}
                          </span>
                        ) : (
                          <button
                            className="mypage-lines__item-check-btn"
                            onClick={() => handleCheckLine(idx, nums)}
                            type="button"
                          >
                            확인
                          </button>
                        )
                      ) : (
                        <span className="mypage-lines__item-status">추첨 대기</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 당첨번호 확인 버튼 */}
              <div className="mypage-lines__reveal">
                {(() => {
                  const displayDrawNo = targetDrawNo || (latestDraw.draw_no + 1)
                  const isDrawComplete = targetDrawNo && targetDrawNo <= latestDraw.draw_no

                  // 추첨 완료 + 결과 표시 중
                  if (isDrawComplete && showMatchResult) {
                    return (
                      <div className="mypage-lines__match-result">
                        <h4>🎉 {displayDrawNo}회 당첨번호</h4>
                        <div className="mypage-lines__result-numbers">
                          {latestDraw.numbers?.map((num) => (
                            <LottoBall key={num} num={num} />
                          ))}
                          <span className="mypage-lines__result-bonus">+</span>
                          <LottoBall num={latestDraw.bonus} isBonus />
                        </div>

                        <div className="mypage-lines__match-list">
                          {matchResults.map((result) => (
                            <div
                              key={result.lineNo}
                              className={`mypage-lines__match-item ${result.rank ? 'mypage-lines__match-item--win' : ''}`}
                            >
                              <span className="mypage-lines__match-label">{result.lineNo}줄</span>
                              <div className="mypage-lines__match-numbers">
                                {result.numbers.map((num) => (
                                  <LottoBall
                                    key={num}
                                    num={num}
                                    isMatch={result.matchedMain.includes(num)}
                                  />
                                ))}
                              </div>
                              <span className="mypage-lines__match-count">
                                {result.matchCount}개 일치
                                {result.matchedBonus && ' +보너스'}
                                {result.rank && ` (${result.rank}등!)`}
                              </span>
                            </div>
                          ))}
                        </div>

                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => setShowMatchResult(false)}
                          type="button"
                        >
                          닫기
                        </button>
                      </div>
                    )
                  }

                  // 드럼롤 중
                  if (isDrumRolling) {
                    return (
                      <div className="mypage-lines__drumroll">
                        <div className="mypage-lines__drumroll-text">
                          🥁 두구두구두구...
                        </div>
                        <div className="mypage-lines__drumroll-bar">
                          <div className="mypage-lines__drumroll-progress" />
                        </div>
                      </div>
                    )
                  }

                  // 추첨 완료 - 확인 버튼 표시
                  if (isDrawComplete) {
                    return (
                      <button
                        className="mypage-lines__reveal-btn"
                        onClick={handleCheckResult}
                        type="button"
                      >
                        🎰 {displayDrawNo}회 당첨번호 확인하기
                      </button>
                    )
                  }

                  // 추첨 대기 중
                  if (!showWaitMessage) {
                    return (
                      <button
                        className="mypage-lines__reveal-btn"
                        onClick={() => setShowWaitMessage(true)}
                        type="button"
                      >
                        🎰 {displayDrawNo}회 당첨번호 확인하기
                      </button>
                    )
                  }

                  return (
                    <div className="mypage-lines__wait-message">
                      <p>📅 {displayDrawNo}회 추첨일까지 기다려주세요</p>
                      <button
                        className="mypage-lines__hide-btn"
                        onClick={() => setShowWaitMessage(false)}
                        type="button"
                      >
                        확인
                      </button>
                    </div>
                  )
                })()}
              </div>
            </>
              )}
            </div>
          )}
        </div>

        {/* 이전 회차 결과 확인 카드 */}
        {prevDraw && prevDraw.has_data && (
          <div className="mypage-lines__card mypage-lines__card--prev">
            <div
              className="mypage-lines__card-header"
              onClick={() => setPrevExpanded(!prevExpanded)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setPrevExpanded(!prevExpanded)}
            >
              <h3>🏆 {prevDraw.draw_no}회 결과 확인</h3>
              <div className="mypage-lines__card-actions">
                <span className="mypage-lines__card-badge">
                  {prevDraw.my_lines?.length || 0}줄
                </span>
                <span className={`mypage-lines__card-toggle ${prevExpanded ? 'expanded' : ''}`}>
                  {prevExpanded ? '▲' : '▼'}
                </span>
              </div>
            </div>

            {prevExpanded && (
              <div className="mypage-lines__card-content">
                {/* 드럼롤 중 */}
                {prevIsDrumRolling && (
                  <div className="mypage-lines__drumroll">
                    <div className="mypage-lines__drumroll-text">🥁 두구두구두구...</div>
                    <div className="mypage-lines__drumroll-bar">
                      <div className="mypage-lines__drumroll-progress" />
                    </div>
                  </div>
                )}

                {/* 결과 확인 전 - 내 번호 + 개별 확인 버튼 */}
                {!prevChecked && !prevIsDrumRolling && (
                  <>
                    {/* 내 번호 리스트 (개별 확인 가능) */}
                    <div className="mypage-lines__items">
                      {(prevDraw.my_lines || []).map((line, idx) => {
                        const nums = parseNumbers(line)
                        const lineResult = prevCheckedLines[idx]

                        return (
                          <div key={idx} className={`mypage-lines__item ${lineResult?.rank ? 'mypage-lines__item--win' : ''}`}>
                            <span className="mypage-lines__item-label">{idx + 1}줄</span>
                            <div className="mypage-lines__item-numbers">
                              {nums.map((num) => (
                                <LottoBall
                                  key={num}
                                  num={num}
                                  isMatch={lineResult?.matchedNums?.includes(num)}
                                />
                              ))}
                            </div>
                            {lineResult ? (
                              <span className={`mypage-lines__item-result ${lineResult.matchCount >= 3 ? 'mypage-lines__item-result--win' : ''}`}>
                                {lineResult.matchCount}개 일치
                                {lineResult.matchedBonus && ' +보너스'}
                                {lineResult.rank && ` (${lineResult.rank}등!)`}
                              </span>
                            ) : (
                              <button
                                className="mypage-lines__item-check-btn"
                                onClick={() => handleCheckPrevLine(idx, nums)}
                                type="button"
                              >
                                확인
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* 전체 확인 버튼 */}
                    <div className="mypage-lines__reveal">
                      <button
                        className="mypage-lines__reveal-btn"
                        onClick={handleCheckPrevResult}
                        type="button"
                      >
                        🎰 {prevDraw.draw_no}회 전체 결과 확인하기
                      </button>
                    </div>
                  </>
                )}

                {/* 결과 확인 후 - 매칭 결과 표시 */}
                {prevChecked && !prevIsDrumRolling && (
                  <div className="mypage-lines__previous-result">
                    {/* 당첨번호 표시 */}
                    <div className="mypage-lines__result-winning">
                      <span className="mypage-lines__result-label">당첨번호</span>
                      <div className="mypage-lines__result-numbers">
                        {prevDraw.winning_numbers?.map((num) => (
                          <LottoBall key={num} num={num} />
                        ))}
                        <span className="mypage-lines__result-bonus">+</span>
                        <LottoBall num={prevDraw.bonus} isBonus />
                      </div>
                    </div>

                    {/* 내 번호 매칭 결과 */}
                    <div className="mypage-lines__match-list">
                      {prevMatchResults.map((result) => (
                        <div
                          key={result.lineNo}
                          className={`mypage-lines__match-item ${result.rank ? 'mypage-lines__match-item--win' : ''}`}
                        >
                          <span className="mypage-lines__match-label">{result.lineNo}줄</span>
                          <div className="mypage-lines__match-numbers">
                            {parseNumbers(result.numbers).map((num) => (
                              <LottoBall
                                key={num}
                                num={num}
                                isMatch={result.matchedMain.includes(num)}
                              />
                            ))}
                          </div>
                          <span className={`mypage-lines__match-count ${result.rank ? 'mypage-lines__match-count--win' : ''}`}>
                            {result.matchCount}개 일치
                            {result.matchedBonus && ' +보너스'}
                            {result.rank && ` (${result.rank}등!)`}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* 다시 확인 버튼 */}
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => setPrevChecked(false)}
                      type="button"
                    >
                      다시 확인하기
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 히스토리 링크 */}
        <div className="mypage-lines__history-link">
          <Link to="/history">전체 히스토리 보기 →</Link>
        </div>
      </div>
    )
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    try {
      const date = new Date(dateStr)
      return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
    } catch {
      return '-'
    }
  }

  // 닉네임 저장 핸들러
  const handleSaveNickname = async () => {
    setNicknameError('')
    const nickname = nicknameInput.trim()

    if (nickname && nickname.length > 20) {
      setNicknameError('닉네임은 20자 이내로 입력해주세요.')
      return
    }

    setNicknameLoading(true)
    try {
      const { updateNickname } = await import('../../api/authApi.js')
      const result = await updateNickname(nickname)
      if (result.success) {
        // AuthContext 업데이트
        setUser({ ...user, nickname: result.nickname })
        setIsEditingNickname(false)
      }
    } catch (err) {
      console.error('Failed to update nickname:', err)
      setNicknameError('닉네임 저장에 실패했습니다.')
    } finally {
      setNicknameLoading(false)
    }
  }

  // 소셜 로그인 여부 확인 (identifier가 없으면 소셜 로그인)
  const isSocialLogin = !user?.identifier

  const renderAccountTab = () => (
    <div className="mypage-account">
      <div className="mypage-account__section">
        <h3>계정 정보</h3>

        {/* 닉네임 설정 */}
        <div className="mypage-account__field mypage-account__field--editable">
          <label>닉네임</label>
          {isEditingNickname ? (
            <div className="mypage-account__edit-row">
              <input
                type="text"
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="닉네임을 입력하세요"
                maxLength={20}
                className="mypage-account__input"
              />
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={handleSaveNickname}
                disabled={nicknameLoading}
              >
                {nicknameLoading ? '저장 중...' : '저장'}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setIsEditingNickname(false)
                  setNicknameInput(user?.nickname || '')
                  setNicknameError('')
                }}
              >
                취소
              </button>
            </div>
          ) : (
            <div className="mypage-account__value-row">
              <span>{user?.nickname || '설정 안됨'}</span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setIsEditingNickname(true)
                  setNicknameInput(user?.nickname || '')
                }}
              >
                {user?.nickname ? '변경' : '설정'}
              </button>
            </div>
          )}
          {nicknameError && <p className="mypage-account__error">{nicknameError}</p>}
        </div>

        {isSocialLogin ? (
          <>
            <div className="mypage-account__field">
              <label>이름</label>
              <span>{user?.name || '-'}</span>
            </div>
            <div className="mypage-account__field">
              <label>연락처</label>
              <span>{user?.phone_number || '-'}</span>
            </div>
            <div className="mypage-account__field">
              <label>로그인 방식</label>
              <span>소셜 로그인 (네이버/카카오)</span>
            </div>
          </>
        ) : (
          <div className="mypage-account__field">
            <label>아이디</label>
            <span>{user?.identifier}</span>
          </div>
        )}
        <div className="mypage-account__field">
          <label>가입일</label>
          <span>{formatDate(user?.created_at)}</span>
        </div>
      </div>

      {!isSocialLogin && (
        <div className="mypage-account__section">
          <h3>비밀번호 변경</h3>
          <p className="mypage-account__desc">
            보안을 위해 주기적으로 비밀번호를 변경해주세요.
          </p>
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => {
              setShowPasswordModal(true)
              setPasswordError('')
              setCurrentPassword('')
              setNewPassword('')
              setConfirmNewPassword('')
            }}
          >
            비밀번호 변경
          </button>
        </div>
      )}

      <div className="mypage-account__section mypage-account__section--danger">
        <h3>계정 삭제</h3>
        <p className="mypage-account__desc">
          계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다.
        </p>
        <button
          className="btn btn--danger"
          type="button"
          onClick={() => {
            setShowDeleteModal(true)
            setDeleteError('')
            setDeletePassword('')
            setDeleteConfirm(false)
          }}
        >
          계정 삭제
        </button>
      </div>

      {/* 비밀번호 변경 모달 */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>비밀번호 변경</h3>
            <div className="modal-form">
              <div className="modal-field">
                <label>현재 비밀번호</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="현재 비밀번호 입력"
                />
              </div>
              <div className="modal-field">
                <label>새 비밀번호</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호 (6자 이상)"
                />
              </div>
              <div className="modal-field">
                <label>새 비밀번호 확인</label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="새 비밀번호 다시 입력"
                />
              </div>
              {passwordError && <p className="modal-error">{passwordError}</p>}
              <div className="modal-buttons">
                <button
                  className="btn btn--ghost"
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={passwordLoading}
                >
                  취소
                </button>
                <button
                  className="btn btn--primary"
                  type="button"
                  onClick={handlePasswordChange}
                  disabled={passwordLoading}
                >
                  {passwordLoading ? '변경 중...' : '변경하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 계정 삭제 모달 */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content modal-content--danger" onClick={(e) => e.stopPropagation()}>
            <h3>계정 삭제</h3>
            <p className="modal-warning">
              정말 계정을 삭제하시겠습니까?<br />
              모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.
            </p>
            <div className="modal-form">
              {!isSocialLogin && (
                <div className="modal-field">
                  <label>비밀번호 확인</label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="비밀번호 입력"
                  />
                </div>
              )}
              <label className="modal-checkbox">
                <input
                  type="checkbox"
                  checked={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.checked)}
                />
                <span>위 내용을 확인했으며, 계정 삭제에 동의합니다.</span>
              </label>
              {deleteError && <p className="modal-error">{deleteError}</p>}
              <div className="modal-buttons">
                <button
                  className="btn btn--ghost"
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleteLoading}
                >
                  취소
                </button>
                <button
                  className="btn btn--danger"
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? '삭제 중...' : '계정 삭제'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderSubscriptionTab = () => {
    const tierFeatures = {
      FREE: ['매주 AI 추천 (1줄)', '가입 첫 회차 보너스 +1줄', '기본 통계 조회', '히스토리 14일 보관'],
      BASIC: ['매주 AI 추천 (5줄)', '상세 통계 및 분석', '히스토리 무제한 보관', '번호 제외 설정'],
      PREMIUM: ['매주 AI 추천 (10줄)', 'AI 핵심 조합 1줄 포함', '고급 패턴 분석', '히스토리 무제한 보관', '번호 제외/고정 설정'],
      VIP: ['매주 AI 추천 (20줄)', 'AI 핵심 조합 2줄 포함', '풀커버리지 분석', '우선 고객 지원', '히스토리 무제한 보관', '번호 제외/고정 설정'],
    }

    // 다음 업그레이드 플랜 계산
    const getNextPlan = () => {
      switch (userTier) {
        case 'FREE': return { id: 'basic', name: 'Basic' }
        case 'BASIC': return { id: 'premium', name: 'Premium' }
        case 'PREMIUM': return { id: 'vip', name: 'VIP' }
        default: return null // VIP는 최고 플랜
      }
    }

    const nextPlan = getNextPlan()

    return (
      <div className="mypage-subscription">
        <div className="mypage-subscription__current">
          <div className="mypage-subscription__badge">현재 플랜</div>
          <h3>{userTier}</h3>
          <p>{isFree ? '무료 플랜' : `${userTier} 플랜`}</p>
          <ul>
            {tierFeatures[userTier]?.map((feature, idx) => (
              <li key={idx}>✓ {feature}</li>
            ))}
          </ul>
          {nextPlan && (
            <Link to={`/checkout?plan=${nextPlan.id}`} className="btn btn--primary btn--full">
              {nextPlan.name}으로 업그레이드
            </Link>
          )}
        </div>

        <div className="mypage-subscription__history">
          <h3>결제 내역</h3>
          <div className="mypage-subscription__empty">
            결제 내역이 없습니다.
          </div>
        </div>
      </div>
    )
  }

  // 푸시 알림 구독/해제 핸들러
  const handlePushSubscribe = async () => {
    const result = await subscribePush()
    if (result) {
      success('푸시 알림이 활성화되었습니다.', '알림 설정')
    } else if (pushPermission === 'denied') {
      info('브라우저 설정에서 알림 권한을 허용해주세요.', '알림 권한 필요')
    }
  }

  const handlePushUnsubscribe = async () => {
    const result = await unsubscribePushNotification()
    if (result) {
      info('푸시 알림이 비활성화되었습니다.', '알림 설정')
    }
  }

  const handleNotificationChange = async (key, value) => {
    const result = await togglePushSetting(key)
    if (result) {
      info(value ? '알림이 활성화되었습니다.' : '알림이 비활성화되었습니다.', '알림 설정')
    }
  }

  // 비밀번호 변경 핸들러
  const handlePasswordChange = async () => {
    setPasswordError('')

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('모든 필드를 입력해주세요.')
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('새 비밀번호는 6자 이상이어야 합니다.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('새 비밀번호가 일치하지 않습니다.')
      return
    }

    setPasswordLoading(true)
    try {
      const result = await changePassword(currentPassword, newPassword)
      if (result.success) {
        success('비밀번호가 변경되었습니다.', '비밀번호 변경')
        setShowPasswordModal(false)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmNewPassword('')
      } else {
        setPasswordError(result.message || '비밀번호 변경에 실패했습니다.')
      }
    } catch (err) {
      setPasswordError(err?.message || '비밀번호 변경 중 오류가 발생했습니다.')
    } finally {
      setPasswordLoading(false)
    }
  }

  // 계정 삭제 핸들러
  const handleDeleteAccount = async () => {
    setDeleteError('')

    if (!deleteConfirm) {
      setDeleteError('계정 삭제에 동의해주세요.')
      return
    }

    const isSocialLogin = user?.identifier?.startsWith('kakao_') || user?.identifier?.startsWith('naver_')

    if (!isSocialLogin && !deletePassword) {
      setDeleteError('비밀번호를 입력해주세요.')
      return
    }

    setDeleteLoading(true)
    try {
      const result = await deleteAccount(isSocialLogin ? null : deletePassword, true)
      if (result.success) {
        success('계정이 삭제되었습니다.', '계정 삭제')
        logout()
        navigate('/', { replace: true })
      } else {
        setDeleteError(result.message || '계정 삭제에 실패했습니다.')
      }
    } catch (err) {
      setDeleteError(err?.message || '계정 삭제 중 오류가 발생했습니다.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const renderNotificationsTab = () => (
    <div className="mypage-notifications">
      {/* 푸시 알림 활성화 섹션 */}
      <div className="mypage-notifications__section">
        <h3>푸시 알림</h3>

        {!isPushSupported ? (
          <div className="mypage-notifications__warning">
            <span className="mypage-notifications__warning-icon">⚠️</span>
            <p>이 브라우저는 푸시 알림을 지원하지 않습니다.</p>
          </div>
        ) : pushPermission === 'denied' ? (
          <div className="mypage-notifications__warning">
            <span className="mypage-notifications__warning-icon">🚫</span>
            <div>
              <p>알림 권한이 차단되어 있습니다.</p>
              <p className="mypage-notifications__hint">브라우저 설정에서 이 사이트의 알림을 허용해주세요.</p>
            </div>
          </div>
        ) : !isPushSubscribed ? (
          <div className="mypage-notifications__activate">
            <div className="mypage-notifications__activate-info">
              <span className="mypage-notifications__activate-icon">🔔</span>
              <div>
                <strong>푸시 알림 받기</strong>
                <p>새 회차 당첨번호 발표, 추천 번호 알림 등을 받으실 수 있습니다.</p>
              </div>
            </div>
            <button
              className="mypage-notifications__activate-btn"
              onClick={handlePushSubscribe}
              disabled={isPushLoading}
            >
              {isPushLoading ? '처리 중...' : '알림 켜기'}
            </button>
          </div>
        ) : (
          <div className="mypage-notifications__status">
            <span className="mypage-notifications__status-icon">✅</span>
            <span>푸시 알림이 활성화되어 있습니다.</span>
            <button
              className="mypage-notifications__deactivate-btn"
              onClick={handlePushUnsubscribe}
              disabled={isPushLoading}
            >
              끄기
            </button>
          </div>
        )}

        {pushError && (
          <div className="mypage-notifications__error">
            <span>❌</span> {pushError}
          </div>
        )}
      </div>

      {/* 알림 종류 설정 (구독 중일 때만 표시) */}
      {isPushSubscribed && (
        <div className="mypage-notifications__section">
          <h3>알림 종류 설정</h3>
          <div className="mypage-notifications__item">
            <div>
              <strong>당첨 결과 알림</strong>
              <p>매주 토요일 새 회차 당첨번호가 발표되면 알려드립니다.</p>
            </div>
            <label className="mypage-notifications__toggle">
              <input
                type="checkbox"
                checked={pushSettings.notify_draw_result}
                onChange={(e) => handleNotificationChange('notify_draw_result', e.target.checked)}
                disabled={isPushLoading}
              />
              <span className="mypage-notifications__slider" />
            </label>
          </div>
          <div className="mypage-notifications__item">
            <div>
              <strong>추천 번호 알림</strong>
              <p>새로운 AI 추천 번호가 생성되면 알림을 받습니다.</p>
            </div>
            <label className="mypage-notifications__toggle">
              <input
                type="checkbox"
                checked={pushSettings.notify_recommendation}
                onChange={(e) => handleNotificationChange('notify_recommendation', e.target.checked)}
                disabled={isPushLoading}
              />
              <span className="mypage-notifications__slider" />
            </label>
          </div>
          <div className="mypage-notifications__item">
            <div>
              <strong>구독 만료 알림</strong>
              <p>유료 플랜 만료 7일 전에 알림을 받습니다.</p>
            </div>
            <label className="mypage-notifications__toggle">
              <input
                type="checkbox"
                checked={pushSettings.notify_subscription_expiry}
                onChange={(e) => handleNotificationChange('notify_subscription_expiry', e.target.checked)}
                disabled={isPushLoading}
              />
              <span className="mypage-notifications__slider" />
            </label>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="page mypage-page">
      {/* Hero */}
      <section className="mypage-hero">
        <div className="mypage-hero__inner">
          <div className="mypage-hero__avatar">
            {(user?.nickname || user?.name || user?.identifier || '?').charAt(0).toUpperCase()}
          </div>
          <div className="mypage-hero__info">
            <h1>{user?.nickname || user?.name || user?.identifier || '회원'}님</h1>
            <div className="mypage-hero__plan">
              <span className="mypage-hero__plan-badge">{userTier}</span>
              <span>{isFree ? '무료 플랜 이용 중' : `${userTier} 플랜 이용 중`}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="mypage-content">
        <div className="mypage-content__inner">
          {/* Sidebar */}
          <aside className="mypage-sidebar">
            <nav className="mypage-sidebar__nav">
              {/* 번호받기 링크 */}
              <Link to="/recommend" className="mypage-sidebar__item mypage-sidebar__item--primary">
                <span className="mypage-sidebar__icon">⚡</span>
                <span>번호 받기</span>
              </Link>

              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`mypage-sidebar__item ${activeTab === tab.id ? 'mypage-sidebar__item--active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="mypage-sidebar__icon">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Main */}
          <main className="mypage-main">
            {activeTab === 'lines' && renderLinesTab()}
            {activeTab === 'account' && renderAccountTab()}
            {activeTab === 'subscription' && renderSubscriptionTab()}
            {activeTab === 'notifications' && renderNotificationsTab()}
          </main>
        </div>
      </section>
    </div>
  )
}

export default MyPage
