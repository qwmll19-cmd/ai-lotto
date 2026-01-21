import { formatMoney } from './AdminUtils.js'

function DashboardTab({ dashboard }) {
  if (!dashboard) return null

  return (
    <div className="admin__dashboard">
      <div className="admin__stats-grid">
        <div className="admin__stat-card">
          <h3>총 회원</h3>
          <p className="admin__stat-value">{dashboard.total_users}명</p>
          <span className="admin__stat-hint">활성: {dashboard.active_users}명</span>
        </div>
        <div className="admin__stat-card">
          <h3>신규 회원 (오늘)</h3>
          <p className="admin__stat-value">{dashboard.new_users_today}명</p>
          <span className="admin__stat-hint">주간: {dashboard.new_users_week}명</span>
        </div>
        <div className="admin__stat-card">
          <h3>무료체험 신청</h3>
          <p className="admin__stat-value">{dashboard.total_free_trials}건</p>
          <span className="admin__stat-hint">대기: {dashboard.pending_free_trials}건</span>
        </div>
        <div className="admin__stat-card">
          <h3>총 결제</h3>
          <p className="admin__stat-value">{dashboard.total_payments}건</p>
          <span className="admin__stat-hint">매출: {formatMoney(dashboard.total_revenue)}원</span>
        </div>
        <div className="admin__stat-card">
          <h3>활성 구독</h3>
          <p className="admin__stat-value">{dashboard.active_subscriptions}건</p>
        </div>
        <div className="admin__stat-card">
          <h3>최신 로또 회차</h3>
          <p className="admin__stat-value">{dashboard.latest_draw_no}회</p>
        </div>
      </div>
    </div>
  )
}

export default DashboardTab
