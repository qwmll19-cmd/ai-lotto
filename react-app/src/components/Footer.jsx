import { useState } from 'react'
import { Link } from 'react-router-dom'
import { businessInfo } from '../config/businessInfo.js'

function Footer() {
  const [showContact, setShowContact] = useState(false)

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p className="site-footer__notice">
          본 서비스는 통계·패턴 분석을 기반으로 한 정보 제공 서비스이며, 특정 회차의 당첨을 보장하지 않습니다.
        </p>
        <div className="site-footer__links">
          <Link to="/terms">이용약관</Link>
          <Link to="/privacy">개인정보처리방침</Link>
          <Link to="/youth">청소년보호정책</Link>
        </div>

        {/* 사업자 정보 */}
        <div className="site-footer__business">
          <p className="site-footer__business-info">
            <span>상호: {businessInfo.companyName}</span>
            <span className="site-footer__divider">|</span>
            <span>대표: {businessInfo.ceo}</span>
            <span className="site-footer__divider">|</span>
            <span>사업자등록번호: {businessInfo.businessNumber}</span>
          </p>
          <p className="site-footer__business-info">
            <span>통신판매업신고: {businessInfo.salesNumber}</span>
            <span className="site-footer__divider">|</span>
            <button
              type="button"
              className="site-footer__contact-btn"
              onClick={() => setShowContact(!showContact)}
            >
              고객센터 {showContact ? '▲' : '▼'}
            </button>
          </p>
          {showContact && (
            <div className="site-footer__contact-info">
              <p>전화: <a href={`tel:${businessInfo.phone}`}>{businessInfo.phone}</a></p>
              <p>이메일: <a href={`mailto:${businessInfo.email}`}>{businessInfo.email}</a></p>
            </div>
          )}
        </div>

        <p className="site-footer__copyright">
          © {new Date().getFullYear()} {businessInfo.serviceName}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

export default Footer
