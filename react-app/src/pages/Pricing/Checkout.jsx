import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNotification } from '../../context/NotificationContext.jsx'
import { updateUserPlan } from '../../api/authApi.js'

function Checkout() {
  const { isAuthed, setUser } = useAuth()
  const { success, error: showError } = useNotification()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const planId = searchParams.get('plan') || 'basic'
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeRefundPolicy, setAgreeRefundPolicy] = useState(false)

  const plans = {
    basic: {
      id: 'basic',
      name: 'Basic',
      price: 4900,
      period: '월',
      description: '더 많은 추천이 필요한 분께',
      features: [
        '매주 AI 추천 (5줄)',
        '상세 통계 및 분석',
        '히스토리 무제한 보관',
        '번호 제외 설정',
      ],
    },
    premium: {
      id: 'premium',
      name: 'Premium',
      price: 9900,
      period: '월',
      description: '본격적인 분석이 필요한 분께',
      features: [
        '매주 AI 추천 (10줄)',
        '프리미엄 AI 분석',
        '히스토리 무제한 보관',
        '번호 제외/고정 설정',
        '고급 패턴 분석',
      ],
    },
    vip: {
      id: 'vip',
      name: 'VIP',
      price: 13900,
      period: '월',
      description: '프로 사용자를 위한 최고의 선택',
      features: [
        '매주 AI 추천 (20줄)',
        '프리미엄 AI 분석',
        '히스토리 무제한 보관',
        '번호 제외/고정 설정',
        '고급 패턴 분석',
        '우선 고객 지원',
      ],
    },
  }

  const selectedPlan = plans[planId] || plans.basic

  // VAT 계산 (10%)
  const vatAmount = Math.round(selectedPlan.price * 0.1)
  const totalWithVat = selectedPlan.price + vatAmount

  useEffect(() => {
    if (!isAuthed) {
      navigate('/login', { state: { from: { pathname: `/checkout?plan=${planId}` } } })
    }
  }, [isAuthed, navigate, planId])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!agreeTerms) {
      showError('이용약관 및 개인정보처리방침에 동의해주세요.', '오류')
      return
    }

    if (!agreeRefundPolicy) {
      showError('청약철회 제한 사항에 동의해주세요.', '오류')
      return
    }

    setLoading(true)

    // 결제 처리 (실제로는 PG 연동 필요)
    try {
      // 결제 처리 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 1500))

      // 플랜 업데이트 API 호출 (결제수단, 30일 구독 기간 전달)
      const result = await updateUserPlan(selectedPlan.id, paymentMethod, 30)
      console.log('플랜 업데이트 결과:', result)

      // API 응답의 success 필드 확인 후에만 상태 업데이트
      if (result.success) {
        // AuthContext의 setUser를 통해 업데이트 (로컬스토리지도 자동 동기화)
        setUser(prev => prev ? { ...prev, tier: result.plan_type } : null)
        success(`${selectedPlan.name} 플랜 구독이 완료되었습니다!`, '결제 완료')

        // 약간의 지연 후 페이지 이동
        setTimeout(() => {
          window.location.href = '/mypage?tab=subscription'
        }, 100)
      } else {
        throw new Error(result.message || '플랜 업데이트에 실패했습니다.')
      }
    } catch (err) {
      showError(err?.message || '결제 처리 중 오류가 발생했습니다.', '오류')
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthed) {
    return null
  }

  return (
    <div className="page checkout-page">
      <section className="checkout-hero">
        <div className="checkout-hero__inner">
          <h1>결제하기</h1>
          <p>{selectedPlan.name} 플랜을 구독합니다</p>
        </div>
      </section>

      <section className="checkout-content">
        <div className="checkout-content__inner">
          {/* 왼쪽: 결제 폼 */}
          <div className="checkout-form-area">
            <form className="checkout-form" onSubmit={handleSubmit}>
              {/* 결제 수단 선택 */}
              <div className="checkout-section">
                <h2>결제 수단</h2>
                <div className="checkout-methods">
                  <label className={`checkout-method ${paymentMethod === 'card' ? 'checkout-method--active' : ''}`}>
                    <input
                      type="radio"
                      name="payment"
                      value="card"
                      checked={paymentMethod === 'card'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <span className="checkout-method__icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                        <line x1="1" y1="10" x2="23" y2="10" />
                      </svg>
                    </span>
                    <span className="checkout-method__text">신용/체크카드</span>
                  </label>

                  <label className={`checkout-method ${paymentMethod === 'kakao' ? 'checkout-method--active' : ''}`}>
                    <input
                      type="radio"
                      name="payment"
                      value="kakao"
                      checked={paymentMethod === 'kakao'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <span className="checkout-method__icon checkout-method__icon--kakao">K</span>
                    <span className="checkout-method__text">카카오페이</span>
                  </label>

                  <label className={`checkout-method ${paymentMethod === 'naver' ? 'checkout-method--active' : ''}`}>
                    <input
                      type="radio"
                      name="payment"
                      value="naver"
                      checked={paymentMethod === 'naver'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <span className="checkout-method__icon checkout-method__icon--naver">N</span>
                    <span className="checkout-method__text">네이버페이</span>
                  </label>
                </div>
              </div>

              {/* 카드 정보 입력 (카드 결제 시) */}
              {paymentMethod === 'card' && (
                <div className="checkout-section">
                  <h2>카드 정보</h2>
                  <div className="checkout-card-form">
                    <div className="checkout-field">
                      <label>카드 번호</label>
                      <input
                        type="text"
                        placeholder="0000 0000 0000 0000"
                        maxLength={19}
                      />
                    </div>
                    <div className="checkout-field-row">
                      <div className="checkout-field">
                        <label>유효기간</label>
                        <input type="text" placeholder="MM/YY" maxLength={5} />
                      </div>
                      <div className="checkout-field">
                        <label>CVC</label>
                        <input type="text" placeholder="000" maxLength={4} />
                      </div>
                    </div>
                    <div className="checkout-field">
                      <label>카드 소유자</label>
                      <input type="text" placeholder="홍길동" />
                    </div>
                  </div>
                </div>
              )}

              {/* 약관 동의 */}
              <div className="checkout-section">
                <label className="checkout-agree">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                  />
                  <span>
                    <Link to="/terms" target="_blank">이용약관</Link> 및{' '}
                    <Link to="/privacy" target="_blank">개인정보처리방침</Link>,{' '}
                    정기결제 약관에 동의합니다
                  </span>
                </label>
                <label className="checkout-agree">
                  <input
                    type="checkbox"
                    checked={agreeRefundPolicy}
                    onChange={(e) => setAgreeRefundPolicy(e.target.checked)}
                  />
                  <span>
                    AI 추천 번호(디지털 콘텐츠)를 열람한 경우 해당 회차에 대해
                    청약철회가 제한됨을 확인하였습니다
                  </span>
                </label>
              </div>

              {/* 결제 버튼 */}
              <button
                type="submit"
                className="btn btn--primary btn--full btn--lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    결제 처리 중...
                  </>
                ) : (
                  `₩${totalWithVat.toLocaleString()} 결제하기`
                )}
              </button>

              <p className="checkout-note">
                7일 이내 청약철회 가능 (번호 열람 시 해당분 제외) · 언제든 구독 취소 가능
              </p>
            </form>
          </div>

          {/* 오른쪽: 주문 요약 */}
          <div className="checkout-summary-area">
            <div className="checkout-summary">
              <h2>주문 요약</h2>

              <div className="checkout-summary__plan">
                <div className="checkout-summary__plan-header">
                  <h3>{selectedPlan.name}</h3>
                  <span className="checkout-summary__plan-badge">월간 구독</span>
                </div>
                <p>{selectedPlan.description}</p>
                <ul className="checkout-summary__features">
                  {selectedPlan.features.map((feature, idx) => (
                    <li key={idx}>
                      <span className="checkout-summary__check">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="checkout-summary__divider" />

              <div className="checkout-summary__row">
                <span>플랜 가격 (VAT 별도)</span>
                <span>₩{selectedPlan.price.toLocaleString()}</span>
              </div>

              <div className="checkout-summary__row">
                <span>부가세 (VAT 10%)</span>
                <span>₩{vatAmount.toLocaleString()}</span>
              </div>

              <div className="checkout-summary__divider" />

              <div className="checkout-summary__row checkout-summary__row--total">
                <span>총 결제 금액 (VAT 포함)</span>
                <span>₩{totalWithVat.toLocaleString()}</span>
              </div>

              <div className="checkout-summary__info">
                <p>다음 결제일: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('ko-KR')}</p>
                <p>구독 갱신 전 이메일로 알림을 보내드립니다.</p>
              </div>

              <Link to="/pricing" className="checkout-summary__back">
                ← 플랜 비교로 돌아가기
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Checkout
