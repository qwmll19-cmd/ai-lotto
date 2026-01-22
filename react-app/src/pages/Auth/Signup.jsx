import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNotification } from '../../context/NotificationContext.jsx'
import { useOAuthError } from '../../hooks/useOAuthError.js'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

// 아이디 형식 검증 (영문, 숫자, 언더스코어만, 3~10자)
const isValidId = (value) => /^[a-zA-Z0-9_]{3,10}$/.test(value)

// 전화번호 형식 검증 (숫자만)
const isPhone = (value) => {
  const digits = value.replace(/\D/g, '')
  return /^01[016789]\d{7,8}$/.test(digits)
}

function Signup() {
  const { error: showError, success } = useNotification()
  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [phone, setPhone] = useState('')
  const [consentTerms, setConsentTerms] = useState(false)
  const [consentMarketing, setConsentMarketing] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  // SMS 인증 관련 상태
  const [smsCode, setSmsCode] = useState('')
  const [smsSent, setSmsSent] = useState(false)
  const [smsVerified, setSmsVerified] = useState(false)
  const [smsVerifiedToken, setSmsVerifiedToken] = useState('')
  const [smsLoading, setSmsLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const phoneDigits = phone.replace(/\D/g, '')
  const isPhoneValid = isPhone(phone)

  // OAuth 에러 처리
  useOAuthError(showError, '/signup', '회원가입 실패')

  // 카운트다운 타이머
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // 전화번호 변경 시 SMS 인증 상태 초기화
  useEffect(() => {
    setSmsSent(false)
    setSmsVerified(false)
    setSmsVerifiedToken('')
    setSmsCode('')
  }, [phone])

  // 인증하기 버튼 클릭 (임시: SMS 연동 전까지 바로 인증완료 처리)
  const handleVerifyPhone = () => {
    if (!isPhoneValid) {
      setMessage('올바른 휴대폰 번호를 입력해주세요.')
      return
    }

    // TODO: SMS 연동 후 실제 인증 로직으로 변경
    setSmsVerified(true)
    setSmsVerifiedToken('temp_token_' + phoneDigits) // 임시 토큰
    success('휴대폰 인증이 완료되었습니다.')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')

    if (!consentTerms) {
      setMessage('필수 약관에 동의해야 합니다.')
      return
    }
    if (!name.trim()) {
      setMessage('이름을 입력해주세요.')
      return
    }
    if (name.trim().length < 2) {
      setMessage('이름은 2자 이상이어야 합니다.')
      return
    }
    if (!identifier.trim()) {
      setMessage('아이디를 입력해주세요.')
      return
    }
    if (!isValidId(identifier.trim())) {
      setMessage('아이디는 영문, 숫자, 언더스코어(_)만 사용 가능하며 3~10자여야 합니다.')
      return
    }
    if (!password) {
      setMessage('비밀번호를 입력해주세요.')
      return
    }
    if (password.length < 6) {
      setMessage('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (password !== confirm) {
      setMessage('비밀번호가 일치하지 않습니다.')
      return
    }
    if (!isPhoneValid) {
      setMessage('올바른 휴대폰 번호를 입력해주세요.')
      return
    }
    if (!smsVerified) {
      setMessage('휴대폰 인증을 먼저 완료해주세요.')
      return
    }

    setLoading(true)
    const result = await signup({
      name: name.trim(),
      identifier: identifier.trim(),
      password,
      phone: phoneDigits,
      sms_verified_token: smsVerifiedToken,
    })
    setLoading(false)

    if (!result.ok) {
      setMessage(result.message || '회원가입에 실패했습니다.')
      return
    }
    success('회원가입이 완료되었습니다!', '환영합니다')
    navigate('/mypage')
  }

  // 카운트다운 포맷 (mm:ss)
  const formatCountdown = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="page auth-page auth-page--centered">
      <div className="auth-card auth-card--centered">
        <h2>회원가입</h2>
        <p>간단한 정보만 입력하면 바로 시작할 수 있습니다.</p>

        <div className="auth-benefits">
          <div className="auth-benefits__item">
            <span className="auth-benefits__check">✓</span>
            <span>매주 AI 추천 번호 1줄 무료 제공</span>
          </div>
          <div className="auth-benefits__item">
            <span className="auth-benefits__check">✓</span>
            <span>기본 통계 조회 및 히스토리 14일 보관</span>
          </div>
          <div className="auth-benefits__item">
            <span className="auth-benefits__check">✓</span>
            <span>자동 결제 없이 안심 이용</span>
          </div>
        </div>

        {!showForm && (
          <div className="social-login-buttons">
            <button
              type="button"
              className="btn btn--primary btn--full"
              onClick={() => setShowForm(true)}
            >
              간편가입
            </button>
            <a
              href={`${API_BASE}/auth/naver`}
              className="btn btn--social btn--naver btn--full"
            >
              <svg className="social-icon" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.5 10.5L6.24 2H2v16h4.5v-8.5L13.76 18H18V2h-4.5v8.5z"/>
              </svg>
              네이버로 시작하기
            </a>
            <a
              href={`${API_BASE}/auth/kakao`}
              className="btn btn--social btn--kakao btn--full"
            >
              <svg className="social-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.86 5.33 4.64 6.74l-.96 3.57c-.07.26.21.47.44.33l4.26-2.83c.53.06 1.07.09 1.62.09 5.52 0 10-3.58 10-8S17.52 3 12 3z"/>
              </svg>
              카카오로 시작하기
            </a>
          </div>
        )}

        {showForm && (
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form__field">
            <label htmlFor="name">이름</label>
            <input
              id="name"
              type="text"
              placeholder="실명을 입력하세요"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
            />
          </div>

          <div className="auth-form__field">
            <label htmlFor="identifier">아이디</label>
            <input
              id="identifier"
              type="text"
              placeholder="영문, 숫자, 언더스코어 3~10자"
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
              placeholder="6자 이상 입력하세요"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="auth-form__field">
            <label htmlFor="confirm">비밀번호 확인</label>
            <input
              id="confirm"
              type="password"
              placeholder="비밀번호를 다시 입력하세요"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="auth-form__field">
            <label htmlFor="phone">휴대폰 번호</label>
            <div className="auth-form__input-group">
              <input
                id="phone"
                type="tel"
                placeholder="01012345678"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))}
                autoComplete="tel"
                disabled={smsVerified}
                maxLength={11}
              />
              {!smsVerified && (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={handleVerifyPhone}
                  disabled={!isPhoneValid}
                >
                  인증하기
                </button>
              )}
              {smsVerified && (
                <span className="auth-form__verified">인증완료</span>
              )}
            </div>
          </div>

          <div className="auth-form__consents">
            <label className="auth-form__consent">
              <input
                type="checkbox"
                checked={consentTerms}
                onChange={(event) => setConsentTerms(event.target.checked)}
              />
              <span>
                <Link to="/terms" target="_blank">이용약관</Link> 및{' '}
                <Link to="/privacy" target="_blank">개인정보처리방침</Link>에 동의합니다 (필수)
              </span>
            </label>
            <label className="auth-form__consent">
              <input
                type="checkbox"
                checked={consentMarketing}
                onChange={(event) => setConsentMarketing(event.target.checked)}
              />
              <span>광고/마케팅 정보 수신에 동의합니다 (선택)</span>
            </label>
          </div>

          {message && <p className="auth-form__error">{message}</p>}

          <button className="btn btn--primary btn--full btn--lg" type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                가입 중...
              </>
            ) : (
              '무료로 시작하기'
            )}
          </button>

          <button
            type="button"
            className="btn btn--ghost btn--full"
            onClick={() => setShowForm(false)}
          >
            뒤로가기
          </button>
        </form>
        )}

        <div className="auth-card__signup">
          이미 계정이 있으신가요?{' '}
          <Link to="/login">로그인</Link>
        </div>
      </div>
    </div>
  )
}

export default Signup
