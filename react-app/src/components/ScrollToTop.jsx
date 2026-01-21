import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    // hash가 있으면 해당 섹션으로 스크롤
    if (hash) {
      const element = document.getElementById(hash.replace('#', ''))
      if (element) {
        setTimeout(() => element.scrollIntoView({ behavior: 'smooth' }), 100)
        return
      }
    }
    // hash가 없으면 상단으로 스크롤
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}

export default ScrollToTop
