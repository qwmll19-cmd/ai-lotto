import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function RequireAuth({ children }) {
  const { isAuthed, authLoading } = useAuth()
  const location = useLocation()

  // 인증 확인 중일 때는 로딩 표시
  if (authLoading) {
    return (
      <div className="auth-loading">
        <span className="spinner" />
        <p>인증 확인 중...</p>
      </div>
    )
  }

  if (!isAuthed) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

export default RequireAuth
