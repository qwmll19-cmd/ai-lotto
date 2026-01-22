import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ScrollToTop from '../components/ScrollToTop.jsx'
import DefaultLayout from '../layouts/DefaultLayout.jsx'
import RequireAuth from './RequireAuth.jsx'
import Home from '../pages/Home/Home.jsx'
import Login from '../pages/Auth/Login.jsx'
import Signup from '../pages/Auth/Signup.jsx'
import ForgotPassword from '../pages/Auth/ForgotPassword.jsx'
import OAuthCallback from '../pages/Auth/OAuthCallback.jsx'
import SocialSignupConsent from '../pages/Auth/SocialSignupConsent.jsx'
import MyPage from '../pages/Account/MyPage.jsx'
import Dashboard from '../pages/Lotto/Dashboard.jsx'
import Stats from '../pages/Lotto/Stats.jsx'
import History from '../pages/Lotto/History.jsx'
import Recommend from '../pages/Lotto/Recommend.jsx'
import OpsDashboard from '../pages/Lotto/OpsDashboard.jsx'
import About from '../pages/Info/About.jsx'
import FAQ from '../pages/Info/FAQ.jsx'
import Support from '../pages/Info/Support.jsx'
import Terms from '../pages/Info/Terms.jsx'
import Privacy from '../pages/Info/Privacy.jsx'
import Youth from '../pages/Info/Youth.jsx'
import Pricing from '../pages/Pricing/Pricing.jsx'
import Checkout from '../pages/Pricing/Checkout.jsx'
import AdminPage from '../pages/Admin/AdminPage.jsx'
import NotFound from '../pages/NotFound/NotFound.jsx'

function Router() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* 관리자 페이지 - 전용 레이아웃 사용 */}
        <Route path="/admin" element={<AdminPage />} />

        {/* 일반 페이지 - DefaultLayout 사용 */}
        <Route element={<DefaultLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/social-signup" element={<SocialSignupConsent />} />
          <Route
            path="/mypage"
            element={
              <RequireAuth>
                <MyPage />
              </RequireAuth>
            }
          />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/ops" element={<OpsDashboard />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/history" element={<History />} />
          <Route path="/recommend" element={<Recommend />} />
          <Route path="/about" element={<About />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/support" element={<Support />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/youth" element={<Youth />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route
            path="/checkout"
            element={
              <RequireAuth>
                <Checkout />
              </RequireAuth>
            }
          />
          {/* 404 페이지 */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default Router
