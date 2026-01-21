/**
 * 인앱 브라우저 감지 유틸리티
 * 카카오톡, 네이버, 인스타그램 등 인앱 브라우저에서는 OAuth가 제대로 작동하지 않음
 */

export function isInAppBrowser() {
  const ua = navigator.userAgent || navigator.vendor || window.opera || ''

  // 카카오톡 인앱 브라우저
  if (/kakaotalk/i.test(ua)) return { isInApp: true, app: 'kakaotalk' }

  // 네이버 앱
  if (/naver/i.test(ua) && /inapp/i.test(ua)) return { isInApp: true, app: 'naver' }

  // 인스타그램
  if (/instagram/i.test(ua)) return { isInApp: true, app: 'instagram' }

  // 페이스북
  if (/fbav|fban|fbios/i.test(ua)) return { isInApp: true, app: 'facebook' }

  // 라인
  if (/line\//i.test(ua)) return { isInApp: true, app: 'line' }

  // 트위터
  if (/twitter/i.test(ua)) return { isInApp: true, app: 'twitter' }

  // 일반 웹뷰 감지 (안드로이드)
  if (/wv\)/i.test(ua) || /webview/i.test(ua)) return { isInApp: true, app: 'webview' }

  // iOS 웹뷰 감지
  if (/(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(ua)) return { isInApp: true, app: 'ios_webview' }

  return { isInApp: false, app: null }
}

/**
 * 외부 브라우저로 열기 URL 생성
 */
export function getExternalBrowserUrl(url) {
  // 안드로이드: intent scheme 사용
  if (/android/i.test(navigator.userAgent)) {
    return `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`
  }

  // iOS: 기본 Safari로 열기 시도 (완벽하지 않음)
  // 카카오톡의 경우 "Safari로 열기" 기능 안내가 필요
  return url
}

/**
 * 앱별 외부 브라우저 열기 안내 메시지
 */
export function getInAppBrowserGuide(app) {
  const guides = {
    kakaotalk: {
      title: '카카오톡 브라우저에서는 로그인이 제한됩니다',
      message: '우측 상단 메뉴(⋮)를 눌러 "다른 브라우저로 열기"를 선택해주세요.',
      icon: '💬',
    },
    naver: {
      title: '네이버 앱에서는 로그인이 제한됩니다',
      message: '우측 상단 메뉴를 눌러 "기본 브라우저로 열기"를 선택해주세요.',
      icon: '🟢',
    },
    instagram: {
      title: '인스타그램 브라우저에서는 로그인이 제한됩니다',
      message: '우측 상단 메뉴(⋯)를 눌러 "브라우저에서 열기"를 선택해주세요.',
      icon: '📷',
    },
    facebook: {
      title: '페이스북 브라우저에서는 로그인이 제한됩니다',
      message: '우측 상단 메뉴를 눌러 "브라우저에서 열기"를 선택해주세요.',
      icon: '👤',
    },
    default: {
      title: '인앱 브라우저에서는 로그인이 제한됩니다',
      message: '브라우저 메뉴에서 "외부 브라우저로 열기"를 선택해주세요.',
      icon: '🌐',
    },
  }

  return guides[app] || guides.default
}
