import AdminPagination from './AdminPagination.jsx'

const PLAN_LABELS = {
  free: '무료',
  basic: '베이직',
  premium: '프리미엄',
  vip: 'VIP',
}

function PerformanceTab({
  performanceSummary,
  performanceByDraw,
  performanceHistory,
  performanceDrawNo,
  setPerformanceDrawNo,
  handleFetchPerformanceByDraw,
  loadPerformanceHistory,
}) {
  return (
    <div className="admin__performance">
      {/* 플랜별 요약 */}
      <section className="admin__section">
        <h3>플랜별 성과 요약 (최근 10회차)</h3>
        {performanceSummary && (
          <div className="admin__stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {['free', 'basic', 'premium', 'vip'].map((plan) => {
              const data = performanceSummary[plan]
              if (!data || data.total_lines === 0) return null
              return (
                <div key={plan} className="admin__stat-card">
                  <h4 style={{ textTransform: 'uppercase' }}>{PLAN_LABELS[plan] || plan}</h4>
                  <div className="admin__stat-details">
                    <p>총 발행: <strong>{data.total_lines}줄</strong></p>
                    <p>평균 적중: <strong>{data.avg_match}개</strong></p>
                    <p>5등 (3개): {data.rank5_count}건</p>
                    <p>4등 (4개): {data.rank4_count}건</p>
                    <p>3등 (5개): {data.rank3_count}건</p>
                    <p>2등 (5+보너스): {data.rank2_count}건</p>
                    <p>1등 (6개): {data.rank1_count}건</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {performanceSummary && Object.values(performanceSummary).every((p) => !p || p.total_lines === 0) && (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>
            아직 성과 데이터가 없습니다.
          </p>
        )}
      </section>

      {/* 회차별 상세 분석 */}
      <section className="admin__section" style={{ marginTop: '30px' }}>
        <h3>회차별 상세 분석</h3>
        <div className="admin__toolbar">
          <input
            type="number"
            placeholder="회차 번호"
            value={performanceDrawNo}
            onChange={(e) => setPerformanceDrawNo(e.target.value)}
            style={{ width: '100px' }}
          />
          <button className="admin__btn admin__btn--primary" onClick={handleFetchPerformanceByDraw}>
            조회
          </button>
        </div>

        {performanceByDraw && (
          <div className="admin__draw-detail" style={{ marginTop: '15px' }}>
            <h4>{performanceByDraw.draw_no}회차 분석 결과</h4>
            <div className="admin__stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginTop: '10px' }}>
              {performanceByDraw.winning_numbers && (
                <div className="admin__stat-card">
                  <h5>당첨 번호</h5>
                  <p style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    {performanceByDraw.winning_numbers.join(', ')}
                    {performanceByDraw.bonus_number && ` + ${performanceByDraw.bonus_number}`}
                  </p>
                </div>
              )}
              <div className="admin__stat-card">
                <h5>통계</h5>
                <p>총 추천 수: {performanceByDraw.total_recommendations || 0}건</p>
                <p>평균 적중: {performanceByDraw.avg_match || 0}개</p>
              </div>
            </div>
            {performanceByDraw.by_plan && (
              <div style={{ marginTop: '15px' }}>
                <h5>플랜별 성과</h5>
                <table className="admin__table" style={{ marginTop: '10px' }}>
                  <thead>
                    <tr>
                      <th>플랜</th>
                      <th>추천 수</th>
                      <th>평균 적중</th>
                      <th>5등</th>
                      <th>4등</th>
                      <th>3등+</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(performanceByDraw.by_plan).map(([plan, stats]) => (
                      <tr key={plan}>
                        <td>{PLAN_LABELS[plan] || plan}</td>
                        <td>{stats.count || 0}</td>
                        <td>{stats.avg_match || 0}</td>
                        <td>{stats.rank5 || 0}</td>
                        <td>{stats.rank4 || 0}</td>
                        <td>{(stats.rank3 || 0) + (stats.rank2 || 0) + (stats.rank1 || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 성과 이력 */}
      <section className="admin__section" style={{ marginTop: '30px' }}>
        <h3>성과 이력</h3>
        {performanceHistory && performanceHistory.history && performanceHistory.history.length > 0 ? (
          <>
            <table className="admin__table">
              <thead>
                <tr>
                  <th>회차</th>
                  <th>플랜</th>
                  <th>추천 수</th>
                  <th>평균 적중</th>
                  <th>5등</th>
                  <th>4등</th>
                  <th>3등+</th>
                  <th>날짜</th>
                </tr>
              </thead>
              <tbody>
                {performanceHistory.history.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.draw_no}</td>
                    <td>{PLAN_LABELS[item.plan_type] || item.plan_type || '전체'}</td>
                    <td>{item.total_lines || 0}</td>
                    <td>{item.avg_match || 0}</td>
                    <td>{item.rank5_count || 0}</td>
                    <td>{item.rank4_count || 0}</td>
                    <td>{(item.rank3_count || 0) + (item.rank2_count || 0) + (item.rank1_count || 0)}</td>
                    <td>{item.draw_date || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <AdminPagination
              page={performanceHistory.page}
              total={performanceHistory.total}
              pageSize={performanceHistory.page_size}
              onPageChange={loadPerformanceHistory}
            />
          </>
        ) : (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '15px' }}>
            성과 이력이 없습니다.
          </p>
        )}
      </section>
    </div>
  )
}

export default PerformanceTab
