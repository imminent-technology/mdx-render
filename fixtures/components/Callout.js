export function Callout({ type = 'info', children }) {
  const colors = {
    info: { bg: '#e0f2fe', border: '#0284c7', icon: 'ℹ️' },
    warning: { bg: '#fef9c3', border: '#ca8a04', icon: '⚠️' },
    danger: { bg: '#fee2e2', border: '#dc2626', icon: '🚨' },
  }
  const { bg, border, icon } = colors[type] ?? colors.info
  return (
    <div
      style={{
        background: bg,
        borderLeft: `4px solid ${border}`,
        padding: '12px 16px',
        borderRadius: '4px',
        fontFamily: 'sans-serif',
        margin: '16px 0',
      }}
    >
      {icon} {children}
    </div>
  )
}
