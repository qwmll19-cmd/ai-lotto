import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNotification } from '../../context/NotificationContext.jsx'

/**
 * 소셜 로그인 신규 가입 동의 페이지
 *
 * 카카오/네이버 등 소셜 로그인으로 신규 가입 시
 * 이용약관 동의를 받는 페이지입니다.
 */
function SocialSignupConsent() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, setUser } = useAuth()
  const { success, error: showError } = useNotification()

  const [consentTerms, setConsentTerms] = useState(false)
  const [consentMarketing, setConsentMarketing] = useState(false)
  const [loading, setLoading] = useState(false)

  // URL에서 사용자 정보 복원 (OAuthCallback에서 전달)
  const userName = searchParams.get('name') || user?.name || '회원'
  const provider = searchParams.get('provider') || '소셜'

  // 이미 로그인 상태가 아니면 로그인 페이지로 이동
  useEffect(() => {
    if (!user && !searchParams.get('name')) {
      navigate('/login', { replace: true })
    }
  }, [user, searchParams, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!consentTerms) {
      showError('필수 약관에 동의해야 합니다.')
      return
    }

    setLoading(true)

    // 동의 완료 - 마이페이지로 이동
    success('회원가입이 완료되었습니다!', '환영합니다')
    navigate('/mypage?signup=success', { replace: true })
  }

  const handleCancel = () => {
    // 동의 거부 시 로그아웃 처리
    setUser(null)
    localStorage.removeItem('ai_lotto_user')
    localStorage.removeItem('ai_lotto_tokens')
    showError('회원가입이 취소되었습니다.')
    navigate('/login', { replace: true })
  }

  return (
    <div className="page auth-page auth-page--centered">
      <div className="auth-card auth-card--centered">
        <h2>회원가입 완료</h2>
        <p>{provider} 계정으로 처음 방문하셨네요!</p>

        <div className="social-signup-welcome">
          <div className="social-signup-welcome__avatar">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="social-signup-welcome__info">
            <strong>{userName}</strong>님 환영합니다
          </div>
        </div>

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

          <button
            className="btn btn--primary btn--full btn--lg"
            type="submit"
            disabled={loading || !consentTerms}
          >
            {loading ? (
              <>
                <span className="spinner" />
                처리 중...
              </>
            ) : (
              '동의하고 시작하기'
            )}
          </button>

          <button
            type="button"
            className="btn btn--ghost btn--full"
            onClick={handleCancel}
          >
            취소
          </button>
        </form>
      </div>
    </div>
  )
}

export default SocialSignupConsent
