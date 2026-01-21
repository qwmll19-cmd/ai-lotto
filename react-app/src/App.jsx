import Router from './routes/Router.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { NotificationProvider } from './context/NotificationContext.jsx'
import Toast from './components/Toast.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <Router />
          <Toast />
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
