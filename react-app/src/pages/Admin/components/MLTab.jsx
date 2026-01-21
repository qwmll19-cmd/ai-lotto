import { formatDate } from './AdminUtils.js'

function MLTab({ mlAnalysis, mlLatest, mlLogs, retraining, handleRetrain }) {
  return (
    <div className="admin__ml">
      <div className="admin__toolbar">
        <button
          className="admin__btn admin__btn--primary"
          onClick={handleRetrain}
          disabled={retraining}
        >
          {retraining ? '재학습 중...' : 'ML 재학습'}
        </button>
      </div>

      {mlLatest && (
        <div className="admin__section">
          <h3>최신 ML 상태</h3>
          <div className="admin__stats-grid">
            <div className="admin__stat-card">
              <h4>학습 정확도</h4>
              <p className="admin__stat-value">
                {mlLatest.test_accuracy ? `${(mlLatest.test_accuracy * 100).toFixed(2)}%` : '-'}
              </p>
            </div>
            <div className="admin__stat-card">
              <h4>학습 데이터</h4>
              <p className="admin__stat-value">{mlLatest.total_draws || 0}회차</p>
            </div>
            <div className="admin__stat-card">
              <h4>마지막 학습</h4>
              <p className="admin__stat-value" style={{ fontSize: '14px' }}>
                {formatDate(mlLatest.trained_at)}
              </p>
            </div>
          </div>
        </div>
      )}

      {mlAnalysis && !mlAnalysis.error && (
        <div className="admin__section">
          <h3>로직별 성과 분석 (최근 {mlAnalysis.analysis_draws}회차)</h3>
          <table className="admin__table">
            <thead>
              <tr>
                <th>로직</th>
                <th>이름</th>
                <th>Top10 적중률</th>
                <th>Top15 적중률</th>
                <th>Top20 적중률</th>
              </tr>
            </thead>
            <tbody>
              {['logic1', 'logic2', 'logic3'].map((key) => {
                const logic = mlAnalysis[key]
                return (
                  <tr key={key}>
                    <td>{key}</td>
                    <td>{logic.name}</td>
                    <td>{logic.hit_rate.top10}%</td>
                    <td>{logic.hit_rate.top15}%</td>
                    <td>{logic.hit_rate.top20}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {mlAnalysis.recommendation && (
            <div className="admin__recommendation">
              <h4>추천 가중치</h4>
              <p>
                Logic1: {mlAnalysis.recommendation.logic1} /
                Logic2: {mlAnalysis.recommendation.logic2} /
                Logic3: {mlAnalysis.recommendation.logic3}
              </p>
              <small>{mlAnalysis.recommendation.note}</small>
            </div>
          )}
        </div>
      )}

      {mlLogs.logs && mlLogs.logs.length > 0 && (
        <div className="admin__section">
          <h3>학습 히스토리</h3>
          <table className="admin__table">
            <thead>
              <tr>
                <th>학습일시</th>
                <th>정확도</th>
                <th>데이터</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {mlLogs.logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDate(log.trained_at)}</td>
                  <td>{log.test_accuracy ? `${(log.test_accuracy * 100).toFixed(2)}%` : '-'}</td>
                  <td>{log.total_draws}회차</td>
                  <td>{log.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default MLTab
