import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // 에러 로깅
    console.error('=== React Error Boundary ===')
    console.error('Error:', error)
    console.error('Component Stack:', errorInfo.componentStack)
    console.error('===========================')

    this.setState({ errorInfo })

    // 로컬스토리지에 에러 기록 (최근 10개)
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        message: error?.message || String(error),
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
        url: window.location.href,
      }

      const storedErrors = JSON.parse(localStorage.getItem('ai_lotto_errors') || '[]')
      storedErrors.unshift(errorLog)
      localStorage.setItem('ai_lotto_errors', JSON.stringify(storedErrors.slice(0, 10)))
    } catch {
      // 로깅 실패 무시
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary__content">
            <h1>오류가 발생했습니다</h1>
            <p>예상치 못한 문제가 발생했습니다. 불편을 드려 죄송합니다.</p>

            <div className="error-boundary__details">
              <details>
                <summary>오류 상세 정보</summary>
                <pre>{this.state.error?.message}</pre>
                {this.state.error?.stack && (
                  <pre className="error-boundary__stack">{this.state.error.stack}</pre>
                )}
              </details>
            </div>

            <div className="error-boundary__actions">
              <button onClick={this.handleReload} className="btn btn--primary">
                페이지 새로고침
              </button>
              <button onClick={this.handleGoHome} className="btn btn--ghost">
                홈으로 이동
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
