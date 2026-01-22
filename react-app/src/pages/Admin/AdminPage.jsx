import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  fetchAdminDashboard,
  fetchUsers,
  updateUser,
  deleteUser,
  fetchFreeTrials,
  updateFreeTrialStatus,
  fetchPayments,
  refundPayment,
  fetchSubscriptions,
  approveSubscription,
  rejectSubscription,
  extendSubscription,
  cancelSubscription,
  sendSubscriptionNumbers,
  fetchLottoDraws,
  createLottoDraw,
  updateLottoDraw,
  deleteLottoDraw,
  rebuildLottoCache,
  fetchMLLogicAnalysis,
  fetchMLLatest,
  fetchMLTrainingLogs,
  triggerMLRetrain,
  fetchPerformanceSummary,
  fetchPerformanceByDraw,
  fetchPerformanceHistory,
  fetchMatchStatus,
  triggerMatch,
  fetchRecommendLogs,
  updateRecommendLog,
  deleteRecommendLog,
  fetchSocialAccounts,
  deleteSocialAccount,
} from '../../api/adminApi.js'
import {
  DashboardTab,
  UsersTab,
  SubscriptionsTab,
  TrialsTab,
  PaymentsTab,
  LottoTab,
  MLTab,
  PerformanceTab,
  MatchingTab,
  BacktestTab,
  TABS,
} from './components/index.js'

