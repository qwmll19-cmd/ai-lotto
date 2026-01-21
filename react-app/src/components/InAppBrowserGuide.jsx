import { useState, useEffect } from 'react'
import { isInAppBrowser, getInAppBrowserGuide } from '../utils/browserDetect.js'

/**
 * 인앱 브라우저 감지 시 외부 브라우저 열기 안내 컴포넌트
 */
function InAppBrowserGuide({ onDismiss }) {
  const [browserInfo, setBrowserInfo] = useState({ isInApp: false, app: null })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const info = isInAppBrowser()
    setBrowserInfo(info)
  }, [])

  if (!browserInfo.isInApp || dismissed) return null

  const guide = getInAppBrowserGuide(browserInfo.app)
  const currentUrl = window.location.href

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl).then(() => {
      alert('URL이 복사되었습니다. 브라우저에 붙여넣기 해주세요.')
    }).catch(() => {
      // 클립보드 API 실패 시 prompt 사용
      prompt('아래 URL을 복사하여 브라우저에서 열어주세요:', currentUrl)
    })
  }

  return (
    <div className="inapp-guide">
      <div className="inapp-guide__content">
        <span className="inapp-guide__icon">{guide.icon}</span>
        <div className="inapp-guide__text">
          <strong>{guide.title}</strong>
          <p>{guide.message}</p>
        </div>
        <div className="inapp-guide__actions">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleCopyUrl}
          >
            URL 복사
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleDismiss}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

export default InAppBrowserGuide
