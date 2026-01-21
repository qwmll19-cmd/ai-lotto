import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

function NumberFrequencyChart({ data }) {
  const chartData = data.map((item) => ({
    name: String(item.number),
    count: item.count,
  }))

  return (
    <div className="chart-canvas">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} barSize={24}>
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: 'rgba(255, 79, 139, 0.08)' }} />
          <Bar dataKey="count" fill="#ff4f8b" radius={[10, 10, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default NumberFrequencyChart