function AdminPage() {
  const { isAuthed, isAdmin, authLoading, user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Dashboard state
  const [dashboard, setDashboard] = useState(null)

  // Users state
  const [users, setUsers] = useState({ users: [], total: 0, page: 1, page_size: 20 })
  const [userSearch, setUserSearch] = useState('')
  const [userPlanFilter, setUserPlanFilter] = useState('')

  // Social accounts state
  const [socialAccounts, setSocialAccounts] = useState({ accounts: [], total: 0, page: 1, page_size: 20 })

  // Free trials state
  const [trials, setTrials] = useState({ trials: [], total: 0, page: 1, page_size: 20 })
  const [trialFilter, setTrialFilter] = useState('')

  // Payments state
  const [payments, setPayments] = useState({ payments: [], total: 0, page: 1, page_size: 20, total_amount: 0 })

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState({ subscriptions: [], total: 0, page: 1, page_size: 20 })
  const [subscriptionFilter, setSubscriptionFilter] = useState('')
  const [subscriptionPlanFilter, setSubscriptionPlanFilter] = useState('')

  // Lotto state
  const [lottoDraws, setLottoDraws] = useState({ draws: [], total: 0, page: 1, page_size: 20 })
  const [newDraw, setNewDraw] = useState({
    draw_no: '',
    draw_date: '',
    n1: '',
    n2: '',
    n3: '',
    n4: '',
    n5: '',
    n6: '',
    bonus: '',
  })

  // ML 분석 state
  const [mlAnalysis, setMLAnalysis] = useState(null)
  const [mlLatest, setMLLatest] = useState(null)
  const [mlLogs, setMLLogs] = useState({ logs: [], total: 0, page: 1, page_size: 10 })
  const [retraining, setRetraining] = useState(false)

  // 플랜 성과 state
  const [performanceSummary, setPerformanceSummary] = useState(null)
  const [performanceByDraw, setPerformanceByDraw] = useState(null)
  const [performanceHistory, setPerformanceHistory] = useState({ history: [], total: 0, page: 1, page_size: 20 })
  const [performanceDrawNo, setPerformanceDrawNo] = useState('')

  // 매칭 관리 state
  const [matchStatus, setMatchStatus] = useState(null)
  const [matchDrawNo, setMatchDrawNo] = useState('')
  const [matching, setMatching] = useState(false)

  // 추천 로그 state
  const [recommendLogs, setRecommendLogs] = useState({ logs: [], total: 0, page: 1, page_size: 20 })

  useEffect(() => {
    if (authLoading) return
    if (!isAuthed) {
      navigate('/login', { state: { from: { pathname: '/admin' } } })
      return
    }
    if (!isAdmin) {
      setError('관리자 권한이 필요합니다.')
      return
    }
    loadDashboard()
  }, [isAuthed, isAdmin, authLoading, navigate])

  useEffect(() => {
    if (!isAdmin) return
    setError('')
    if (activeTab === 'dashboard') loadDashboard()
    else if (activeTab === 'users') loadUsers()
    else if (activeTab === 'subscriptions') loadSubscriptions()
    else if (activeTab === 'trials') loadTrials()
    else if (activeTab === 'payments') loadPayments()
    else if (activeTab === 'lotto') loadLottoDraws()
    else if (activeTab === 'ml') loadMLData()
    else if (activeTab === 'performance') loadPerformanceData()
    else if (activeTab === 'matching') loadMatchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAdmin])

  // Data loading functions
  const loadDashboard = async () => {
    setLoading(true)
    try {
      const data = await fetchAdminDashboard()
      setDashboard(data)
      setError('')
    } catch (err) {
      setError(err.message || '데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async (page = 1) => {
    setLoading(true)
    try {
      const [usersData, socialData] = await Promise.all([
        fetchUsers({
          page,
          page_size: 20,
          search: userSearch || undefined,
          subscription_type: userPlanFilter || undefined
        }),
        fetchSocialAccounts({ page: 1, page_size: 20 })
      ])
      setUsers(usersData)
      setSocialAccounts(socialData)
      setError('')
    } catch (err) {
      setError(err.message || '회원 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateUser = async (userId, updates) => {
    try {
      await updateUser(userId, updates)
      loadUsers(users.page)
    } catch (err) {
      alert(err.message || '수정 실패')
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return
    try {
      await deleteUser(userId)
      loadUsers(users.page)
    } catch (err) {
      alert(err.message || '삭제 실패')
    }
  }

  const loadSocialAccounts = async (page = 1, filter = {}) => {
    try {
      const params = { page, page_size: 20 }
      if (filter.user_id) params.user_id = parseInt(filter.user_id)
      if (filter.provider) params.provider = filter.provider
      const data = await fetchSocialAccounts(params)
      setSocialAccounts(data)
    } catch (err) {
      alert(err.message || '소셜 계정을 불러오는데 실패했습니다.')
    }
  }

  const handleDeleteSocialAccount = async (accountId) => {
    if (!window.confirm('정말 연동을 해제하시겠습니까?')) return
    try {
      await deleteSocialAccount(accountId)
      loadSocialAccounts(socialAccounts.page)
      alert('소셜 계정 연동이 해제되었습니다.')
    } catch (err) {
      alert(err.message || '연동 해제 실패')
    }
  }

  const loadTrials = async (page = 1) => {
    setLoading(true)
    try {
      const data = await fetchFreeTrials({ page, page_size: 20, status: trialFilter || undefined })
      setTrials(data)
      setError('')
    } catch (err) {
      setError(err.message || '무료체험 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateTrialStatus = async (trialId, status) => {
    try {
      await updateFreeTrialStatus(trialId, status)
      loadTrials(trials.page)
    } catch (err) {
      alert(err.message || '상태 변경 실패')
    }
  }

  const loadPayments = async (page = 1) => {
    setLoading(true)
    try {
      const data = await fetchPayments({ page, page_size: 20 })
      setPayments(data)
      setError('')
    } catch (err) {
      setError(err.message || '결제 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleRefund = async (paymentId) => {
    const reason = prompt('환불 사유를 입력하세요:')
    if (!reason) return
    try {
      await refundPayment(paymentId, reason)
      loadPayments(payments.page)
      alert('환불이 처리되었습니다.')
    } catch (err) {
      alert(err.message || '환불 실패')
    }
  }

  // Subscriptions
  const loadSubscriptions = async (page = 1) => {
    setLoading(true)
    try {
      const data = await fetchSubscriptions({
        page,
        page_size: 20,
        status: subscriptionFilter || undefined,
        plan_type: subscriptionPlanFilter || undefined
      })
      setSubscriptions(data)
      setError('')
    } catch (err) {
      setError(err.message || '구독 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleApproveSubscription = async (id, days, userId = null) => {
    const userIdMsg = userId ? ` (회원ID: ${userId})` : ''
    if (!window.confirm(`구독을 ${days}일간 승인하시겠습니까?${userIdMsg}`)) return
    try {
      await approveSubscription(id, days, userId)
      loadSubscriptions(subscriptions.page)
      alert(userId
        ? `구독이 승인되었습니다. 회원(ID: ${userId})의 플랜이 자동으로 업데이트됩니다.`
        : '구독이 승인되었습니다.')
    } catch (err) {
      alert(err.message || '승인 실패')
    }
  }

  const handleRejectSubscription = async (id) => {
    if (!window.confirm('구독 신청을 거부하시겠습니까?')) return
    try {
      await rejectSubscription(id)
      loadSubscriptions(subscriptions.page)
      alert('구독 신청이 거부되었습니다.')
    } catch (err) {
      alert(err.message || '거부 실패')
    }
  }

  const handleExtendSubscription = async (id, days) => {
    if (!window.confirm(`구독을 ${days}일 연장하시겠습니까?`)) return
    try {
      await extendSubscription(id, days)
      loadSubscriptions(subscriptions.page)
      alert('구독이 연장되었습니다.')
    } catch (err) {
      alert(err.message || '연장 실패')
    }
  }

  const handleCancelSubscription = async (id) => {
    if (!window.confirm('구독을 취소하시겠습니까?')) return
    try {
      await cancelSubscription(id)
      loadSubscriptions(subscriptions.page)
      alert('구독이 취소되었습니다.')
    } catch (err) {
      alert(err.message || '취소 실패')
    }
  }

  const handleSendNumbers = async (id) => {
    if (!window.confirm('구독자에게 번호를 발송하시겠습니까?')) return
    try {
      const result = await sendSubscriptionNumbers(id)
      loadSubscriptions(subscriptions.page)
      alert(result.message || '번호가 발송되었습니다.')
    } catch (err) {
      alert(err.message || '번호 발송 실패')
    }
  }

  const loadLottoDraws = async (page = 1) => {
    setLoading(true)
    try {
      const data = await fetchLottoDraws({ page, page_size: 20 })
      setLottoDraws(data)
      setError('')
    } catch (err) {
      setError(err.message || '로또 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDraw = async (e) => {
    e.preventDefault()
    try {
      await createLottoDraw({
        draw_no: parseInt(newDraw.draw_no),
        draw_date: newDraw.draw_date,
        n1: parseInt(newDraw.n1),
        n2: parseInt(newDraw.n2),
        n3: parseInt(newDraw.n3),
        n4: parseInt(newDraw.n4),
        n5: parseInt(newDraw.n5),
        n6: parseInt(newDraw.n6),
        bonus: parseInt(newDraw.bonus),
      })
      setNewDraw({ draw_no: '', draw_date: '', n1: '', n2: '', n3: '', n4: '', n5: '', n6: '', bonus: '' })
      loadLottoDraws(1)
      alert('회차가 추가되었습니다.')
    } catch (err) {
      alert(err.message || '추가 실패')
    }
  }

  const handleDeleteDraw = async (drawNo) => {
    if (!window.confirm(`${drawNo}회차를 삭제하시겠습니까?`)) return
    try {
      await deleteLottoDraw(drawNo)
      loadLottoDraws(lottoDraws.page)
    } catch (err) {
      alert(err.message || '삭제 실패')
    }
  }

  const handleUpdateDraw = async (drawNo, data) => {
    try {
      await updateLottoDraw(drawNo, data)
      loadLottoDraws(lottoDraws.page)
      alert('회차가 수정되었습니다.')
    } catch (err) {
      alert(err.message || '수정 실패')
    }
  }

  const handleRebuildCache = async () => {
    if (!window.confirm('캐시를 재생성하시겠습니까?')) return
    try {
      await rebuildLottoCache()
      alert('캐시가 재생성되었습니다.')
    } catch (err) {
      alert(err.message || '캐시 재생성 실패')
    }
  }

  const loadMLData = async () => {
    setLoading(true)
    try {
      const [analysis, latest, logs] = await Promise.all([
        fetchMLLogicAnalysis(10),
        fetchMLLatest(),
        fetchMLTrainingLogs({ page: 1, page_size: 10 }),
      ])
      setMLAnalysis(analysis)
      setMLLatest(latest)
      setMLLogs(logs)
      setError('')
    } catch (err) {
      setError(err.message || 'ML 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleRetrain = async () => {
    if (!window.confirm('ML 모델을 재학습하시겠습니까? 시간이 걸릴 수 있습니다.')) return
    setRetraining(true)
    try {
      const result = await triggerMLRetrain()
      alert(`재학습 완료! 정확도: ${(result.test_accuracy * 100).toFixed(2)}%`)
      loadMLData()
    } catch (err) {
      alert(err.message || '재학습 실패')
    } finally {
      setRetraining(false)
    }
  }

  const loadPerformanceData = async () => {
    setLoading(true)
    try {
      const [summary, history] = await Promise.all([
        fetchPerformanceSummary(10),
        fetchPerformanceHistory({ page: 1, page_size: 20 })
      ])
      setPerformanceSummary(summary)
      setPerformanceHistory(history)
      setError('')
    } catch (err) {
      setError(err.message || '성과 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadPerformanceHistory = async (page = 1) => {
    try {
      const data = await fetchPerformanceHistory({ page, page_size: 20 })
      setPerformanceHistory(data)
    } catch (err) {
      alert(err.message || '성과 이력을 불러오는데 실패했습니다.')
    }
  }

  const handleFetchPerformanceByDraw = async () => {
    if (!performanceDrawNo) {
      alert('회차를 입력하세요.')
      return
    }
    try {
      const data = await fetchPerformanceByDraw(parseInt(performanceDrawNo))
      setPerformanceByDraw(data)
    } catch (err) {
      alert(err.message || '회차별 성과를 불러오는데 실패했습니다.')
    }
  }

  const loadMatchData = async () => {
    setLoading(true)
    try {
      const [status, logs] = await Promise.all([
        fetchMatchStatus(),
        fetchRecommendLogs({ page: 1, page_size: 20 })
      ])
      setMatchStatus(status)
      setRecommendLogs(logs)
      setError('')
    } catch (err) {
      setError(err.message || '매칭 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadRecommendLogs = async (page = 1, filter = {}) => {
    try {
      const params = { page, page_size: 20 }
      if (filter.user_id) params.user_id = parseInt(filter.user_id)
      if (filter.target_draw_no) params.target_draw_no = parseInt(filter.target_draw_no)
      const data = await fetchRecommendLogs(params)
      setRecommendLogs(data)
    } catch (err) {
      alert(err.message || '추천 로그를 불러오는데 실패했습니다.')
    }
  }

  const handleUpdateRecommendLog = async (logId, updates) => {
    try {
      await updateRecommendLog(logId, updates)
      loadRecommendLogs(recommendLogs.page)
      alert('추천 로그가 수정되었습니다.')
    } catch (err) {
      alert(err.message || '수정 실패')
    }
  }

  const handleDeleteRecommendLog = async (logId) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return
    try {
      await deleteRecommendLog(logId)
      loadRecommendLogs(recommendLogs.page)
      alert('추천 로그가 삭제되었습니다.')
    } catch (err) {
      alert(err.message || '삭제 실패')
    }
  }

  const handleTriggerMatch = async () => {
    if (!matchDrawNo) {
      alert('회차를 입력하세요.')
      return
    }
    if (!window.confirm(`${matchDrawNo}회차 매칭을 실행하시겠습니까?`)) return
    setMatching(true)
    try {
      const result = await triggerMatch(parseInt(matchDrawNo))
      alert(`매칭 완료! ${result.matched_count}건 처리됨`)
      setMatchDrawNo('')
      loadMatchData()
    } catch (err) {
      alert(err.message || '매칭 실패')
    } finally {
      setMatching(false)
    }
  }

  // Render loading
  if (authLoading) {
    return (
      <div className="admin-layout">
        <div className="admin-layout__loading">로딩 중...</div>
      </div>
    )
  }

  // Render not authenticated
  if (!isAuthed) {
    return null
  }

  // Render not admin
  if (!isAdmin) {
    return (
      <div className="admin-layout">
        <div className="admin-layout__error">
          <h2>접근 권한 없음</h2>
          <p>관리자 권한이 필요합니다.</p>
          <Link to="/" className="btn btn--primary">홈으로 돌아가기</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-layout">
      {/* 관리자 전용 헤더 */}
      <header className="admin-header">
        <div className="admin-header__inner">
          <Link to="/admin" className="admin-header__brand">
            <span className="admin-header__logo">AI</span>
            <span className="admin-header__title">관리자 대시보드</span>
          </Link>
          <div className="admin-header__right">
            <span className="admin-header__user">{user?.identifier}</span>
            <Link to="/" className="admin-header__link">사이트 보기</Link>
            <button className="admin-header__logout" type="button" onClick={logout}>
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="admin-main">
        <div className="admin-main__head">
          <h1>관리자 페이지</h1>
          <p>서비스 운영을 위한 관리 도구입니다.</p>
        </div>

        {error && <div className="admin__error">{error}</div>}

        <div className="admin__tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`admin__tab ${activeTab === tab.id ? 'admin__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && <div className="admin__loading">로딩 중...</div>}

        <div className="admin__content">
          {activeTab === 'dashboard' && <DashboardTab dashboard={dashboard} />}

          {activeTab === 'users' && (
            <UsersTab
              users={users}
              userSearch={userSearch}
              setUserSearch={setUserSearch}
              userPlanFilter={userPlanFilter}
              setUserPlanFilter={setUserPlanFilter}
              loadUsers={loadUsers}
              handleUpdateUser={handleUpdateUser}
              handleDeleteUser={handleDeleteUser}
              socialAccounts={socialAccounts}
              loadSocialAccounts={loadSocialAccounts}
              handleDeleteSocialAccount={handleDeleteSocialAccount}
            />
          )}

          {activeTab === 'subscriptions' && (
            <SubscriptionsTab
              subscriptions={subscriptions}
              subscriptionFilter={subscriptionFilter}
              setSubscriptionFilter={setSubscriptionFilter}
              subscriptionPlanFilter={subscriptionPlanFilter}
              setSubscriptionPlanFilter={setSubscriptionPlanFilter}
              loadSubscriptions={loadSubscriptions}
              handleApprove={handleApproveSubscription}
              handleReject={handleRejectSubscription}
              handleExtend={handleExtendSubscription}
              handleCancel={handleCancelSubscription}
              handleSendNumbers={handleSendNumbers}
            />
          )}

          {activeTab === 'trials' && (
            <TrialsTab
              trials={trials}
              trialFilter={trialFilter}
              setTrialFilter={setTrialFilter}
              loadTrials={loadTrials}
              handleUpdateTrialStatus={handleUpdateTrialStatus}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentsTab
              payments={payments}
              loadPayments={loadPayments}
              handleRefund={handleRefund}
            />
          )}

          {activeTab === 'lotto' && (
            <LottoTab
              lottoDraws={lottoDraws}
              newDraw={newDraw}
              setNewDraw={setNewDraw}
              loadLottoDraws={loadLottoDraws}
              handleCreateDraw={handleCreateDraw}
              handleUpdateDraw={handleUpdateDraw}
              handleDeleteDraw={handleDeleteDraw}
              handleRebuildCache={handleRebuildCache}
            />
          )}

          {activeTab === 'ml' && (
            <MLTab
              mlAnalysis={mlAnalysis}
              mlLatest={mlLatest}
              mlLogs={mlLogs}
              retraining={retraining}
              handleRetrain={handleRetrain}
            />
          )}

          {activeTab === 'performance' && (
            <PerformanceTab
              performanceSummary={performanceSummary}
              performanceByDraw={performanceByDraw}
              performanceHistory={performanceHistory}
              performanceDrawNo={performanceDrawNo}
              setPerformanceDrawNo={setPerformanceDrawNo}
              handleFetchPerformanceByDraw={handleFetchPerformanceByDraw}
              loadPerformanceHistory={loadPerformanceHistory}
            />
          )}

          {activeTab === 'matching' && (
            <MatchingTab
              matchStatus={matchStatus}
              matchDrawNo={matchDrawNo}
              setMatchDrawNo={setMatchDrawNo}
              matching={matching}
              handleTriggerMatch={handleTriggerMatch}
              recommendLogs={recommendLogs}
              loadRecommendLogs={loadRecommendLogs}
              handleUpdateRecommendLog={handleUpdateRecommendLog}
              handleDeleteRecommendLog={handleDeleteRecommendLog}
            />
          )}

          {activeTab === 'backtest' && <BacktestTab />}
        </div>
      </main>
    </div>
  )
}

export default AdminPage
