import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNotification } from '../../context/NotificationContext.jsx'
import { useOAuthError } from '../../hooks/useOAuthError.js'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, isAuthed, authLoading } = useAuth()
  const { success, error: showError } = useNotification()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from?.pathname || '/mypage'

  // 이미 로그인된 사용자는 리다이렉트
  useEffect(() => {
    if (!authLoading && isAuthed) {
      navigate(redirectTo, { replace: true })
    }
  }, [isAuthed, authLoading, navigate, redirectTo])

  // OAuth 에러 처리
  useOAuthError(showError, '/login', '로그인 실패')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!identifier.trim() || !password) {
      setMessage('아이디와 비밀번호를 입력해주세요.')
      return
    }
    setLoading(true)
    setMessage('')
    const result = await login({ identifier: identifier.trim(), password })
    setLoading(false)
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    setMessage('')
    success('로그인되었습니다!', '환영합니다')
    navigate(redirectTo)
  }

  return (
    <div className="page auth-page auth-page--centered">
      <div className="auth-card auth-card--centered">
        <h2>로그인</h2>
        <p>이메일 또는 휴대폰 번호로 로그인하세요.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form__field">
            <label htmlFor="identifier">이메일 또는 휴대폰</label>
            <input
              id="identifier"
              type="text"
              placeholder="example@email.com"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="auth-form__field">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>

          {message && <p className="auth-form__error">{message}</p>}

          <button className="btn btn--primary btn--full btn--lg" type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                로그인 중...
              </>
            ) : (
              '로그인'
            )}
          </button>
        </form>

        <div className="auth-card__divider">
          <span>또는</span>
        </div>

        <div className="social-login-buttons">
          <a
            href={`${API_BASE}/auth/naver`}
            className="btn btn--social btn--naver btn--full"
          >
            <svg className="social-icon" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.5 10.5L6.24 2H2v16h4.5v-8.5L13.76 18H18V2h-4.5v8.5z"/>
            </svg>
            네이버로 로그인
          </a>
          <a
            href={`${API_BASE}/auth/kakao`}
            className="btn btn--social btn--kakao btn--full"
          >
            <svg className="social-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.86 5.33 4.64 6.74l-.96 3.57c-.07.26.21.47.44.33l4.26-2.83c.53.06 1.07.09 1.62.09 5.52 0 10-3.58 10-8S17.52 3 12 3z"/>
            </svg>
            카카오로 로그인
          </a>
        </div>

        <div className="auth-card__links">
          <Link to="/forgot-password" className="auth-card__forgot">비밀번호를 잊으셨나요?</Link>
        </div>

        <div className="auth-card__signup">
          아직 계정이 없으신가요?{' '}
          <Link to="/signup">회원가입</Link>
        </div>
      </div>
    </div>
  )
}

export default Login
