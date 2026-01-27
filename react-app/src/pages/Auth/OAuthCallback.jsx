import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { request, saveTokens } from '../../api/client.js'

/**
 * OAuth 콜백 처리 페이지
 *
 * 카카오톡/네이버 등 인앱 브라우저에서 쿠키가 설정되지 않는 문제를 해결하기 위해
 * one-time token을 URL 파라미터로 받아서 처리합니다.
 */
function OAuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [status, setStatus] = useState('처리 중...')
  const processedRef = useRef(false)

  useEffect(() => {
    // React StrictMode 중복 실행 방지
    if (processedRef.current) return
    processedRef.current = true

    const processCallback = async () => {
      const token = searchParams.get('token')
      const error = searchParams.get('error')
      const message = searchParams.get('message')

      // 에러 처리
      if (error) {
        setStatus(`로그인 실패: ${message || error}`)
        setTimeout(() => {
          navigate('/login', {
            state: { error: message || '소셜 로그인에 실패했습니다.' }
          })
        }, 1500)
        return
      }

      // 토큰이 없으면 에러
      if (!token) {
        setStatus('잘못된 접근입니다.')
        setTimeout(() => navigate('/login'), 1500)
        return
      }

      try {
        // one-time token을 사용해 실제 JWT와 사용자 정보 교환
        const data = await request('/api/auth/exchange-token', {
          method: 'POST',
          body: JSON.stringify({ token }),
        })

        if (data.success) {
          // 백엔드에서 받은 provider 사용 (NAVER, KAKAO)
          const provider = data.provider === 'KAKAO' ? '카카오' : '네이버'

          // 신규 가입자: 동의 페이지로 이동
          if (data.is_new_user && data.pending_token) {
            setStatus('회원가입 진행 중...')
            setTimeout(() => {
              const params = new URLSearchParams({
                pending_token: data.pending_token,
                name: data.name || '회원',
                provider,
              })
              navigate(`/social-signup?${params.toString()}`, { replace: true })
            }, 500)
            return
          }

          // 기존 사용자: 로그인 확인 페이지로 이동
          if (data.pending_token) {
            setStatus('로그인 확인 중...')
            setTimeout(() => {
              const params = new URLSearchParams({
                pending_token: data.pending_token,
                name: data.name || '회원',
                identifier: data.identifier || '',
                provider,
              })
              navigate(`/social-login-confirm?${params.toString()}`, { replace: true })
            }, 500)
            return
          }

          // 폴백: JWT가 이미 발급된 경우 (이전 버전 호환)
          if (data.access_token && data.refresh_token) {
            saveTokens({
              access_token: data.access_token,
              refresh_token: data.refresh_token,
            })

            const userData = {
              id: data.user_id,
              identifier: data.identifier,
              name: data.name || null,
              phone_number: data.phone_number || null,
              isAdmin: data.is_admin || false,
              tier: data.tier || 'FREE',
              first_week_bonus_used: data.first_week_bonus_used || false,
              weekly_free_used_at: data.weekly_free_used_at || null,
              created_at: data.created_at || null,
            }

            setUser(userData)

            setStatus('로그인 성공!')
            setTimeout(() => {
              navigate('/mypage?login=success', { replace: true })
            }, 500)
          } else {
            throw new Error('토큰 발급 실패')
          }
        } else {
          throw new Error(data.message || '토큰 교환 실패')
        }
      } catch (err) {
        console.error('OAuth callback error:', err)
        setStatus('로그인 처리 중 오류가 발생했습니다.')
        setTimeout(() => {
          navigate('/login', {
            state: { error: '소셜 로그인 처리에 실패했습니다. 다시 시도해주세요.' }
          })
        }, 1500)
      }
    }

    processCallback()
  }, [searchParams, navigate, setUser])

  return (
    <div className="page oauth-callback-page">
      <div className="oauth-callback">
        <div className="oauth-callback__spinner" />
        <p className="oauth-callback__status">{status}</p>
      </div>
    </div>
  )
}

export default OAuthCallback
