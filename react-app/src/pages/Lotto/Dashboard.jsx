import { useEffect, useState } from 'react'
import {
  dashboardHighlights,
  dashboardSummary,
  statsPatterns,
  statsTopNumbers,
} from '../../data/mockData.js'
import {
  fetchDashboardHighlights,
  fetchDashboardSummary,
  fetchStatsPatterns,
  fetchStatsTopNumbers,
} from '../../api/lottoApi.js'
import ChartCard from '../../components/ChartCard.jsx'
import HighlightCard from '../../components/HighlightCard.jsx'
import StatCard from '../../components/StatCard.jsx'
import NumberFrequencyChart from '../../components/NumberFrequencyChart.jsx'
import PatternOverviewChart from '../../components/PatternOverviewChart.jsx'

function Dashboard() {
  const [summary, setSummary] = useState(dashboardSummary)
  const [highlights, setHighlights] = useState(dashboardHighlights)
  const [topNumbers, setTopNumbers] = useState(statsTopNumbers)
  const [patterns, setPatterns] = useState(statsPatterns)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setLoadError(null)
        const [summaryData, highlightData, numbersData, patternsData] = await Promise.all([
          fetchDashboardSummary(),
          fetchDashboardHighlights(),
          fetchStatsTopNumbers(),
          fetchStatsPatterns(),
        ])
        if (!active) return
        setSummary(summaryData.items || dashboardSummary)
        setHighlights(highlightData.items || dashboardHighlights)
        setTopNumbers(numbersData.items || statsTopNumbers)
        setPatterns(patternsData.items || statsPatterns)
      } catch (err) {
        console.error('Dashboard 데이터 로드 실패:', err)
        if (!active) return
        setLoadError('데이터를 불러오는데 실패했습니다. 기본 데이터를 표시합니다.')
        setSummary(dashboardSummary)
        setHighlights(dashboardHighlights)
        setTopNumbers(statsTopNumbers)
        setPatterns(statsPatterns)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  return (
    <section className="dashboard">
      <div className="page-head">
        <h1>AI 통계 대시보드</h1>
        <p>누적 회차 요약과 최근 패턴 통계를 한눈에 확인합니다.</p>
      </div>
      {loadError && (
        <div className="dashboard__error" style={{ padding: '12px', marginBottom: '16px', background: '#fff3cd', borderRadius: '8px', color: '#856404' }}>
          {loadError}
        </div>
      )}
      <div className="stat-grid">
        {summary.map((card) => (
          <StatCard key={card.id} title={card.title} value={card.value} hint={card.hint} />
        ))}
      </div>
      <div className="dashboard__charts">
        <ChartCard title="번호별 출현 빈도" note="최근 200회 기준 상위 번호">
          <NumberFrequencyChart data={topNumbers} />
        </ChartCard>
        <ChartCard title="합계/구간/홀짝 패턴 요약" note="최근 100회 패턴">
          <PatternOverviewChart data={patterns} />
        </ChartCard>
      </div>
      <div className="dashboard__highlights">
        {highlights.map((item) => (
          <HighlightCard key={item.id} title={item.title} value={item.value} trend={item.trend} />
        ))}
      </div>
    </section>
  )
}

export default Dashboard
