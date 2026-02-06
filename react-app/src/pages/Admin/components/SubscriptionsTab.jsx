import { useState } from 'react'
import { formatDate, formatMoney } from './AdminUtils.js'
import AdminPagination from './AdminPagination.jsx'
import EmptyTableRow from './EmptyTableRow.jsx'
import { request } from '../../../api/client.js'

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
  subscriptionPlanFilter,
  setSubscriptionPlanFilter,
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
  const [receiptFilter, setReceiptFilter] = useState('')

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

  // 현금영수증 발급 완료 처리
  const handleReceiptIssued = async (id) => {
    if (!window.confirm('현금영수증 발급 완료 처리하시겠습니까?')) return
    try {
      await request(`/api/admin/subscriptions/${id}/receipt-issued`, {
        method: 'PUT',
      })
      alert('현금영수증 발급 완료 처리되었습니다.')
      loadSubscriptions(subscriptions.page)
    } catch (err) {
      alert(err?.message || '처리 중 오류가 발생했습니다.')
    }
  }

  // CSV 내보내기
  const handleExportReceipt = async () => {
    try {
      const response = await fetch('/api/admin/subscriptions/export-receipt', {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('다운로드 실패')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `receipt_list_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert(err?.message || 'CSV 다운로드 중 오류가 발생했습니다.')
    }
  }

  // 필터링된 구독 목록
  const filteredSubscriptions = subscriptions.subscriptions.filter((sub) => {
    if (receiptFilter === 'pending') {
      return sub.receipt_phone && !sub.receipt_issued
    }
    if (receiptFilter === 'issued') {
      return sub.receipt_phone && sub.receipt_issued
    }
    return true
  })

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
        <select
          value={subscriptionPlanFilter}
          onChange={(e) => {
            setSubscriptionPlanFilter(e.target.value)
          }}
        >
          <option value="">전체 플랜</option>
          <option value="basic">베이직</option>
          <option value="premium">프리미엄</option>
          <option value="vip">VIP</option>
        </select>
        <select
          value={receiptFilter}
          onChange={(e) => setReceiptFilter(e.target.value)}
        >
          <option value="">현금영수증 전체</option>
          <option value="pending">발급 대기</option>
          <option value="issued">발급 완료</option>
        </select>
        <button onClick={() => loadSubscriptions(1)}>조회</button>
        <button
          className="admin__btn admin__btn--secondary"
          onClick={handleExportReceipt}
          title="현금영수증 발급 대상 CSV 다운로드"
        >
          CSV 내보내기
        </button>
      </div>

      <table className="admin__table">
        <thead>
          <tr>
            <th>ID</th>
            <th>회원ID</th>
            <th>사용자명</th>
            <th>입금자명</th>
            <th>플랜</th>
            <th>금액</th>
            <th>상태</th>
            <th>현금영수증</th>
            <th>요청일</th>
            <th>만료일</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {filteredSubscriptions.length === 0 ? (
            <EmptyTableRow colSpan={11} message="구독 내역이 없습니다." />
          ) : (
            filteredSubscriptions.map((sub) => (
              <tr key={sub.id}>
                <td>{sub.id}</td>
                <td>{sub.user_id || '-'}</td>
                <td>{sub.name}</td>
                <td>
                  <strong>{sub.depositor_name || sub.name}</strong>
                  {sub.depositor_name && sub.depositor_name !== sub.name && (
                    <span className="admin__hint"> (다름)</span>
                  )}
                </td>
                <td>
                  <span className={`admin__badge admin__badge--${sub.plan_type}`}>
                    {PLAN_LABELS[sub.plan_type] || sub.plan_type}
                  </span>
                </td>
                <td>{sub.amount ? `₩${formatMoney(sub.amount)}` : '-'}</td>
                <td>
                  <span className={`admin__status admin__status--${sub.status}`}>
                    {STATUS_LABELS[sub.status] || sub.status}
                  </span>
                </td>
                <td>
                  {sub.receipt_phone ? (
                    <div className="admin__receipt">
                      <span>{sub.receipt_phone}</span>
                      {sub.receipt_issued ? (
                        <span className="admin__status admin__status--active">발급완료</span>
                      ) : (
                        <button
                          className="admin__btn admin__btn--sm"
                          onClick={() => handleReceiptIssued(sub.id)}
                        >
                          발급처리
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="admin__hint">-</span>
                  )}
                </td>
                <td>{formatDate(sub.created_at)}</td>
                <td>{formatDate(sub.expires_at)}</td>
                <td className="admin__actions">
                  {sub.status === 'pending' && (
                    <>
                      <div className="admin__action-group">
                        {/* 이미 연결된 경우 회원ID 입력 불필요 */}
                        {!sub.user_id && (
                          <input
                            type="number"
                            placeholder="회원ID"
                            value={approveUserIds[sub.id] || ''}
                            onChange={(e) => setApproveUserIds({ ...approveUserIds, [sub.id]: e.target.value })}
                            style={{ width: '60px' }}
                            title="연결할 회원 ID (선택)"
                          />
                        )}
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
                        <button
                          className="admin__btn admin__btn--warning"
                          onClick={() => handleExtend(sub.id, 36500)}
                          title="100년 연장 (무제한)"
                        >
                          무제한
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
