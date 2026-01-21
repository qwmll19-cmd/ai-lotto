import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNotification } from '../../context/NotificationContext.jsx'
import { useOAuthError } from '../../hooks/useOAuthError.js'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

// 이메일 형식 검증
const isEmail = (value) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)

// 전화번호 형식 검증 (숫자만)
const isPhone = (value) => {
  const digits = value.replace(/\D/g, '')
  return /^01[016789]\d{7,8}$/.test(digits)
}

function Signup() {
  const { error: showError, success } = useNotification()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [consentTerms, setConsentTerms] = useState(false)
  const [consentMarketing, setConsentMarketing] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  // SMS 인증 관련 상태
  const [smsCode, setSmsCode] = useState('')
  const [smsSent, setSmsSent] = useState(false)
  const [smsVerified, setSmsVerified] = useState(false)
  const [smsVerifiedToken, setSmsVerifiedToken] = useState('')
  const [smsLoading, setSmsLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // 입력값이 전화번호인지 확인
  const identifierDigits = identifier.replace(/\D/g, '')
  const isPhoneInput = isPhone(identifier)
  const isEmailInput = isEmail(identifier)

  // OAuth 에러 처리
  useOAuthError(showError, '/signup', '회원가입 실패')

  // 카운트다운 타이머
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // identifier 변경 시 SMS 인증 상태 초기화
  useEffect(() => {
    setSmsSent(false)
    setSmsVerified(false)
    setSmsVerifiedToken('')
    setSmsCode('')
  }, [identifier])

  // SMS 인증코드 발송
  const handleSendSms = async () => {
    if (!isPhoneInput) {
      setMessage('올바른 휴대폰 번호를 입력해주세요.')
      return
    }

    setSmsLoading(true)
    setMessage('')

    try {
      const res = await fetch(`${API_BASE}/api/auth/signup/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: identifierDigits }),
      })
      const data = await res.json()

      if (data.sent) {
        setSmsSent(true)
        setCountdown(300) // 5분 카운트다운
        success('인증코드가 발송되었습니다.')
      } else {
        setMessage(data.message || '인증코드 발송에 실패했습니다.')
      }
    } catch {
      setMessage('서버 오류가 발생했습니다.')
    } finally {
      setSmsLoading(false)
    }
  }

  // SMS 인증코드 확인
  const handleVerifySms = async () => {
    if (smsCode.length !== 6) {
      setMessage('6자리 인증코드를 입력해주세요.')
      return
    }

    setSmsLoading(true)
    setMessage('')

    try {
      const res = await fetch(`${API_BASE}/api/auth/signup/verify-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: identifierDigits, code: smsCode }),
      })
      const data = await res.json()

      if (data.verified) {
        setSmsVerified(true)
        setSmsVerifiedToken(data.verified_token)
        success('휴대폰 인증이 완료되었습니다.')
      } else {
        setMessage(data.message || '인증에 실패했습니다.')
      }
    } catch {
      setMessage('서버 오류가 발생했습니다.')
    } finally {
      setSmsLoading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')

    if (!consentTerms) {
      setMessage('필수 약관에 동의해야 합니다.')
      return
    }
    if (!identifier.trim() || !password) {
      setMessage('이메일/휴대폰과 비밀번호를 입력하세요.')
      return
    }

    // 이메일도 전화번호도 아닌 경우
    if (!isEmailInput && !isPhoneInput) {
      setMessage('올바른 이메일 또는 휴대폰 번호를 입력해주세요.')
      return
    }

    // 전화번호인 경우 SMS 인증 필수
    if (isPhoneInput && !smsVerified) {
      setMessage('휴대폰 인증을 먼저 완료해주세요.')
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

    setLoading(true)
    const result = await signup({
      identifier: isPhoneInput ? identifierDigits : identifier.trim(),
      password,
      consentTerms,
      consentMarketing,
      sms_verified_token: isPhoneInput ? smsVerifiedToken : undefined,
    })
    setLoading(false)

    if (result.message && !result.ok) {
      setMessage(result.message)
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

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form__field">
            <label htmlFor="identifier">이메일 또는 휴대폰</label>
            <div className="auth-form__input-group">
              <input
                id="identifier"
                type="text"
                placeholder="example@email.com 또는 01012345678"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                disabled={smsVerified}
              />
              {isPhoneInput && !smsVerified && (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={handleSendSms}
                  disabled={smsLoading || (smsSent && countdown > 0)}
                >
                  {smsLoading ? '발송중...' : smsSent && countdown > 0 ? formatCountdown(countdown) : '인증요청'}
                </button>
              )}
              {smsVerified && (
                <span className="auth-form__verified">인증완료</span>
              )}
            </div>
          </div>

          {/* SMS 인증코드 입력 (전화번호이고 발송됐고 아직 미인증) */}
          {isPhoneInput && smsSent && !smsVerified && (
            <div className="auth-form__field">
              <label htmlFor="smsCode">인증코드</label>
              <div className="auth-form__input-group">
                <input
                  id="smsCode"
                  type="text"
                  placeholder="6자리 인증코드"
                  value={smsCode}
                  onChange={(event) => setSmsCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                />
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={handleVerifySms}
                  disabled={smsLoading || smsCode.length !== 6}
                >
                  {smsLoading ? '확인중...' : '확인'}
                </button>
              </div>
            </div>
          )}

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

        <div className="auth-card__signup">
          이미 계정이 있으신가요?{' '}
          <Link to="/login">로그인</Link>
        </div>
      </div>
    </div>
  )
}

export default Signup
