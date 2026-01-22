import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNotification } from '../../context/NotificationContext.jsx'
import {
  requestFreeRecommendation,
  getFreeRecommendStatus,
  fetchMyPageLines,
  requestOneLine,
  requestAllLines,
  getPoolStatus,
  getFixedCandidates,
  requestOneLineAdvanced,
  requestAllLinesAdvanced,
} from '../../api/lottoApi.js'
import LottoBall from '../../components/LottoBall.jsx'
import { parseNumbers } from '../../utils/lottoUtils.js'
import { downloadLottoNumbers } from '../../utils/download.js'

// 티어별 줄 수 설정
const TIER_LINES = {
  FREE: 1,
  BASIC: 5,
  PREMIUM: 10,
  VIP: 20,
}

// 티어별 기능 잠금
const TIER_FEATURES = {
  FREE: {
    excludeNumbers: false,
    fixedNumbers: false,
    maxExclude: 0,
    maxFixed: 0,
    advancedStats: false,
    simulation: false,
  },
  BASIC: {
    excludeNumbers: true,   // BASIC은 제외만 가능
    fixedNumbers: false,    // BASIC은 고정 불가
    maxExclude: 2,
    maxFixed: 0,
    advancedStats: true,
    simulation: true,
  },
  PREMIUM: {
    excludeNumbers: true,
    fixedNumbers: true,
    maxExclude: 2,  // PREMIUM: 제외 최대 2개
    maxFixed: 2,    // PREMIUM: 고정 최대 2개
    advancedStats: true,
    simulation: true,
  },
  VIP: {
    excludeNumbers: true,
    fixedNumbers: true,
    maxExclude: 3,  // VIP: 제외 최대 3개
    maxFixed: 3,    // VIP: 고정 최대 3개
    advancedStats: true,
    simulation: true,
  },
}

