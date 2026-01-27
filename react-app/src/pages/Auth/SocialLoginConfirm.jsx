import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNotification } from '../../context/NotificationContext.jsx'
import { request, saveTokens } from '../../api/client.js'

/**
 * 소셜 로그인 확인 페이지
 *
 * 기존 회원이 소셜 로그인 시 "이 계정으로 로그인하시겠습니까?" 확인을 받는 페이지입니다.
 */
function SocialLoginConfirm() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const { success, error: showError } = useNotification()

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // URL에서 정보 복원
  const pendingToken = searchParams.get('pending_token')
  const userName = searchParams.get('name') || '회원'
  const identifier = searchParams.get('identifier') || ''
  const provider = searchParams.get('provider') || '소셜'

  // pending_token이 없으면 로그인 페이지로 이동
  const redirectedRef = useRef(false)
  useEffect(() => {
    if (!pendingToken && !redirectedRef.current) {
      redirectedRef.current = true
      showError('잘못된 접근입니다. 다시 로그인해주세요.')
      navigate('/login', { replace: true })
    }
  }, [pendingToken, navigate, showError])

  const handleConfirm = async () => {
    if (!pendingToken) {
      setErrorMessage('토큰이 없습니다. 다시 로그인해주세요.')
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const data = await request('/api/auth/confirm-social-login', {
        method: 'POST',
        body: JSON.stringify({
          pending_token: pendingToken,
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

        success('로그인되었습니다!', `${userName}님 환영합니다`)
        navigate('/mypage?login=success', { replace: true })
      } else {
        setErrorMessage(data.message || '로그인 처리에 실패했습니다.')
      }
    } catch (err) {
      console.error('Social login confirm error:', err)
      setErrorMessage('로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    navigate('/login', { replace: true })
  }

  // pending_token이 없으면 렌더링하지 않음
  if (!pendingToken) {
    return null
  }

  // 식별자에서 이메일/ID 추출 (표시용)
  const displayId = identifier.replace(/^(kakao_|naver_)/, '') || ''

  return (
    <div className="page auth-page auth-page--centered">
      <div className="auth-card auth-card--centered">
        <h2>로그인 확인</h2>
        <p>{provider} 계정으로 로그인합니다</p>

        <div className="social-signup-welcome">
          <div className="social-signup-welcome__avatar">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="social-signup-welcome__info">
            <strong>{userName}</strong>님
            {displayId && (
              <span className="social-signup-welcome__id">{displayId}</span>
            )}
          </div>
        </div>

        <p className="auth-form__description">
          이 계정으로 로그인하시겠습니까?
        </p>

        {errorMessage && <p className="auth-form__error">{errorMessage}</p>}

        <div className="auth-form__buttons">
          <button
            className="btn btn--primary btn--full btn--lg"
            type="button"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                처리 중...
              </>
            ) : (
              '로그인하기'
            )}
          </button>

          <button
            type="button"
            className="btn btn--ghost btn--full"
            onClick={handleCancel}
          >
            다른 계정으로 로그인
          </button>
        </div>
      </div>
    </div>
  )
}

export default SocialLoginConfirm
