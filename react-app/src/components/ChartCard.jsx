function ChartCard({ title, note, variant = 'primary', children }) {
  const className = `chart-card chart-card--${variant}`

  return (
    <div className={className}>
      {title ? <strong>{title}</strong> : null}
      {children}
      {note ? <small>{note}</small> : null}
    </div>
  )
}

export default ChartCard
