/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'

const NotificationContext = createContext(null)

// localStorage 키
const NOTIFICATIONS_STORAGE_KEY = 'pangpang_notifications'

// localStorage에서 알림 불러오기
function loadNotificationsFromStorage() {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // 최대 20개까지만 유지
      return parsed.slice(0, 20)
    }
  } catch (e) {
    console.error('Failed to load notifications from storage:', e)
  }
  return []
}

// localStorage에 알림 저장
function saveNotificationsToStorage(notifications) {
  try {
    // 최대 20개까지만 저장
    const toSave = notifications.slice(0, 20)
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(toSave))
  } catch (e) {
    console.error('Failed to save notifications to storage:', e)
  }
}

export function NotificationProvider({ children }) {
  // 토스트: 화면에 잠시 표시되는 알림 (자동 삭제)
  const [toasts, setToasts] = useState([])

  // 영구 알림: 드롭다운에 저장되는 알림 (수동 삭제)
  const [notifications, setNotifications] = useState(() => loadNotificationsFromStorage())

  // 영구 알림이 변경될 때 localStorage에 저장
  useEffect(() => {
    saveNotificationsToStorage(notifications)
  }, [notifications])

  // 토스트 제거
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // 영구 알림 제거
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  // 토스트 추가 (화면에 잠시 표시, 자동 사라짐)
  const addToast = useCallback((toast) => {
    const id = Date.now()
    const newToast = {
      id,
      type: 'info',
      title: '',
      message: '',
      createdAt: new Date().toISOString(),
      ...toast,
    }
    setToasts(prev => [newToast, ...prev])

    // 자동 제거
    setTimeout(() => {
      removeToast(id)
    }, toast.duration || 5000)

    return id
  }, [removeToast])

  // 영구 알림 추가 (드롭다운에 저장)
  const addNotification = useCallback((notification) => {
    const id = Date.now()
    const newNotification = {
      id,
      type: 'info',
      title: '',
      message: '',
      read: false,
      createdAt: new Date().toISOString(),
      ...notification,
    }
    setNotifications(prev => [newNotification, ...prev].slice(0, 20))
    return id
  }, [])

  // 토스트 + 영구 알림 동시 추가 (중요한 알림용)
  const addBoth = useCallback((notification) => {
    addToast(notification)
    return addNotification(notification)
  }, [addToast, addNotification])

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

  // 편의 메서드 - 토스트만 (기존 호환)
  const success = useCallback((message, title = '성공') => {
    return addToast({ type: 'success', title, message })
  }, [addToast])

  const error = useCallback((message, title = '오류') => {
    return addToast({ type: 'error', title, message })
  }, [addToast])

  const warning = useCallback((message, title = '주의') => {
    return addToast({ type: 'warning', title, message })
  }, [addToast])

  const info = useCallback((message, title = '알림') => {
    return addToast({ type: 'info', title, message })
  }, [addToast])

  // 편의 메서드 - 영구 알림 + 토스트 동시
  const notifySuccess = useCallback((message, title = '성공') => {
    return addBoth({ type: 'success', title, message })
  }, [addBoth])

  const notifyError = useCallback((message, title = '오류') => {
    return addBoth({ type: 'error', title, message })
  }, [addBoth])

  const notifyWarning = useCallback((message, title = '주의') => {
    return addBoth({ type: 'warning', title, message })
  }, [addBoth])

  const notifyInfo = useCallback((message, title = '알림') => {
    return addBoth({ type: 'info', title, message })
  }, [addBoth])

  const value = useMemo(() => ({
    // 토스트 (화면 표시용)
    toasts,
    addToast,
    removeToast,
    // 영구 알림 (드롭다운용)
    notifications,
    unreadCount,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    // 토스트 + 영구 알림 동시
    addBoth,
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
    // 기존 호환 (토스트만)
    success,
    error,
    warning,
    info,
  }), [
    toasts,
    addToast,
    removeToast,
    notifications,
    unreadCount,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    addBoth,
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
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