// 배열 비교 헬퍼 (정렬 후 비교)
function arraysEqual(a, b) {
  if (!a && !b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false
  const sortedA = [...a].sort((x, y) => x - y)
  const sortedB = [...b].sort((x, y) => x - y)
  return sortedA.every((val, idx) => val === sortedB[idx])
}

function Recommend() {
  const { isAuthed, user } = useAuth()
  const { success, error: showError } = useNotification()
  const [loading, setLoading] = useState(false)
  const [lines, setLines] = useState([])
  const [error, setError] = useState('')
  const [freeStatus, setFreeStatus] = useState({ weekly_used: 0, weekly_limit: 1, remaining: 1, is_first_week: false, lines: [] })

  // 풀 시스템 상태 (BASIC/PREMIUM/VIP용) - DB와 동기화되는 Single Source of Truth
  const [poolStatus, setPoolStatus] = useState({
    pool_exists: false,
    pool_total: 0,
    revealed_count: 0,
    revealed_lines: [],
    all_revealed: false,
    settings: { exclude: [], fixed: [] },  // DB에 저장된 설정
    target_draw_no: null,  // 대상 회차
  })

  // 로컬 설정 (사용자가 UI에서 선택한 값)
  const [excludeNumbers, setExcludeNumbers] = useState([])
  const [fixedNumbers, setFixedNumbers] = useState([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loadingCandidates, setLoadingCandidates] = useState(false)

  // 초기 로드 완료 여부 (설정 변경 감지용)
  const initialLoadDone = useRef(false)

  // 티어 기반 설정
  const userTier = user?.tier || 'FREE'
  const lineCount = TIER_LINES[userTier] || 1
  const features = TIER_FEATURES[userTier] || TIER_FEATURES.FREE
  const isFree = userTier === 'FREE'

  // 로컬 설정과 DB 설정이 다른지 확인
  const settingsChanged = poolStatus.pool_exists && (
    !arraysEqual(excludeNumbers, poolStatus.settings?.exclude) ||
    !arraysEqual(fixedNumbers, poolStatus.settings?.fixed)
  )

  // 고급 설정 사용 여부 (로컬 기준)
  const hasAdvancedSettings = excludeNumbers.length > 0 || fixedNumbers.length > 0

  // 페이지 로드시 기존 번호 로드
  useEffect(() => {
    if (isAuthed) {
      if (isFree) {
        loadFreeStatus()
      } else {
        loadPaidStatus()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, isFree])

  const loadFreeStatus = async () => {
    try {
      const status = await getFreeRecommendStatus()
      setFreeStatus(status)
      if (status.lines && status.lines.length > 0) {
        setLines(status.lines)
      }
      setError('')
    } catch (err) {
      console.error('무료 추천 상태 로드 실패:', err)
      if (err.message === 'Failed to fetch') {
        setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.')
      }
    }
  }

  const loadPaidStatus = useCallback(async () => {
    try {
      const poolData = await getPoolStatus()
      console.log('[동기화] DB 상태 로드:', poolData)

      if (poolData) {
        setPoolStatus(poolData)

        // 공개된 번호가 있으면 표시
        if (poolData.revealed_lines && poolData.revealed_lines.length > 0) {
          setLines(poolData.revealed_lines)
        } else {
          const issuedLines = await fetchMyPageLines()
          if (issuedLines?.items?.length > 0) {
            setLines(issuedLines.items)
          }
        }

        // 초기 로드시에만 DB 설정을 로컬에 반영
        if (!initialLoadDone.current) {
          const dbSettings = poolData.settings || { exclude: [], fixed: [] }
          setExcludeNumbers(dbSettings.exclude || [])
          setFixedNumbers(dbSettings.fixed || [])
          initialLoadDone.current = true
          console.log('[동기화] 초기 설정 반영:', dbSettings)
        }
      }
      setError('')
    } catch (err) {
      console.error('유료 추천 상태 로드 실패:', err)
      if (err.message === 'Failed to fetch') {
        setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.')
      }
    }
  }, [])

  const handleGenerate = async () => {
    if (!isAuthed) {
      setError('로그인이 필요합니다.')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (isFree) {
        if (freeStatus.remaining <= 0) {
          setError('이번 주 무료 추천 한도를 모두 사용했습니다.')
          setLoading(false)
          return
        }
        const res = await requestFreeRecommendation()
        const newLines = [...lines, res.line]
        setLines(newLines)
        setFreeStatus(prev => ({
          ...prev,
          weekly_used: res.weekly_used,
          remaining: res.weekly_limit - res.weekly_used,
          lines: newLines,
        }))
        success('AI 추천 번호가 생성되었습니다!', 'AI 추천 완료')
      } else {
        const result = hasAdvancedSettings
          ? await requestAllLinesAdvanced({ exclude: excludeNumbers, fixed: fixedNumbers })
          : await requestAllLines()

        if (result.lines) {
          setPoolStatus(prev => ({
            ...prev,
            pool_exists: true,
            pool_total: result.pool_total,
            revealed_count: result.pool_total,
            revealed_lines: result.lines,
            all_revealed: true,
            settings: result.settings || { exclude: excludeNumbers, fixed: fixedNumbers },
          }))
          setLines(result.lines)

          if (result.already_revealed) {
            success('이미 발급된 번호입니다.', '번호 확인')
          } else {
            success(`전체 ${result.pool_total}줄 받음!`, '번호 받기 완료')
          }
        } else {
          showError(result.message || '번호를 받을 수 없습니다.', '알림')
        }
      }
    } catch (err) {
      const errorMsg = err?.message === 'Failed to fetch'
        ? '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'
        : (err?.message || '추천 생성 중 오류가 발생했습니다.')
      setError(errorMsg)
      showError(errorMsg, '오류')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (lines.length === 0) return
    downloadLottoNumbers(lines)
    success('추천 번호가 저장되었습니다!', '저장 완료')
  }

  const toggleNumber = (num, type) => {
    if (type === 'exclude') {
      if (excludeNumbers.includes(num)) {
        setExcludeNumbers(excludeNumbers.filter(n => n !== num))
      } else if (excludeNumbers.length < features.maxExclude) {
        setExcludeNumbers([...excludeNumbers, num])
        setFixedNumbers(fixedNumbers.filter(n => n !== num))
      }
    } else if (type === 'fixed') {
      if (fixedNumbers.includes(num)) {
        setFixedNumbers(fixedNumbers.filter(n => n !== num))
      } else if (fixedNumbers.length < features.maxFixed) {
        setFixedNumbers([...fixedNumbers, num])
        setExcludeNumbers(excludeNumbers.filter(n => n !== num))
      }
    }
  }

  // 추천 공 받기 (PREMIUM/VIP 전용)
  const handleGetAiCandidates = async () => {
    if (!features.fixedNumbers) return
    setLoadingCandidates(true)
    try {
      const result = await getFixedCandidates()
      if (result.success && result.candidates && result.candidates.length > 0) {
        setFixedNumbers(result.candidates)
        success(`추천 공 ${result.candidates.length}개가 고정되었습니다!`, '추천 완료')
      } else {
        showError(result.message || '추천 공을 받을 수 없습니다.', '알림')
      }
    } catch (err) {
      console.error('추천 공 받기 실패:', err)
      showError(err?.message || '추천 공을 가져오는데 실패했습니다.', '오류')
    } finally {
      setLoadingCandidates(false)
    }
  }

  // 1줄씩 받기 (설정 적용)
  const handleRequestOneLine = async () => {
    if (loading) return
    setLoading(true)
    setError('')

    try {
      console.log('[요청] 1줄씩 받기:', { exclude: excludeNumbers, fixed: fixedNumbers })

      const result = hasAdvancedSettings
        ? await requestOneLineAdvanced({ exclude: excludeNumbers, fixed: fixedNumbers })
        : await requestOneLine()

      console.log('[응답] 1줄씩 받기:', result)

      // 상태 업데이트 - API 응답으로 덮어쓰기
      setPoolStatus(prev => ({
        ...prev,
        pool_exists: true,
        pool_total: result.pool_total || prev.pool_total,
        revealed_count: result.revealed_count || prev.revealed_count,
        revealed_lines: result.revealed_lines || prev.revealed_lines,
        all_revealed: result.all_revealed ?? prev.all_revealed,
        settings: result.settings || { exclude: excludeNumbers, fixed: fixedNumbers },
      }))

      if (result.revealed_lines) {
        setLines(result.revealed_lines)
      }

      if (result.success && result.line) {
        success(`${result.revealed_count}/${result.pool_total}줄 받음!`, '번호 받기 완료')
      } else if (!result.success) {
        showError(result.message || '이미 모든 번호를 받았습니다.', '알림')
      }
    } catch (err) {
      console.error('[에러] 1줄씩 받기:', err)
      const errorMsg = err?.message || '번호 받기에 실패했습니다.'
      setError(errorMsg)
      showError(errorMsg, '오류')
      // 에러 시 DB와 재동기화
      await loadPaidStatus()
    } finally {
      setLoading(false)
    }
  }

  // 전체 받기 (설정 적용)
  const handleRequestAllLines = async () => {
    if (loading) return
    setLoading(true)
    setError('')

    try {
      console.log('[요청] 전체 받기:', { exclude: excludeNumbers, fixed: fixedNumbers })

      const result = hasAdvancedSettings
        ? await requestAllLinesAdvanced({ exclude: excludeNumbers, fixed: fixedNumbers })
        : await requestAllLines()

      console.log('[응답] 전체 받기:', result)

      if (result.lines) {
        setPoolStatus(prev => ({
          ...prev,
          pool_exists: true,
          pool_total: result.pool_total,
          revealed_count: result.pool_total,
          revealed_lines: result.lines,
          all_revealed: true,
          settings: result.settings || { exclude: excludeNumbers, fixed: fixedNumbers },
        }))
        setLines(result.lines)

        if (result.already_revealed) {
          success('이미 발급된 번호입니다.', '번호 확인')
        } else {
          success(`전체 ${result.pool_total}줄 받음!`, '번호 받기 완료')
        }
      } else {
        showError(result.message || '번호를 받을 수 없습니다.', '알림')
      }
    } catch (err) {
      console.error('[에러] 전체 받기:', err)
      const errorMsg = err?.message || '번호 받기에 실패했습니다.'
      setError(errorMsg)
      showError(errorMsg, '오류')
      await loadPaidStatus()
    } finally {
      setLoading(false)
    }
  }

  // 설정 초기화 (DB 설정으로 복원)
  const handleResetSettings = () => {
    const dbSettings = poolStatus.settings || { exclude: [], fixed: [] }
    setExcludeNumbers(dbSettings.exclude || [])
    setFixedNumbers(dbSettings.fixed || [])
  }

  return (
    <div className="page recommend-page">
      <section className="recommend-hero">
        <div className="recommend-hero__inner">
          <h1>AI 번호 추천</h1>
          <p>데이터 기반 AI가 분석한 이번 주 추천 번호를 받아보세요.</p>
        </div>
      </section>

      {/* 비로그인 안내 */}
      {!isAuthed && (
        <section className="recommend-login-prompt">
          <div className="recommend-login-prompt__inner">
            <h2>로그인이 필요합니다</h2>
            <p>AI 추천 번호를 받으려면 로그인해주세요.</p>
            <div className="recommend-login-prompt__actions">
              <Link to="/login" className="btn btn--primary">로그인</Link>
              <Link to="/signup" className="btn btn--ghost">회원가입</Link>
            </div>
          </div>
        </section>
      )}

      {/* 로그인 상태 */}
      {isAuthed && (
        <>
          {/* 플랜 정보 */}
          <section className="recommend-plan-info">
            <div className="recommend-plan-info__inner">
              <div className="recommend-plan-info__card">
                <div className="recommend-plan-info__label">현재 플랜</div>
                <div className="recommend-plan-info__value">{userTier}</div>
                <div className="recommend-plan-info__desc">
                  {isFree ? (
                    <>주 1회 {freeStatus.weekly_limit}줄 추천 · {freeStatus.is_first_week ? '가입 첫 회차 2줄' : `${freeStatus.remaining}줄 남음`}</>
                  ) : (
                    <>주 1회 {lineCount}줄 추천</>
                  )}
                </div>
              </div>
              {isFree && (
                <Link to="/pricing" className="btn btn--ghost btn--sm">
                  업그레이드
                </Link>
              )}
            </div>
          </section>

          {/* 고급 설정 (번호 제외/고정) */}
          <section className="recommend-advanced">
            <div className="recommend-advanced__inner">
              <button
                className="recommend-advanced__toggle"
                onClick={() => setShowAdvanced(!showAdvanced)}
                type="button"
              >
                <span>고급 설정 (번호 제외/고정)</span>
                <svg
                  className={`recommend-advanced__arrow ${showAdvanced ? 'recommend-advanced__arrow--open' : ''}`}
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showAdvanced && (
                <div className="recommend-advanced__content">
                  {!features.excludeNumbers && (
                    <div className="recommend-advanced__notice">
                      <span className="recommend-advanced__lock">🔒</span>
                      번호 제외 기능은 Basic 플랜 이상, 고정 기능은 Premium 플랜 이상에서 사용 가능합니다.
                      <Link to="/pricing">업그레이드하기</Link>
                    </div>
                  )}

                  {/* 발급 완료 시 설정 잠금 안내 */}
                  {poolStatus.all_revealed && (
                    <div className="recommend-advanced__locked">
                      <span className="recommend-advanced__lock">🔒</span>
                      이번 회차 번호가 이미 발급되어 설정을 변경할 수 없습니다.
                      <br />다음 회차에 새로운 설정을 적용할 수 있습니다.
                    </div>
                  )}

                  {/* 설정 변경 경고 (발급 전에만 표시) */}
                  {!poolStatus.all_revealed && settingsChanged && (
                    <div className="recommend-advanced__warning">
                      <strong>⚠️ 설정이 변경되었습니다</strong>
                      <p>번호를 받으면 기존 번호가 새로운 설정으로 재생성됩니다.</p>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={handleResetSettings}
                      >
                        기존 설정으로 복원
                      </button>
                    </div>
                  )}

                  <div className="recommend-advanced__section">
                    <h4>
                      제외할 번호 <span className="recommend-advanced__count">({excludeNumbers.length}/{features.maxExclude})</span>
                    </h4>
                    <p>선택한 번호는 추천에서 제외됩니다.</p>
                    {excludeNumbers.length > 0 && !poolStatus.all_revealed && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => setExcludeNumbers([])}
                        style={{ marginBottom: '0.5rem' }}
                      >
                        제외 번호 초기화
                      </button>
                    )}
                    <div className="recommend-advanced__numbers">
                      {Array.from({ length: 45 }, (_, i) => i + 1).map(num => (
                        <button
                          key={num}
                          type="button"
                          className={`recommend-advanced__num ${excludeNumbers.includes(num) ? 'recommend-advanced__num--exclude' : ''} ${fixedNumbers.includes(num) ? 'recommend-advanced__num--disabled' : ''}`}
                          onClick={() => toggleNumber(num, 'exclude')}
                          disabled={!features.excludeNumbers || poolStatus.all_revealed || (excludeNumbers.length >= features.maxExclude && !excludeNumbers.includes(num))}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="recommend-advanced__section">
                    <h4>
                      고정할 번호 <span className="recommend-advanced__count">({fixedNumbers.length}/{features.maxFixed})</span>
                      {!features.fixedNumbers && userTier === 'BASIC' && (
                        <span className="recommend-advanced__badge">PREMIUM+</span>
                      )}
                    </h4>
                    {features.fixedNumbers ? (
                      <>
                        <p>추천 공을 받거나 직접 번호를 선택하면, 해당 번호가 포함된 조합이 생성됩니다.</p>
                        <div className="recommend-advanced__ai-action">
                          <button
                            type="button"
                            className="btn btn--primary btn--sm"
                            onClick={handleGetAiCandidates}
                            disabled={loadingCandidates || poolStatus.all_revealed}
                          >
                            {loadingCandidates ? (
                              <><span className="spinner" /> 받는 중...</>
                            ) : (
                              <>추천 공 받기 ({features.maxFixed}개)</>
                            )}
                          </button>
                          {fixedNumbers.length > 0 && !poolStatus.all_revealed && (
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => setFixedNumbers([])}
                            >
                              초기화
                            </button>
                          )}
                        </div>
                        {fixedNumbers.length > 0 && (
                          <div className="recommend-advanced__selected">
                            <span>현재 고정:</span>
                            {fixedNumbers.map(num => (
                              <LottoBall key={num} num={num} size="sm" />
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p>고정 번호 기능은 Premium 플랜 이상에서 사용 가능합니다.</p>
                    )}
                    <div className="recommend-advanced__numbers">
                      {Array.from({ length: 45 }, (_, i) => i + 1).map(num => (
                        <button
                          key={num}
                          type="button"
                          className={`recommend-advanced__num ${fixedNumbers.includes(num) ? 'recommend-advanced__num--fixed' : ''} ${excludeNumbers.includes(num) ? 'recommend-advanced__num--disabled' : ''}`}
                          onClick={() => toggleNumber(num, 'fixed')}
                          disabled={!features.fixedNumbers || poolStatus.all_revealed || (fixedNumbers.length >= features.maxFixed && !fixedNumbers.includes(num))}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 설정 요약 */}
                  {hasAdvancedSettings && (
                    <div className="recommend-advanced__summary">
                      <div className="recommend-advanced__summary-item">
                        <span>적용된 설정:</span>
                        {excludeNumbers.length > 0 && <span>제외 {excludeNumbers.length}개</span>}
                        {fixedNumbers.length > 0 && <span>고정 {fixedNumbers.length}개</span>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* 추천 생성 버튼 */}
          <section className="recommend-generate">
            <div className="recommend-generate__inner">
              {isFree ? (
                // FREE 유저: 주간 한도 체크
                freeStatus.remaining <= 0 ? (
                  <div className="recommend-generate__limit-reached">
                    <p>이번 주 무료 추천 한도({freeStatus.weekly_limit}줄)를 모두 사용했습니다.</p>
                    <Link to="/pricing" className="btn btn--primary">
                      업그레이드하고 더 많은 번호 받기
                    </Link>
                  </div>
                ) : (
                  <button
                    className="btn btn--primary btn--lg recommend-generate__btn"
                    onClick={handleGenerate}
                    disabled={loading}
                    type="button"
                  >
                    {loading ? (
                      <>
                        <span className="spinner" />
                        생성 중...
                      </>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                        AI 추천 번호 생성
                      </>
                    )}
                  </button>
                )
              ) : (
                // 유료 유저 (BASIC/PREMIUM/VIP): poolStatus.all_revealed로 발급 완료 여부 체크
                poolStatus.all_revealed ? (
                  <div className="recommend-generate__issued">
                    <div className="recommend-generate__issued-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    </div>
                    <p className="recommend-generate__issued-text">
                      {poolStatus.target_draw_no}회차 {poolStatus.pool_total}줄 발급이 완료되었습니다.
                    </p>
                    <p className="recommend-generate__issued-desc">
                      다음 회차 번호는 토요일 추첨 후 발급 가능합니다.
                    </p>
                    {settingsChanged && (
                      <p className="recommend-generate__issued-warning">
                        ⚠️ 설정을 변경하면 새로운 번호가 생성됩니다. 번호 받기 버튼을 클릭하세요.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="recommend-generate__pool-buttons">
                    {/* 진행 상태 표시 */}
                    <div className="recommend-generate__pool-status">
                      {poolStatus.pool_total > 0 ? (
                        <span className="recommend-generate__pool-count">
                          {poolStatus.revealed_count}/{poolStatus.pool_total}줄 받음
                        </span>
                      ) : (
                        <span className="recommend-generate__pool-hint">
                          {poolStatus.target_draw_no ? `${poolStatus.target_draw_no}회차` : '이번 회차'} {lineCount}줄을 받아보세요
                        </span>
                      )}
                    </div>

                    {/* 버튼 2개 */}
                    <div className="recommend-generate__btn-group">
                      <button
                        className="recommend-generate__btn recommend-generate__btn--one"
                        onClick={handleRequestOneLine}
                        disabled={loading}
                        type="button"
                      >
                        {loading ? (
                          <span className="spinner" />
                        ) : (
                          <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="16" />
                              <line x1="8" y1="12" x2="16" y2="12" />
                            </svg>
                            1줄씩 받기{hasAdvancedSettings && ' (설정 적용)'}
                          </>
                        )}
                      </button>
                      <button
                        className="recommend-generate__btn recommend-generate__btn--all"
                        onClick={handleRequestAllLines}
                        disabled={loading}
                        type="button"
                      >
                        {loading ? (
                          <span className="spinner" />
                        ) : (
                          <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                            한번에 {lineCount}줄 받기{hasAdvancedSettings && ' (설정 적용)'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              )}
              {error && <p className="recommend-generate__error">{error}</p>}
            </div>
          </section>

          {/* 결과 표시 */}
          {lines.length > 0 && (
            <section className="recommend-result">
              <div className="recommend-result__inner">
                <div className="recommend-result__header">
                  <h2>{poolStatus.target_draw_no ? `${poolStatus.target_draw_no}회` : '이번 주'} AI 추천 번호</h2>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={handleSave}
                    type="button"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    저장
                  </button>
                </div>

                <div className="recommend-result__lines">
                  {lines.map((line, idx) => {
                    const nums = parseNumbers(line)
                    return (
                      <div key={idx} className="recommend-result__line">
                        <span className="recommend-result__line-label">{idx + 1}줄</span>
                        <div className="recommend-result__line-numbers">
                          {nums.map(num => <LottoBall key={num} num={num} />)}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="recommend-result__actions">
                  <Link to="/mypage" className="btn btn--ghost">
                    내 조합 보기
                  </Link>
                  <Link to="/history" className="btn btn--ghost">
                    히스토리 확인
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* 안내 사항 */}
          <section className="recommend-notice">
            <div className="recommend-notice__inner">
              <h3>안내 사항</h3>
              <ul>
                <li>AI 추천은 과거 데이터를 기반으로 한 통계 분석 결과입니다.</li>
                <li>로또 당첨은 완전한 확률 게임이며, AI 추천이 당첨을 보장하지 않습니다.</li>
                <li>추천 번호는 매주 토요일 추첨 전까지 발급받으실 수 있습니다.</li>
                <li>문의사항은 <Link to="/support">고객센터</Link>를 이용해주세요.</li>
              </ul>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default Recommend
