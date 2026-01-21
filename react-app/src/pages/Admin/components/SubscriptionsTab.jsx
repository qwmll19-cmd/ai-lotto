import { useState } from 'react'
import { formatDate, formatMoney } from './AdminUtils.js'
import AdminPagination from './AdminPagination.jsx'
import EmptyTableRow from './EmptyTableRow.jsx'

const STATUS_LABELS = {
  pending: '대기',
  active: '활성',
  expired: '만료',
  cancelled: '취소',
}

const PLAN_LABELS = {
  basic: '베이직',
  premium: '프리미엄',
  vip: 'VIP',
}

function SubscriptionsTab({
  subscriptions,
  subscriptionFilter,
  setSubscriptionFilter,
  loadSubscriptions,
  handleApprove,
  handleReject,
  handleExtend,
  handleCancel,
  handleSendNumbers,
}) {
  const [extendDays, setExtendDays] = useState({})
  const [approveDays, setApproveDays] = useState({})
  const [approveUserIds, setApproveUserIds] = useState({})

  const onApprove = (id) => {
    const days = approveDays[id] || 30
    const userId = approveUserIds[id] ? parseInt(approveUserIds[id]) : null
    handleApprove(id, days, userId)
  }

  const onExtend = (id) => {
    const days = extendDays[id]
    if (!days || days <= 0) {
      alert('연장 일수를 입력하세요')
      return
    }
    handleExtend(id, parseInt(days))
  }

  return (
    <div className="admin__subscriptions">
      <div className="admin__toolbar">
        <select
          value={subscriptionFilter}
          onChange={(e) => {
            setSubscriptionFilter(e.target.value)
          }}
        >
          <option value="">전체 상태</option>
          <option value="pending">대기</option>
          <option value="active">활성</option>
          <option value="expired">만료</option>
          <option value="cancelled">취소</option>
        </select>
        <button onClick={() => loadSubscriptions(1)}>조회</button>
      </div>

      <table className="admin__table">
        <thead>
          <tr>
            <th>ID</th>
            <th>회원ID</th>
            <th>이름</th>
            <th>전화번호</th>
            <th>플랜</th>
            <th>상태</th>
            <th>결제</th>
            <th>시작일</th>
            <th>만료일</th>
            <th>발송</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.subscriptions.length === 0 ? (
            <EmptyTableRow colSpan={11} message="구독 내역이 없습니다." />
          ) : (
            subscriptions.subscriptions.map((sub) => (
              <tr key={sub.id}>
                <td>{sub.id}</td>
                <td>{sub.user_id || '-'}</td>
                <td>{sub.name}</td>
                <td>{sub.phone ? `***${sub.phone.slice(-4)}` : '-'}</td>
                <td>
                  <span className={`admin__badge admin__badge--${sub.plan_type}`}>
                    {PLAN_LABELS[sub.plan_type] || sub.plan_type} ({sub.line_count}줄)
                  </span>
                </td>
                <td>
                  <span className={`admin__status admin__status--${sub.status}`}>
                    {STATUS_LABELS[sub.status] || sub.status}
                  </span>
                </td>
                <td>
                  {sub.payment_status === 'confirmed' ? (
                    <span className="admin__status admin__status--active">완료</span>
                  ) : (
                    <span className="admin__status admin__status--pending">대기</span>
                  )}
                  {sub.amount && <span> ({formatMoney(sub.amount)}원)</span>}
                </td>
                <td>{formatDate(sub.started_at)}</td>
                <td>{formatDate(sub.expires_at)}</td>
                <td>{sub.total_sent_count}회</td>
                <td className="admin__actions">
                  {sub.status === 'pending' && (
                    <>
                      <div className="admin__action-group">
                        <input
                          type="number"
                          placeholder="회원ID"
                          value={approveUserIds[sub.id] || ''}
                          onChange={(e) => setApproveUserIds({ ...approveUserIds, [sub.id]: e.target.value })}
                          style={{ width: '60px' }}
                          title="연결할 회원 ID (선택)"
                        />
                        <input
                          type="number"
                          placeholder="일수"
                          value={approveDays[sub.id] || 30}
                          onChange={(e) => setApproveDays({ ...approveDays, [sub.id]: e.target.value })}
                          style={{ width: '50px' }}
                        />
                        <button
                          className="admin__btn admin__btn--primary"
                          onClick={() => onApprove(sub.id)}
                        >
                          승인
                        </button>
                      </div>
                      <button
                        className="admin__btn admin__btn--danger"
                        onClick={() => handleReject(sub.id)}
                      >
                        거부
                      </button>
                    </>
                  )}
                  {sub.status === 'active' && (
                    <>
                      <button
                        className="admin__btn admin__btn--primary"
                        onClick={() => handleSendNumbers(sub.id)}
                        title="추천 번호 SMS 발송"
                      >
                        발송
                      </button>
                      <div className="admin__action-group">
                        <input
                          type="number"
                          placeholder="일수"
                          value={extendDays[sub.id] || ''}
                          onChange={(e) => setExtendDays({ ...extendDays, [sub.id]: e.target.value })}
                          style={{ width: '50px' }}
                        />
                        <button
                          className="admin__btn"
                          onClick={() => onExtend(sub.id)}
                        >
                          연장
                        </button>
                      </div>
                      <button
                        className="admin__btn admin__btn--danger"
                        onClick={() => handleCancel(sub.id)}
                      >
                        취소
                      </button>
                    </>
                  )}
                  {(sub.status === 'expired' || sub.status === 'cancelled') && (
                    <span className="admin__hint">-</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <AdminPagination
        page={subscriptions.page}
        total={subscriptions.total}
        pageSize={subscriptions.page_size}
        onPageChange={loadSubscriptions}
      />
    </div>
  )
}

export default SubscriptionsTab
