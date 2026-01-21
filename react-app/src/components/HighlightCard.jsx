function HighlightCard({ title, value, trend }) {
  return (
    <div className="highlight-card">
      <p>{title}</p>
      <strong>{value}</strong>
      <span>{trend}</span>
    </div>
  )
}

export default HighlightCard
