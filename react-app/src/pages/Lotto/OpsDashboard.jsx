import { useEffect, useMemo, useState } from 'react'
import { fetchHealth, fetchOpsMetrics, fetchOpsSummary } from '../../api/opsApi.js'
import StatCard from '../../components/StatCard.jsx'

const emptySummary = {
  applications: {
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    last_24h: 0,
    last_7d: 0,
    latest_created_at: null,
  },
  recommend_logs: {
    total: 0,
  },
  latest_applications: [],
}

function formatDate(value) {
  if (!value) return '데이터 없음'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

function OpsDashboard() {
  const [summary, setSummary] = useState(emptySummary)
  const [health, setHealth] = useState('확인 중')
  const [error, setError] = useState('')
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const [healthData, opsData, metricsData] = await Promise.all([
          fetchHealth(),
          fetchOpsSummary(),
          fetchOpsMetrics(),
        ])
        if (!active) return
        setHealth(healthData?.status === 'ok' ? '정상' : '확인 필요')
        setSummary(opsData)
        setMetrics(metricsData)
        setError('')
      } catch (err) {
        if (!active) return
        if (err?.status === 401) {
          setError('로그인이 필요합니다. 관리자 계정으로 로그인해 주세요.')
        } else if (err?.status === 403) {
          setError('관리자 권한이 필요합니다. 권한이 있는 계정으로 로그인해 주세요.')
        } else {
          setError('운영 지표를 불러오지 못했습니다.')
        }
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const stats = useMemo(() => {
    const total = summary.applications?.total || 0
    const sent = summary.applications?.sent || 0
    const failed = summary.applications?.failed || 0
    const pending = summary.applications?.pending || 0
    const last24h = summary.applications?.last_24h || 0
    const last7d = summary.applications?.last_7d || 0
    const successRate = total ? Math.round((sent / total) * 100) : 0
    const failRate = total ? Math.round((failed / total) * 100) : 0
    return [
      { id: 'apps-total', title: '무료 체험 신청', value: `${total}건`, hint: '누적 신청 수' },
      { id: 'apps-sent', title: '발송 성공', value: `${sent}건`, hint: `성공률 ${successRate}%` },
      { id: 'apps-failed', title: '발송 실패', value: `${failed}건`, hint: `실패율 ${failRate}%` },
      { id: 'apps-pending', title: '대기 중', value: `${pending}건`, hint: '미발송' },
      { id: 'apps-24h', title: '최근 24시간', value: `${last24h}건`, hint: '신청 유입' },
      { id: 'apps-7d', title: '최근 7일', value: `${last7d}건`, hint: '신청 유입' },
      {
        id: 'apps-latest',
        title: '최근 신청',
        value: formatDate(summary.applications?.latest_created_at),
        hint: '가장 최근 신청 시각',
      },
      {
        id: 'logs-total',
        title: '추천 로그',
        value: `${summary.recommend_logs?.total || 0}건`,
        hint: '추천 생성 누적',
      },
    ]
  }, [summary])

  return (
    <section className="ops">
      <div className="page-head">
        <h1>운영 대시보드</h1>
        <p>운영 지표와 시스템 상태를 한눈에 확인합니다.</p>
      </div>
      <div className="ops__status">
        <span className="ops__status-label">API 상태</span>
        <span className={`ops__status-pill ${health === '정상' ? 'ok' : 'warn'}`}>
          {health}
        </span>
      </div>
      {error ? (
        <div className="ops__error">{error}</div>
      ) : (
        <>
          <div className="stat-grid ops__grid">
            {stats.map((card) => (
              <StatCard key={card.id} title={card.title} value={card.value} hint={card.hint} />
            ))}
          </div>
          <div className="ops__latest">
            <h2>최근 신청 내역</h2>
            {summary.latest_applications?.length ? (
              <ul>
                {summary.latest_applications.map((item, index) => (
                  <li key={`${item.phone}-${index}`}>
                    <span>{item.name}</span>
                    <span>{item.phone}</span>
                    <span>{item.status}</span>
                    <span>{formatDate(item.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ops__latest-empty">최근 신청 내역이 없습니다.</p>
            )}
          </div>
          <div className="ops__metrics">
            <h2>최근 24시간 요청 지표</h2>
            <div className="ops__metrics-grid">
              <div>
                <strong>{metrics?.totals?.requests ?? 0}</strong>
                <span>요청 수</span>
              </div>
              <div>
                <strong>{metrics?.totals?.errors ?? 0}</strong>
                <span>에러 수</span>
              </div>
              <div>
                <strong>{metrics?.totals?.error_rate ?? 0}%</strong>
                <span>에러율</span>
              </div>
              <div>
                <strong>{metrics?.totals?.avg_ms ?? 0}ms</strong>
                <span>평균 응답</span>
              </div>
              <div>
                <strong>{metrics?.totals?.p95_ms ?? 0}ms</strong>
                <span>p95 응답</span>
              </div>
            </div>
            <div className="ops__metrics-split">
              <div>
                <h3>상위 요청 경로</h3>
                <ul>
                  {(metrics?.top_paths || []).map((item, index) => (
                    <li key={`${item.path}-${index}`}>
                      <span>{item.method} {item.path}</span>
                      <strong>{item.count}</strong>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>최근 에러</h3>
                <ul>
                  {(metrics?.recent_errors || []).map((item, index) => (
                    <li key={`${item.path}-${index}`}>
                      <span>{item.method} {item.path}</span>
                      <strong>{item.status}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
      <p className="ops__note">
        운영 데이터는 관리자 전용입니다. 필요한 경우 접근 권한을 추가 설정하세요.
      </p>
    </section>
  )
}

export default OpsDashboard
