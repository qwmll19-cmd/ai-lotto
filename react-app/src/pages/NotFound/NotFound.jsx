import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <div className="page notfound-page">
      <div className="notfound-content">
        <h1 className="notfound-code">404</h1>
        <h2 className="notfound-title">페이지를 찾을 수 없습니다</h2>
        <p className="notfound-desc">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
        </p>
        <div className="notfound-actions">
          <Link to="/" className="btn btn--primary">
            홈으로 돌아가기
          </Link>
          <Link to="/support" className="btn btn--ghost">
            고객센터
          </Link>
        </div>
      </div>
    </div>
  )
}

export default NotFound
