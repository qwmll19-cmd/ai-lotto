/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { request, getAccessToken } from '../api/client.js'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  // 토스트: 화면에 잠시 표시되는 알림 (자동 삭제)
  const [toasts, setToasts] = useState([])

  // 영구 알림: 서버 DB에서 관리
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  // 중복 요청 방지
  const fetchingRef = useRef(false)

  // 서버에서 알림 목록 가져오기
  const fetchNotifications = useCallback(async () => {
    const token = getAccessToken()
    if (!token || fetchingRef.current) return

    fetchingRef.current = true
    setIsLoading(true)

    try {
      const data = await request('/api/notification/in-app?limit=20')
      if (data.success) {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
      }
    } catch (err) {
      // 401은 무시 (로그아웃 상태)
      if (err.status !== 401) {
        console.error('Failed to fetch notifications:', err)
      }
    } finally {
      setIsLoading(false)
      fetchingRef.current = false
    }
  }, [])

  // 로그인 상태 변경 시 알림 새로고침
  useEffect(() => {
    const token = getAccessToken()
    if (token) {
      fetchNotifications()
    } else {
      // 로그아웃 시 초기화
      setNotifications([])
      setUnreadCount(0)
    }
  }, [fetchNotifications])

  // 토큰 변경 감지 (로그인/로그아웃) - storage 이벤트 + 커스텀 이벤트
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'ai_lotto_tokens') {
        const token = getAccessToken()
        if (token) {
          fetchNotifications()
        } else {
          setNotifications([])
          setUnreadCount(0)
        }
      }
    }

    // 커스텀 이벤트 리스너 (같은 탭에서의 로그인/로그아웃 감지)
    const handleAuthChange = (e) => {
      if (e.detail?.type === 'login') {
        fetchNotifications()
      } else if (e.detail?.type === 'logout') {
        setNotifications([])
        setUnreadCount(0)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('auth-change', handleAuthChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('auth-change', handleAuthChange)
    }
  }, [fetchNotifications])

  // 토스트 제거
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // 영구 알림 제거 (서버 삭제)
  const removeNotification = useCallback(async (id) => {
    const token = getAccessToken()
    if (!token) return

    try {
      await request(`/api/notification/in-app/${id}`, { method: 'DELETE' })
      setNotifications(prev => prev.filter(n => n.id !== id))
      // unreadCount 업데이트
      const removed = notifications.find(n => n.id === id)
      if (removed && !removed.read) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (err) {
      console.error('Failed to remove notification:', err)
    }
  }, [notifications])

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

  // 영구 알림 추가 (서버 저장)
  const addNotification = useCallback(async (notification) => {
    const token = getAccessToken()

    // 로그인하지 않은 경우 로컬에서만 처리
    if (!token) {
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
      setUnreadCount(prev => prev + 1)
      return id
    }

    try {
      const data = await request('/api/notification/in-app', {
        method: 'POST',
        body: JSON.stringify({
          notification_type: notification.type || 'info',
          title: notification.title || null,
          message: notification.message || '',
        }),
      })

      if (data.success && data.notification) {
        setNotifications(prev => [data.notification, ...prev].slice(0, 20))
        setUnreadCount(prev => prev + 1)
        return data.notification.id
      }
    } catch (err) {
      console.error('Failed to add notification:', err)
    }

    return null
  }, [])

  // 토스트 + 영구 알림 동시 추가 (중요한 알림용)
  const addBoth = useCallback((notification) => {
    addToast(notification)
    return addNotification(notification)
  }, [addToast, addNotification])

  // 알림 읽음 처리 (서버 업데이트)
  const markAsRead = useCallback(async (id) => {
    const token = getAccessToken()
    if (!token) {
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
      return
    }

    try {
      await request('/api/notification/in-app/read', {
        method: 'PUT',
        body: JSON.stringify({ notification_ids: [id] }),
      })
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }, [])

  // 모든 알림 읽음 처리 (서버 업데이트)
  const markAllAsRead = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
      return
    }

    try {
      await request('/api/notification/in-app/read-all', { method: 'PUT' })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
    }
  }, [])

  // 모든 알림 삭제 (서버 삭제)
  const clearAll = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    try {
      await request('/api/notification/in-app', { method: 'DELETE' })
      setNotifications([])
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to clear all notifications:', err)
    }
  }, [])

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
    // 영구 알림 (드롭다운용) - 서버 DB 연동
    notifications,
    unreadCount,
    isLoading,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    fetchNotifications, // 수동 새로고침용
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
    isLoading,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    fetchNotifications,
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
