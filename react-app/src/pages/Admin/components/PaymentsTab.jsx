import { formatDate, formatMoney } from './AdminUtils.js'
import AdminPagination from './AdminPagination.jsx'
import EmptyTableRow from './EmptyTableRow.jsx'

function PaymentsTab({ payments, loadPayments, handleRefund }) {
  return (
    <div className="admin__payments">
      <div className="admin__summary">
        <strong>총 결제금액:</strong> {formatMoney(payments.total_amount)}원
      </div>
      <table className="admin__table">
        <thead>
          <tr>
            <th>ID</th>
            <th>주문번호</th>
            <th>회원ID</th>
            <th>상품</th>
            <th>금액</th>
            <th>상태</th>
            <th>결제일</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {payments.payments.length === 0 ? (
            <EmptyTableRow colSpan={8} message="결제 내역이 없습니다." />
          ) : (
            payments.payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.id}</td>
                <td>{payment.order_id}</td>
                <td>{payment.user_id}</td>
                <td>{payment.product_name}</td>
                <td>{formatMoney(payment.amount)}원</td>
                <td>
                  <span className={`admin__status admin__status--${payment.status}`}>{payment.status}</span>
                </td>
                <td>{formatDate(payment.paid_at || payment.created_at)}</td>
                <td>
                  {payment.status === 'completed' && (
                    <button className="admin__btn admin__btn--danger" onClick={() => handleRefund(payment.id)}>
                      환불
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <AdminPagination
        page={payments.page}
        total={payments.total}
        pageSize={payments.page_size}
        onPageChange={loadPayments}
      />
    </div>
  )
}

export default PaymentsTab
