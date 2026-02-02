/**
 * 푸시 알림 관리 탭
 */
import { useState, useEffect } from 'react'
import AdminPagination from './AdminPagination.jsx'
import { formatDate } from './AdminUtils.js'

function PushNotificationsTab({
  stats,
  subscriptions,
  logs,
  loading,
  onLoadStats,
  onLoadSubscriptions,
  onLoadLogs,
  onSendPush,
  onDeleteSubscription,
}) {
  const [sendForm, setSendForm] = useState({
    title: '',
    body: '',
    notification_type: 'announcement',
    target: 'all',
  })
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)
  const [activeSubTab, setActiveSubTab] = useState('stats')

  useEffect(() => {
    if (activeSubTab === 'stats' && onLoadStats) {
      onLoadStats()
    } else if (activeSubTab === 'subscriptions' && onLoadSubscriptions) {
      onLoadSubscriptions(1)
    } else if (activeSubTab === 'logs' && onLoadLogs) {
      onLoadLogs(1)
    }
  }, [activeSubTab])

  const handleSendSubmit = async (e) => {
    e.preventDefault()
    if (!sendForm.title || !sendForm.body) {
      alert('제목과 내용을 입력해주세요.')
      return
    }

    setSending(true)
    setSendResult(null)

    try {
      const result = await onSendPush(sendForm)
      setSendResult(result)
      if (result.ok) {
        setSendForm({
          title: '',
          body: '',
          notification_type: 'announcement',
          target: 'all',
        })
        // 통계 새로고침
        if (onLoadStats) onLoadStats()
      }
    } catch (err) {
      setSendResult({ ok: false, message: err.message || '전송 실패' })
    } finally {
      setSending(false)
    }
  }

  const handleDeleteSub = async (subId) => {
    if (!window.confirm('이 구독을 삭제하시겠습니까?')) return
    await onDeleteSubscription(subId)
    onLoadSubscriptions(subscriptions.page)
  }

  return (
    <div className="admin-tab">
      <h2>푸시 알림 관리</h2>

      {/* 서브탭 네비게이션 */}
      <div className="admin-subtabs">
        <button
          className={`admin-subtab ${activeSubTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('stats')}
        >
          통계
        </button>
        <button
          className={`admin-subtab ${activeSubTab === 'send' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('send')}
        >
          알림 전송
        </button>
        <button
          className={`admin-subtab ${activeSubTab === 'subscriptions' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('subscriptions')}
        >
          구독자 목록
        </button>
        <button
          className={`admin-subtab ${activeSubTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('logs')}
        >
          발송 로그
        </button>
      </div>

      {/* 통계 */}
      {activeSubTab === 'stats' && stats && (
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <h3>총 구독자</h3>
            <div className="admin-stat-value">{stats.total_subscriptions || 0}명</div>
          </div>
          <div className="admin-stat-card">
            <h3>당첨결과 알림</h3>
            <div className="admin-stat-value">{stats.settings?.draw_result || 0}명</div>
          </div>
          <div className="admin-stat-card">
            <h3>추천번호 알림</h3>
            <div className="admin-stat-value">{stats.settings?.recommendation || 0}명</div>
          </div>
          <div className="admin-stat-card">
            <h3>구독만료 알림</h3>
            <div className="admin-stat-value">{stats.settings?.subscription_expiry || 0}명</div>
          </div>
          <div className="admin-stat-card">
            <h3>최근 7일 발송</h3>
            <div className="admin-stat-value">{stats.recent_7days?.sent || 0}건</div>
          </div>
          <div className="admin-stat-card">
            <h3>최근 7일 실패</h3>
            <div className="admin-stat-value admin-stat-danger">{stats.recent_7days?.failed || 0}건</div>
          </div>
        </div>
      )}

      {/* 알림 전송 폼 */}
      {activeSubTab === 'send' && (
        <div className="admin-form-section">
          <h3>새 알림 전송</h3>
          <form onSubmit={handleSendSubmit} className="admin-push-form">
            <div className="admin-form-group">
              <label>제목</label>
              <input
                type="text"
                value={sendForm.title}
                onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })}
                placeholder="알림 제목을 입력하세요"
                maxLength={100}
              />
            </div>

            <div className="admin-form-group">
              <label>내용</label>
              <textarea
                value={sendForm.body}
                onChange={(e) => setSendForm({ ...sendForm, body: e.target.value })}
                placeholder="알림 내용을 입력하세요"
                rows={3}
                maxLength={200}
              />
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>알림 유형</label>
                <select
                  value={sendForm.notification_type}
                  onChange={(e) => setSendForm({ ...sendForm, notification_type: e.target.value })}
                >
                  <option value="announcement">공지사항</option>
                  <option value="new_draw">당첨번호 발표</option>
                  <option value="recommendation">추천번호</option>
                  <option value="promotion">프로모션</option>
                </select>
              </div>

              <div className="admin-form-group">
                <label>전송 대상</label>
                <select
                  value={sendForm.target}
                  onChange={(e) => setSendForm({ ...sendForm, target: e.target.value })}
                >
                  <option value="all">전체 구독자</option>
                  <option value="draw_result">당첨결과 알림 구독자</option>
                  <option value="recommendation">추천번호 알림 구독자</option>
                  <option value="subscription_expiry">구독만료 알림 구독자</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={sending}
            >
              {sending ? '전송 중...' : '알림 전송'}
            </button>

            {sendResult && (
              <div className={`admin-result ${sendResult.ok ? 'success' : 'error'}`}>
                {sendResult.message}
                {sendResult.ok && ` (성공: ${sendResult.sent}건, 실패: ${sendResult.failed}건)`}
              </div>
            )}
          </form>
        </div>
      )}

      {/* 구독자 목록 */}
      {activeSubTab === 'subscriptions' && (
        <div className="admin-table-section">
          <h3>구독자 목록 ({subscriptions.total}명)</h3>
          {loading ? (
            <p>로딩 중...</p>
          ) : subscriptions.subscriptions?.length > 0 ? (
            <>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>사용자</th>
                    <th>당첨결과</th>
                    <th>추천번호</th>
                    <th>구독만료</th>
                    <th>등록일</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.subscriptions.map((sub) => (
                    <tr key={sub.id}>
                      <td>{sub.id}</td>
                      <td>{sub.user_identifier || `User #${sub.user_id}`}</td>
                      <td>{sub.notify_draw_result ? 'O' : '-'}</td>
                      <td>{sub.notify_recommendation ? 'O' : '-'}</td>
                      <td>{sub.notify_subscription_expiry ? 'O' : '-'}</td>
                      <td>{formatDate(sub.created_at)}</td>
                      <td>
                        <button
                          className="admin-btn admin-btn-danger admin-btn-sm"
                          onClick={() => handleDeleteSub(sub.id)}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <AdminPagination
                page={subscriptions.page}
                pageSize={subscriptions.page_size}
                total={subscriptions.total}
                onPageChange={(page) => onLoadSubscriptions(page)}
              />
            </>
          ) : (
            <p>구독자가 없습니다.</p>
          )}
        </div>
      )}

      {/* 발송 로그 */}
      {activeSubTab === 'logs' && (
        <div className="admin-table-section">
          <h3>발송 로그 ({logs.total}건)</h3>
          {loading ? (
            <p>로딩 중...</p>
          ) : logs.logs?.length > 0 ? (
            <>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>유형</th>
                    <th>제목</th>
                    <th>상태</th>
                    <th>발송일시</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.id}</td>
                      <td>{log.notification_type}</td>
                      <td>{log.title}</td>
                      <td>
                        <span className={`admin-badge ${log.status === 'sent' ? 'success' : 'danger'}`}>
                          {log.status === 'sent' ? '성공' : '실패'}
                        </span>
                      </td>
                      <td>{formatDate(log.sent_at || log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <AdminPagination
                page={logs.page}
                pageSize={logs.page_size}
                total={logs.total}
                onPageChange={(page) => onLoadLogs(page)}
              />
            </>
          ) : (
            <p>발송 로그가 없습니다.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default PushNotificationsTab
