import { formatDate } from './AdminUtils.js'

function MLTab({
  mlAnalysis,
  mlLatest,
  mlLogs,
  retraining,
  handleRetrain,
  fullUpdating,
  handleFullUpdate,
  fullUpdateResult,
}) {
  return (
    <div className="admin__ml">
      <div className="admin__toolbar">
        <button
          className="admin__btn admin__btn--primary"
          onClick={handleRetrain}
          disabled={retraining || fullUpdating}
        >
          {retraining ? '재학습 중...' : 'ML 재학습'}
        </button>
        <button
          className="admin__btn admin__btn--warning"
          onClick={handleFullUpdate}
          disabled={retraining || fullUpdating}
          style={{ marginLeft: '8px' }}
        >
          {fullUpdating ? '업데이트 중...' : '전체 업데이트 트리거'}
        </button>
      </div>

      {fullUpdateResult && (
        <div className="admin__section" style={{ marginTop: '16px' }}>
          <h3>전체 업데이트 결과 (회차: {fullUpdateResult.draw_no})</h3>
          <div className="admin__stats-grid">
            <div className="admin__stat-card">
              <h4>당첨 매칭</h4>
              <p className="admin__stat-value" style={{ color: fullUpdateResult.match_result?.status === 'success' ? 'green' : 'red' }}>
                {fullUpdateResult.match_result?.status === 'success'
                  ? `${fullUpdateResult.match_result.matched_count}건 매칭`
                  : fullUpdateResult.match_result?.error || '실패'}
              </p>
            </div>
            <div className="admin__stat-card">
              <h4>푸시 알림</h4>
              <p className="admin__stat-value" style={{ color: fullUpdateResult.push_result?.status === 'success' ? 'green' : 'red' }}>
                {fullUpdateResult.push_result?.status === 'success'
                  ? `${fullUpdateResult.push_result.sent}건 발송`
                  : fullUpdateResult.push_result?.error || '실패'}
              </p>
            </div>
            <div className="admin__stat-card">
              <h4>ML 재학습</h4>
              <p className="admin__stat-value" style={{ color: fullUpdateResult.ml_result?.status === 'success' ? 'green' : 'red' }}>
                {fullUpdateResult.ml_result?.status === 'success'
                  ? `정확도: ${(fullUpdateResult.ml_result.accuracy * 100).toFixed(2)}%`
                  : fullUpdateResult.ml_result?.error || '실패'}
              </p>
            </div>
            <div className="admin__stat-card">
              <h4>캐시 갱신</h4>
              <p className="admin__stat-value" style={{ color: fullUpdateResult.cache_result?.status === 'success' ? 'green' : 'red' }}>
                {fullUpdateResult.cache_result?.status === 'success'
                  ? '완료'
                  : fullUpdateResult.cache_result?.error || '실패'}
              </p>
            </div>
          </div>
        </div>
      )}

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
