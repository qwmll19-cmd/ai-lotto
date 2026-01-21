import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotification } from '../context/NotificationContext.jsx'

function Header() {
  const { isAuthed, isAdmin, user, logout, authLoading } = useAuth()
  const { notifications, unreadCount, markAllAsRead } = useNotification()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const profileRef = useRef(null)
  const notificationRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false)
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 사용자 이니셜 (첫 글자) 또는 이름에서 추출
  const getInitial = () => {
    if (user?.name) return user.name.charAt(0).toUpperCase()
    if (user?.identifier) return user.identifier.charAt(0).toUpperCase()
    return null
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault()
            if (location.pathname === '/') {
              // 이미 홈페이지에 있으면 상단으로 스크롤
              window.scrollTo({ top: 0, behavior: 'smooth' })
            } else {
              // 다른 페이지에서는 홈으로 이동
              navigate('/')
            }
          }}
        >
          <span className="brand__mark">팡팡</span>
          <span className="brand__text">
            <span className="brand__title">팡팡로또</span>
            <span className="brand__subtitle">AI 데이터 기반 로또 번호 추천</span>
          </span>
        </a>
        <nav className="site-nav">
          <Link className="site-nav__link site-nav__link--primary" to="/recommend">번호 추천</Link>
          <a
            className="site-nav__link"
            href="/#why"
            onClick={(e) => {
              e.preventDefault()
              const scrollToWhy = () => {
                const element = document.getElementById('why')
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }

              if (location.pathname === '/') {
                // 이미 홈페이지에 있으면 직접 스크롤
                scrollToWhy()
              } else {
                // 다른 페이지에서는 홈으로 이동 후 스크롤
                navigate('/')
                // 페이지 로딩 완료 대기 (최대 500ms, 50ms 간격 체크)
                let attempts = 0
                const maxAttempts = 10
                const checkAndScroll = () => {
                  const element = document.getElementById('why')
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  } else if (attempts < maxAttempts) {
                    attempts++
                    setTimeout(checkAndScroll, 50)
                  }
                }
                setTimeout(checkAndScroll, 50)
              }
            }}
          >AI 시스템</a>
          <Link className="site-nav__link" to="/stats">통계</Link>
          <Link className="site-nav__link" to="/history">히스토리</Link>
          <Link className="site-nav__link" to="/pricing">요금제</Link>
          <Link className="site-nav__link" to="/support">고객센터</Link>
          {isAdmin && <Link className="site-nav__link site-nav__link--admin" to="/admin">관리자</Link>}

          {authLoading ? (
            <div className="site-nav__auth">
              <span className="site-nav__loading">...</span>
            </div>
          ) : isAuthed ? (
            <div className="site-nav__user-area">
              {/* 알림 아이콘 */}
              <div className="notification-wrapper" ref={notificationRef}>
                <button
                  className="notification-btn"
                  type="button"
                  onClick={() => setShowNotifications(!showNotifications)}
                  aria-label="알림"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  )}
                </button>
                {showNotifications && (
                  <div className="notification-dropdown">
                    <div className="notification-dropdown__header">
                      <span>알림</span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          className="notification-dropdown__mark-all"
                          onClick={() => markAllAsRead()}
                        >
                          모두 읽음
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="notification-dropdown__empty">
                        새로운 알림이 없습니다.
                      </div>
                    ) : (
                      <div className="notification-dropdown__list">
                        {notifications.slice(0, 5).map((notification) => (
                          <div
                            key={notification.id}
                            className={`notification-dropdown__item ${!notification.read ? 'notification-dropdown__item--unread' : ''}`}
                          >
                            <div className={`notification-dropdown__icon notification-dropdown__icon--${notification.type}`}>
                              {notification.type === 'success' && '✓'}
                              {notification.type === 'error' && '✕'}
                              {notification.type === 'warning' && '!'}
                              {notification.type === 'info' && 'i'}
                            </div>
                            <div className="notification-dropdown__content">
                              {notification.title && <strong>{notification.title}</strong>}
                              <p>{notification.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 프로필 드롭다운 */}
              <div className="profile-wrapper" ref={profileRef}>
                <button
                  className="profile-btn"
                  type="button"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                >
                  <span className="profile-avatar">
                    {getInitial() || (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    )}
                  </span>
                  <svg className="profile-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {showProfileMenu && (
                  <div className="profile-dropdown">
                    <div className="profile-dropdown__header">
                      <span className="profile-dropdown__name">{user?.name || user?.identifier}</span>
                      <span className="profile-dropdown__plan">{user?.tier || 'Free'} 플랜</span>
                    </div>
                    <div className="profile-dropdown__divider" />
                    <Link to="/recommend" className="profile-dropdown__item profile-dropdown__item--primary" onClick={() => setShowProfileMenu(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      번호 받기
                    </Link>
                    <Link to="/mypage?tab=lines" className="profile-dropdown__item" onClick={() => setShowProfileMenu(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                      내 조합
                    </Link>
                    <Link to="/mypage?tab=account" className="profile-dropdown__item" onClick={() => setShowProfileMenu(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      계정 설정
                    </Link>
                    <Link to="/mypage?tab=subscription" className="profile-dropdown__item" onClick={() => setShowProfileMenu(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                        <line x1="1" y1="10" x2="23" y2="10" />
                      </svg>
                      플랜 관리
                    </Link>
                    <Link to="/mypage?tab=notifications" className="profile-dropdown__item" onClick={() => setShowProfileMenu(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                      알림 설정
                    </Link>
                    <div className="profile-dropdown__divider" />
                    <button
                      type="button"
                      className="profile-dropdown__item profile-dropdown__item--logout"
                      onClick={() => { logout(); setShowProfileMenu(false); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="site-nav__auth">
              <Link to="/login" className="site-nav__auth-link">로그인</Link>
              <Link to="/signup" className="site-nav__auth-btn">회원가입</Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Header
