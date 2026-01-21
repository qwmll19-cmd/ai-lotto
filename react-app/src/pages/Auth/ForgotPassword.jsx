import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { sendSmsCode, verifySmsCode, resetPassword } from '../../api/authApi.js'

function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: 전화번호 입력, 2: 인증코드 확인, 3: 비밀번호 재설정
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // 휴대폰 번호 포맷팅 (010-1234-5678)
  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 3) return digits
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
  }

  // 카운트다운 시작
  const startCountdown = () => {
    setCountdown(180) // 3분
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // 1단계: SMS 인증코드 발송
  const handleSendCode = async (event) => {
    event.preventDefault()
    const digits = phone.replace(/\D/g, '')

    if (digits.length < 10) {
      setError('올바른 휴대폰 번호를 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const result = await sendSmsCode(digits)
      if (result.sent) {
        setStep(2)
        setMessage('인증코드가 발송되었습니다.')
        startCountdown()
      } else {
        // 소셜 로그인 사용자 또는 미등록 번호
        setError(result.message || '인증코드 발송에 실패했습니다.')
      }
    } catch (err) {
      setError(err.message || '인증코드 발송에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 2단계: 인증코드 확인
  const handleVerifyCode = async (event) => {
    event.preventDefault()
    const digits = phone.replace(/\D/g, '')

    if (code.length !== 6) {
      setError('6자리 인증코드를 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const result = await verifySmsCode(digits, code)
      if (result.verified && result.reset_token) {
        setResetToken(result.reset_token)
        setStep(3)
        setMessage('인증이 완료되었습니다. 새 비밀번호를 설정해주세요.')
      } else {
        setError(result.message || '인증에 실패했습니다.')
      }
    } catch (err) {
      setError(err.message || '인증에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 3단계: 비밀번호 재설정
  const handleResetPassword = async (event) => {
    event.preventDefault()

    if (newPassword.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      await resetPassword(resetToken, newPassword)
      navigate('/login', { state: { message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.' } })
    } catch (err) {
      setError(err.message || '비밀번호 변경에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 인증코드 재발송
  const handleResend = async () => {
    if (countdown > 0) return
    await handleSendCode({ preventDefault: () => {} })
  }

  return (
    <div className="page auth-page auth-page--centered">
      <div className="auth-card auth-card--centered">
        <h2>비밀번호 찾기</h2>

        {/* Step 1: 전화번호 입력 */}
        {step === 1 && (
          <>
            <p className="auth-card__desc">
              가입 시 등록한 휴대폰 번호를 입력하시면
              <br />
              인증코드를 보내드립니다.
            </p>

            <form className="auth-form" onSubmit={handleSendCode}>
              <div className="auth-form__field">
                <label htmlFor="phone">휴대폰 번호</label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="010-1234-5678"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  autoComplete="tel"
                  autoFocus
                  maxLength={13}
                />
              </div>

              {error && <p className="auth-form__error">{error}</p>}

              <button
                className="btn btn--primary btn--full btn--lg"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    발송 중...
                  </>
                ) : (
                  '인증코드 발송'
                )}
              </button>
            </form>
          </>
        )}

        {/* Step 2: 인증코드 확인 */}
        {step === 2 && (
          <>
            <p className="auth-card__desc">
              {phone}로 발송된
              <br />
              6자리 인증코드를 입력해주세요.
            </p>

            <form className="auth-form" onSubmit={handleVerifyCode}>
              <div className="auth-form__field">
                <label htmlFor="code">인증코드</label>
                <div className="auth-form__code-input">
                  <input
                    id="code"
                    type="text"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={6}
                  />
                  {countdown > 0 && (
                    <span className="auth-form__countdown">
                      {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                    </span>
                  )}
                </div>
              </div>

              {error && <p className="auth-form__error">{error}</p>}
              {message && <p className="auth-form__success">{message}</p>}

              <button
                className="btn btn--primary btn--full btn--lg"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    확인 중...
                  </>
                ) : (
                  '확인'
                )}
              </button>

              <button
                type="button"
                className="btn btn--ghost btn--full"
                onClick={handleResend}
                disabled={countdown > 0 || loading}
                style={{ marginTop: '0.5rem' }}
              >
                {countdown > 0 ? `재발송 (${countdown}초 후)` : '인증코드 재발송'}
              </button>
            </form>
          </>
        )}

        {/* Step 3: 비밀번호 재설정 */}
        {step === 3 && (
          <>
            <p className="auth-card__desc">
              새로운 비밀번호를 설정해주세요.
            </p>

            <form className="auth-form" onSubmit={handleResetPassword}>
              <div className="auth-form__field">
                <label htmlFor="newPassword">새 비밀번호</label>
                <input
                  id="newPassword"
                  type="password"
                  placeholder="최소 6자 이상"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                />
              </div>

              <div className="auth-form__field">
                <label htmlFor="confirmPassword">비밀번호 확인</label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="비밀번호를 다시 입력하세요"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {error && <p className="auth-form__error">{error}</p>}
              {message && <p className="auth-form__success">{message}</p>}

              <button
                className="btn btn--primary btn--full btn--lg"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    변경 중...
                  </>
                ) : (
                  '비밀번호 변경'
                )}
              </button>
            </form>
          </>
        )}

        <div className="auth-card__links" style={{ marginTop: '1.5rem' }}>
          <Link to="/login">로그인 페이지로 돌아가기</Link>
        </div>

        {step === 1 && (
          <div className="auth-card__info" style={{ marginTop: '2rem' }}>
            <h4>소셜 로그인 사용자</h4>
            <p>
              네이버 또는 카카오로 가입하셨다면
              <br />
              해당 서비스에서 비밀번호를 변경해주세요.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ForgotPassword
