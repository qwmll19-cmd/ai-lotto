import { useNotification } from '../context/NotificationContext.jsx'

function Toast() {
  const { notifications, removeNotification } = useNotification()

  // 최근 5개만 표시
  const visibleNotifications = notifications.slice(0, 5)

  if (visibleNotifications.length === 0) return null

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        )
      case 'error':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        )
      case 'warning':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        )
    }
  }

  return (
    <div className="toast-container">
      {visibleNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`toast toast--${notification.type}`}
          role="alert"
        >
          <div className="toast__icon">{getIcon(notification.type)}</div>
          <div className="toast__content">
            {notification.title && <strong className="toast__title">{notification.title}</strong>}
            <p className="toast__message">{notification.message}</p>
          </div>
          <button
            type="button"
            className="toast__close"
            onClick={() => removeNotification(notification.id)}
            aria-label="닫기"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

export default Toast
