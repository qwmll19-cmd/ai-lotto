import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNotification } from '../../context/NotificationContext.jsx'
import { request, saveTokens } from '../../api/client.js'

/**
 * 소셜 로그인 신규 가입 동의 페이지
 *
 * 카카오/네이버 등 소셜 로그인으로 신규 가입 시
 * 이용약관 동의를 받고 실제 JWT를 발급받는 페이지입니다.
 */
function SocialSignupConsent() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const { success, error: showError } = useNotification()

  const [consentTerms, setConsentTerms] = useState(false)
  const [consentMarketing, setConsentMarketing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // URL에서 정보 복원 (OAuthCallback에서 전달)
  const pendingToken = searchParams.get('pending_token')
  const userName = searchParams.get('name') || '회원'
  const provider = searchParams.get('provider') || '소셜'

  // pending_token이 없으면 로그인 페이지로 이동
  useEffect(() => {
    if (!pendingToken) {
      showError('잘못된 접근입니다. 다시 로그인해주세요.')
      navigate('/login', { replace: true })
    }
  }, [pendingToken, navigate, showError])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')

    if (!consentTerms) {
      setErrorMessage('필수 약관에 동의해야 합니다.')
      return
    }

    if (!pendingToken) {
      setErrorMessage('토큰이 없습니다. 다시 로그인해주세요.')
      return
    }

    setLoading(true)

    try {
      // 동의 완료 API 호출
      const data = await request('/api/auth/complete-social-signup', {
        method: 'POST',
        body: JSON.stringify({
          pending_token: pendingToken,
          consent_terms: consentTerms,
          consent_marketing: consentMarketing,
        }),
      })

      if (data.success) {
        // JWT 저장
        if (data.access_token && data.refresh_token) {
          saveTokens({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          })
        }

        // 사용자 정보 저장
        if (data.user) {
          const userData = {
            id: data.user.user_id,
            identifier: data.user.identifier,
            name: data.user.name || null,
            phone_number: data.user.phone_number || null,
            isAdmin: data.user.is_admin || false,
            tier: data.user.tier || 'FREE',
            first_week_bonus_used: data.user.first_week_bonus_used || false,
            weekly_free_used_at: data.user.weekly_free_used_at || null,
            created_at: data.user.created_at || null,
          }
          setUser(userData)
        }

        success('회원가입이 완료되었습니다!', '환영합니다')
        navigate('/mypage?signup=success', { replace: true })
      } else {
        setErrorMessage(data.message || '회원가입 처리에 실패했습니다.')
      }
    } catch (err) {
      console.error('Social signup error:', err)
      setErrorMessage('회원가입 처리 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    // 동의 거부 시 로그인 페이지로 이동 (아직 로그인 상태가 아님)
    showError('회원가입이 취소되었습니다.')
    navigate('/login', { replace: true })
  }

  // pending_token이 없으면 렌더링하지 않음
  if (!pendingToken) {
    return null
  }

  return (
    <div className="page auth-page auth-page--centered">
      <div className="auth-card auth-card--centered">
        <h2>회원가입</h2>
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

          {errorMessage && <p className="auth-form__error">{errorMessage}</p>}

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
