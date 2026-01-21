import { formatDate } from './AdminUtils.js'
import AdminPagination from './AdminPagination.jsx'
import EmptyTableRow from './EmptyTableRow.jsx'

function TrialsTab({ trials, trialFilter, setTrialFilter, loadTrials, handleUpdateTrialStatus }) {
  return (
    <div className="admin__trials">
      <div className="admin__toolbar">
        <select value={trialFilter} onChange={(e) => setTrialFilter(e.target.value)}>
          <option value="">전체</option>
          <option value="pending">대기</option>
          <option value="sent">발송완료</option>
          <option value="failed">실패</option>
        </select>
        <button onClick={() => loadTrials(1)}>필터 적용</button>
      </div>
      <table className="admin__table">
        <thead>
          <tr>
            <th>ID</th>
            <th>이름</th>
            <th>휴대폰</th>
            <th>조합수</th>
            <th>상태</th>
            <th>신청일</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {trials.trials.length === 0 ? (
            <EmptyTableRow colSpan={7} message="무료체험 신청이 없습니다." />
          ) : (
            trials.trials.map((trial) => (
              <tr key={trial.id}>
                <td>{trial.id}</td>
                <td>{trial.name}</td>
                <td>{trial.phone}</td>
                <td>{trial.combo_count}</td>
                <td>
                  <span className={`admin__status admin__status--${trial.status}`}>{trial.status}</span>
                </td>
                <td>{formatDate(trial.created_at)}</td>
                <td>
                  <select
                    value={trial.status}
                    onChange={(e) => handleUpdateTrialStatus(trial.id, e.target.value)}
                  >
                    <option value="pending">대기</option>
                    <option value="sent">발송완료</option>
                    <option value="failed">실패</option>
                  </select>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <AdminPagination
        page={trials.page}
        total={trials.total}
        pageSize={trials.page_size}
        onPageChange={loadTrials}
      />
    </div>
  )
}

export default TrialsTab
