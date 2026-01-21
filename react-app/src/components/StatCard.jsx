function StatCard({ title, value, hint }) {
  return (
    <div className="stat-card">
      <h3>{title}</h3>
      <strong>{value}</strong>
      {hint ? <span>{hint}</span> : null}
    </div>
  )
}

export default StatCard
