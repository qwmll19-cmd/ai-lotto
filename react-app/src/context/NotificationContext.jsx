import { createContext, useContext, useState, useCallback, useMemo } from 'react'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([])

  // 알림 제거
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  // 알림 추가
  const addNotification = useCallback((notification) => {
    const id = Date.now()
    const newNotification = {
      id,
      type: 'info', // info, success, warning, error
      title: '',
      message: '',
      read: false,
      createdAt: new Date().toISOString(),
      ...notification,
    }
    setNotifications(prev => [newNotification, ...prev])

    // 자동 제거 (토스트 알림의 경우)
    if (notification.autoClose !== false) {
      setTimeout(() => {
        removeNotification(id)
      }, notification.duration || 5000)
    }

    return id
  }, [removeNotification])

  // 알림 읽음 처리
  const markAsRead = useCallback((id) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  // 모든 알림 읽음 처리
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  // 모든 알림 삭제
  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  // 읽지 않은 알림 수
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length
  }, [notifications])

  // 편의 메서드
  const success = useCallback((message, title = '성공') => {
    return addNotification({ type: 'success', title, message })
  }, [addNotification])

  const error = useCallback((message, title = '오류') => {
    return addNotification({ type: 'error', title, message })
  }, [addNotification])

  const warning = useCallback((message, title = '주의') => {
    return addNotification({ type: 'warning', title, message })
  }, [addNotification])

  const info = useCallback((message, title = '알림') => {
    return addNotification({ type: 'info', title, message })
  }, [addNotification])

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    success,
    error,
    warning,
    info,
  }), [
    notifications,
    unreadCount,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    success,
    error,
    warning,
    info,
  ])

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}
