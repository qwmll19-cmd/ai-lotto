import { useState } from 'react'
import { formatDate } from './AdminUtils.js'
import AdminPagination from './AdminPagination.jsx'
import EmptyTableRow from './EmptyTableRow.jsx'

function MatchingTab({
  matchStatus,
  matchDrawNo,
  setMatchDrawNo,
  matching,
  handleTriggerMatch,
  recommendLogs,
  loadRecommendLogs,
  handleUpdateRecommendLog,
  handleDeleteRecommendLog
}) {
  const [logFilter, setLogFilter] = useState({ user_id: '', target_draw_no: '' })
  const [editingLog, setEditingLog] = useState(null)
  const [editForm, setEditForm] = useState({})

  const searchLogs = () => {
    loadRecommendLogs(1, logFilter)
  }

  const startEditLog = (log) => {
    setEditingLog(log.id)
    setEditForm({
      lines: log.lines,
      match_results: log.match_results || '',
      is_matched: log.is_matched || false
    })
  }

  const cancelEditLog = () => {
    setEditingLog(null)
    setEditForm({})
  }

  const saveEditLog = async (logId) => {
    await handleUpdateRecommendLog(logId, editForm)
    setEditingLog(null)
    setEditForm({})
  }

  return (
    <div className="admin__matching">
      <div className="admin__section">
        <h3>수동 매칭</h3>
        <div className="admin__toolbar">
          <input
            type="number"
            placeholder="회차 번호"
            value={matchDrawNo}
            onChange={(e) => setMatchDrawNo(e.target.value)}
            style={{ width: '120px' }}
          />
          <button
            className="admin__btn admin__btn--primary"
            onClick={handleTriggerMatch}
            disabled={matching}
          >
            {matching ? '매칭 중...' : '매칭 실행'}
          </button>
        </div>
      </div>

      {matchStatus && (
        <div className="admin__section">
          <h3>매칭 현황</h3>
          <div className="admin__stats-grid">
            <div className="admin__stat-card">
              <h4>총 추천 로그</h4>
              <p className="admin__stat-value">{matchStatus.total_logs}건</p>
            </div>
            <div className="admin__stat-card">
              <h4>매칭 완료</h4>
              <p className="admin__stat-value">{matchStatus.matched_logs}건</p>
            </div>
            <div className="admin__stat-card">
              <h4>미매칭</h4>
              <p className="admin__stat-value">{matchStatus.pending_logs}건</p>
            </div>
          </div>

          {matchStatus.pending_by_draw && matchStatus.pending_by_draw.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h4>회차별 미매칭 현황</h4>
              <table className="admin__table">
                <thead>
                  <tr>
                    <th>회차</th>
                    <th>미매칭 건수</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {matchStatus.pending_by_draw.map((item) => (
                    <tr key={item.draw_no}>
                      <td>{item.draw_no}회</td>
                      <td>{item.count}건</td>
                      <td>
                        <button
                          className="admin__btn admin__btn--small"
                          onClick={() => {
                            setMatchDrawNo(String(item.draw_no))
                          }}
                        >
                          선택
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="admin__section" style={{ marginTop: '30px' }}>
        <h3>추천 로그 관리</h3>
        <div className="admin__toolbar">
          <input
            type="number"
            placeholder="사용자 ID"
            value={logFilter.user_id}
            onChange={(e) => setLogFilter({ ...logFilter, user_id: e.target.value })}
            style={{ width: '100px' }}
          />
          <input
            type="number"
            placeholder="회차 번호"
            value={logFilter.target_draw_no}
            onChange={(e) => setLogFilter({ ...logFilter, target_draw_no: e.target.value })}
            style={{ width: '100px' }}
          />
          <button className="admin__btn" onClick={searchLogs}>검색</button>
        </div>

        {recommendLogs && (
          <>
            <table className="admin__table" style={{ marginTop: '15px' }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>사용자</th>
                  <th>회차</th>
                  <th>추천번호</th>
                  <th>결과</th>
                  <th>매칭</th>
                  <th>추천일시</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {recommendLogs.logs.length === 0 ? (
                  <EmptyTableRow colSpan={8} message="추천 로그가 없습니다." />
                ) : (
                  recommendLogs.logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.id}</td>
                      <td>{log.user_id}</td>
                      <td>{log.target_draw_no}회</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {editingLog === log.id ? (
                          <textarea
                            value={editForm.lines}
                            onChange={(e) => setEditForm({ ...editForm, lines: e.target.value })}
                            style={{ width: '100%', minHeight: '60px' }}
                          />
                        ) : (
                          <span title={log.lines || ''}>{log.lines ? log.lines.substring(0, 50) + '...' : '-'}</span>
                        )}
                      </td>
                      <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {editingLog === log.id ? (
                          <textarea
                            value={editForm.match_results}
                            onChange={(e) => setEditForm({ ...editForm, match_results: e.target.value })}
                            style={{ width: '100%', minHeight: '60px' }}
                          />
                        ) : (
                          <span title={log.match_results || '-'}>{log.match_results ? log.match_results.substring(0, 30) + '...' : '-'}</span>
                        )}
                      </td>
                      <td>
                        {editingLog === log.id ? (
                          <select
                            value={editForm.is_matched ? 'true' : 'false'}
                            onChange={(e) => setEditForm({ ...editForm, is_matched: e.target.value === 'true' })}
                          >
                            <option value="false">N</option>
                            <option value="true">Y</option>
                          </select>
                        ) : (
                          log.is_matched ? 'Y' : 'N'
                        )}
                      </td>
                      <td>{formatDate(log.recommend_time)}</td>
                      <td>
                        {editingLog === log.id ? (
                          <>
                            <button className="admin__btn admin__btn--primary admin__btn--small" onClick={() => saveEditLog(log.id)}>
                              저장
                            </button>
                            <button className="admin__btn admin__btn--small" onClick={cancelEditLog} style={{ marginLeft: '4px' }}>
                              취소
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="admin__btn admin__btn--small" onClick={() => startEditLog(log)}>
                              편집
                            </button>
                            <button
                              className="admin__btn admin__btn--danger admin__btn--small"
                              onClick={() => handleDeleteRecommendLog(log.id)}
                              style={{ marginLeft: '4px' }}
                            >
                              삭제
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <AdminPagination
              page={recommendLogs.page}
              total={recommendLogs.total}
              pageSize={recommendLogs.page_size}
              onPageChange={(p) => loadRecommendLogs(p, logFilter)}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default MatchingTab
