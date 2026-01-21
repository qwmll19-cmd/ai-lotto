import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * OAuth 에러 파라미터를 처리하는 커스텀 훅
 * URL의 error, message 파라미터를 확인하고 알림을 표시한 후 URL을 정리합니다.
 *
 * @param {Function} showError - 에러 알림 함수 (NotificationContext에서 가져옴)
 * @param {string} redirectPath - 에러 파라미터 제거 후 리다이렉트할 경로
 * @param {string} errorTitle - 에러 알림 제목 (기본: '로그인 실패')
 */
export function useOAuthError(showError, redirectPath, errorTitle = '로그인 실패') {
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const errorCode = searchParams.get('error')
    const errorMessage = searchParams.get('message')

    if (errorCode && errorMessage) {
      showError(errorMessage, errorTitle)
      // URL에서 에러 파라미터 제거
      window.history.replaceState({}, '', redirectPath)
    }
  }, [searchParams, showError, redirectPath, errorTitle])
}

export default useOAuthError
