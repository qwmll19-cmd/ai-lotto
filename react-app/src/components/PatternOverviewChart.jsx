import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

function PatternOverviewChart({ data }) {
  const chartData = data.map((item) => ({
    name: item.title,
    value: item.numeric_value ?? 0,
  }))

  return (
    <div className="chart-canvas">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} barSize={20}>
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: 'rgba(255, 79, 139, 0.08)' }} />
          <Bar dataKey="value" fill="#ff9bb9" radius={[10, 10, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default PatternOverviewChart
