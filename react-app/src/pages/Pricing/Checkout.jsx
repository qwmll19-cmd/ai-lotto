import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNotification } from '../../context/NotificationContext.jsx'
import { request } from '../../api/client.js'

// 결제 정보 (사업자 계좌)
const PAYMENT_INFO = {
  bankName: '토스뱅크',
  accountNumber: '100242176511',
  accountHolder: '팡팡기획',
}

// 모바일 기기 감지
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false
  const userAgent = navigator.userAgent || navigator.vendor || window.opera
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
}

// 은행 앱 딥링크 목록
const BANK_APPS = [
  { id: 'toss', name: '토스', scheme: 'supertoss://send', color: '#0064FF', icon: 'T' },
  { id: 'kakaobank', name: '카카오뱅크', scheme: 'kakaobank://transfer', color: '#FFCD00', textColor: '#191919', icon: 'K' },
  { id: 'kbbank', name: 'KB국민', scheme: 'kbbank://transfer', color: '#FFBC00', textColor: '#191919', icon: 'KB' },
  { id: 'shinhan', name: '신한', scheme: 'shinhan-sr-ansimclick://transfer', color: '#0046FF', icon: 'S' },
  { id: 'hana', name: '하나', scheme: 'hanabank://transfer', color: '#009775', icon: 'H' },
  { id: 'woori', name: '우리', scheme: 'wooribank://transfer', color: '#0066B3', icon: 'W' },
  { id: 'nh', name: 'NH농협', scheme: 'nhbank://transfer', color: '#01579B', icon: 'NH' },
  { id: 'ibk', name: 'IBK기업', scheme: 'ibkbank://transfer', color: '#0066B3', icon: 'IBK' },
]

// 클립보드 복사 텍스트 생성
const getCopyText = () => {
  return `토스뱅크 ${PAYMENT_INFO.accountNumber}`
}

function Checkout() {
  const { isAuthed, user } = useAuth()
  const { success, error: showError } = useNotification()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const planId = searchParams.get('plan') || 'basic'

  // 티어 비교 로직
  const userTier = user?.tier?.toUpperCase() || 'FREE'
  const tierOrder = { FREE: 0, BASIC: 1, PREMIUM: 2, VIP: 3 }
  const currentIndex = tierOrder[userTier] ?? 0
  const planIndex = tierOrder[planId.toUpperCase()] ?? 0

  // 다운그레이드 또는 동일 플랜 체크
  const isDowngrade = planIndex < currentIndex
  const isSamePlan = planIndex === currentIndex && userTier !== 'FREE'

  // 모바일 여부
  const isMobile = useMemo(() => isMobileDevice(), [])

  // 상태
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)  // 구독 생성 로딩
  const [depositorName, setDepositorName] = useState('')
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptPhone, setReceiptPhone] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [subscriptionId, setSubscriptionId] = useState(null)
  const [paymentToken, setPaymentToken] = useState(null)  // QR 결제용 토큰

  const plans = {
    basic: {
      id: 'basic',
      name: 'Basic',
      price: 4900,  // VAT 포함
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
      price: 8900,  // VAT 포함
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
      price: 11900,  // VAT 포함
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

  // 초기값 설정
  useEffect(() => {
    if (user?.name) {
      setDepositorName(user.name)
    }
    if (user?.phone_number) {
      setReceiptPhone(user.phone_number)
    }
  }, [user])

  // 페이지 진입 시 구독 생성 (토큰 발급) - PC용 QR 코드 생성을 위해
  useEffect(() => {
    const createPendingSubscription = async () => {
      if (!isAuthed || !user || isDowngrade || isSamePlan) {
        setInitializing(false)
        return
      }

      try {
        const result = await request('/api/subscribe', {
          method: 'POST',
          body: JSON.stringify({
            name: user.name || '',
            phone: user.phone_number || '',
            plan_type: selectedPlan.id,
            payment_method: 'bank_transfer',
            consent_terms: true,  // 임시 동의 (최종 제출 시 다시 확인)
            depositor_name: user.name || '미입력',
            receipt_phone: null,
          }),
        })

        if (result.subscription_id && result.payment_token) {
          setSubscriptionId(result.subscription_id)
          setPaymentToken(result.payment_token)
        }
      } catch (err) {
        // 구독 생성 실패해도 계속 진행 (QR만 안 보임)
        console.error('Failed to create pending subscription:', err)
      } finally {
        setInitializing(false)
      }
    }

    createPendingSubscription()
  }, [isAuthed, user, selectedPlan.id, isDowngrade, isSamePlan])

  useEffect(() => {
    if (!isAuthed) {
      navigate('/login', { state: { from: { pathname: `/checkout?plan=${planId}` } } })
    } else if (isDowngrade || isSamePlan) {
      showError(
        isDowngrade
          ? '현재 플랜보다 낮은 플랜으로 변경할 수 없습니다.'
          : '이미 동일한 플랜을 이용 중입니다.',
        '결제 불가'
      )
      navigate('/pricing')
    }
  }, [isAuthed, navigate, planId, isDowngrade, isSamePlan, showError])

  // 계좌번호 복사 (은행명 포함)
  const handleCopyAccount = async () => {
    try {
      const copyText = getCopyText()
      await navigator.clipboard.writeText(copyText)
      success('계좌번호가 복사되었습니다.', '복사 완료')
    } catch {
      showError('복사에 실패했습니다.', '오류')
    }
  }

  // 은행 앱 버튼 클릭 (복사 + 앱 실행)
  const handleBankAppClick = async (bank) => {
    try {
      // 먼저 클립보드에 복사
      const copyText = getCopyText()
      await navigator.clipboard.writeText(copyText)
      success('계좌번호가 복사되었습니다. 앱에서 붙여넣기 하세요.', '복사 완료')

      // 딥링크로 앱 실행 시도
      window.location.href = bank.scheme
    } catch {
      // 복사 실패해도 앱 실행은 시도
      window.location.href = bank.scheme
    }
  }

  // 입금 완료 제출 (기존 pending 구독 업데이트)
  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!depositorName.trim()) {
      showError('입금자명을 입력해주세요.', '오류')
      return
    }

    if (!agreeTerms) {
      showError('이용약관에 동의해주세요.', '오류')
      return
    }

    setLoading(true)

    try {
      // 기존 pending 구독이 있으면 재사용 (입금자명 업데이트)
      const result = await request('/api/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          name: user?.name || depositorName,
          phone: user?.phone_number || '',
          plan_type: selectedPlan.id,
          payment_method: 'bank_transfer',
          consent_terms: agreeTerms,
          depositor_name: depositorName.trim(),
          receipt_phone: showReceipt && receiptPhone ? receiptPhone.replace(/-/g, '') : null,
        }),
      })

      if (result.subscription_id) {
        setSubscriptionId(result.subscription_id)
        setSubmitted(true)
        success('입금 확인 요청이 완료되었습니다.', '신청 완료')
      } else {
        throw new Error(result.message || '신청에 실패했습니다.')
      }
    } catch (err) {
      showError(err?.message || '신청 처리 중 오류가 발생했습니다.', '오류')
    } finally {
      setLoading(false)
    }
  }

  // QR 코드 URL 생성
  const qrCodeUrl = paymentToken
    ? `${window.location.origin}/pay/${paymentToken}`
    : null

  if (!isAuthed || isDowngrade || isSamePlan) {
    return null
  }

  // 제출 완료 후 대기 화면
  if (submitted) {
    return (
      <div className="page checkout-page">
        <section className="checkout-hero">
          <div className="checkout-hero__inner">
            <h1>입금 확인 중</h1>
            <p>{selectedPlan.name} 플랜 구독 신청이 완료되었습니다</p>
          </div>
        </section>

        <section className="checkout-content">
          <div className="checkout-content__inner checkout-content__inner--centered">
            <div className="checkout-pending">
              <div className="checkout-pending__icon">⏳</div>
              <h2>입금 확인 대기 중</h2>
              <p>관리자 확인 후 1시간 이내 구독이 활성화됩니다.</p>

              <div className="checkout-pending__info">
                <div className="checkout-pending__row">
                  <span>신청 플랜</span>
                  <span>{selectedPlan.name}</span>
                </div>
                <div className="checkout-pending__row">
                  <span>결제 금액</span>
                  <span>₩{selectedPlan.price.toLocaleString()}</span>
                </div>
                <div className="checkout-pending__row">
                  <span>입금자명</span>
                  <span>{depositorName}</span>
                </div>
                <div className="checkout-pending__row">
                  <span>신청번호</span>
                  <span>#{subscriptionId}</span>
                </div>
              </div>

              <button
                className="btn btn--primary btn--full"
                onClick={() => navigate('/mypage?tab=subscription')}
              >
                마이페이지에서 확인하기
              </button>

              <p className="checkout-pending__help">
                문의사항이 있으신가요? <Link to="/support">고객센터</Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    )
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
              {/* 결제 정보 */}
              <div className="checkout-section">
                <h2>입금 정보</h2>

                <div className="checkout-account checkout-account--main">
                  <div className="checkout-account__row">
                    <span className="checkout-account__label">은행명</span>
                    <span className="checkout-account__value">{PAYMENT_INFO.bankName}</span>
                  </div>
                  <div className="checkout-account__row">
                    <span className="checkout-account__label">계좌번호</span>
                    <span className="checkout-account__value checkout-account__value--account">{PAYMENT_INFO.accountNumber}</span>
                  </div>
                  <div className="checkout-account__row">
                    <span className="checkout-account__label">예금주</span>
                    <span className="checkout-account__value">{PAYMENT_INFO.accountHolder}</span>
                  </div>
                  <div className="checkout-account__row checkout-account__row--amount">
                    <span className="checkout-account__label">입금 금액</span>
                    <span className="checkout-account__value checkout-account__value--price">₩{selectedPlan.price.toLocaleString()}</span>
                  </div>
                </div>

                {/* 계좌번호 복사 버튼 */}
                <button
                  type="button"
                  className="checkout-copy-btn"
                  onClick={handleCopyAccount}
                >
                  계좌번호 복사하기
                </button>
                <p className="checkout-copy-hint">
                  복사 버튼을 누른 뒤 모바일 뱅킹 앱에서 붙여넣기 하세요
                </p>
              </div>

              {/* PC: QR 코드 표시 */}
              {!isMobile && (
                <div className="checkout-section">
                  <h2>모바일로 결제하기</h2>
                  <p className="checkout-section__hint">
                    스마트폰으로 QR 코드를 스캔하면 간편하게 결제할 수 있습니다
                  </p>

                  <div className="checkout-qr">
                    {initializing ? (
                      <div className="checkout-qr__loading">
                        <span className="spinner" />
                        <p>QR 코드 생성 중...</p>
                      </div>
                    ) : qrCodeUrl ? (
                      <>
                        <div className="checkout-qr__code">
                          <QRCodeSVG
                            value={qrCodeUrl}
                            size={180}
                            level="M"
                            includeMargin={true}
                          />
                        </div>
                        <p className="checkout-qr__hint">
                          카메라 앱으로 QR 코드를 스캔하세요
                        </p>
                      </>
                    ) : (
                      <p className="checkout-qr__error">
                        QR 코드를 생성할 수 없습니다. 직접 입금해주세요.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 모바일: 은행 앱 바로가기 */}
              {isMobile && (
                <div className="checkout-section">
                  <h2>은행 앱 바로가기</h2>
                  <p className="checkout-section__hint">
                    앱 아이콘을 누르면 계좌가 복사되고 해당 앱이 실행됩니다
                  </p>

                  <div className="checkout-bank-grid">
                    {BANK_APPS.map((bank) => (
                      <button
                        key={bank.id}
                        type="button"
                        className="checkout-bank-btn"
                        style={{
                          backgroundColor: bank.color,
                          color: bank.textColor || 'white',
                        }}
                        onClick={() => handleBankAppClick(bank)}
                      >
                        <span className="checkout-bank-btn__icon">{bank.icon}</span>
                        <span className="checkout-bank-btn__name">{bank.name}</span>
                      </button>
                    ))}
                  </div>

                  <p className="checkout-bank-notice">
                    * 일부 기기에서는 동작하지 않을 수 있습니다
                  </p>
                </div>
              )}

              {/* 입금자명 (항상 열림) */}
              <div className="checkout-section">
                <h2>입금자명</h2>
                <div className="checkout-field">
                  <input
                    type="text"
                    value={depositorName}
                    onChange={(e) => setDepositorName(e.target.value)}
                    placeholder="홍길동"
                    maxLength={50}
                  />
                  <p className="checkout-field__hint">
                    송금 시 표시되는 이름이 다르면 수정해주세요
                  </p>
                </div>
              </div>

              {/* 현금영수증 (클릭 시 펼침) */}
              <div className="checkout-section checkout-section--collapsible">
                <button
                  type="button"
                  className="checkout-toggle"
                  onClick={() => setShowReceipt(!showReceipt)}
                >
                  <span>{showReceipt ? '▼' : '▶'} 현금영수증 신청</span>
                </button>

                {showReceipt && (
                  <div className="checkout-receipt">
                    <div className="checkout-field">
                      <label>소득공제용 전화번호</label>
                      <input
                        type="tel"
                        value={receiptPhone}
                        onChange={(e) => setReceiptPhone(e.target.value)}
                        placeholder="010-1234-5678"
                        maxLength={13}
                      />
                    </div>
                  </div>
                )}
              </div>

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
                    <Link to="/privacy" target="_blank">개인정보처리방침</Link>에 동의합니다
                  </span>
                </label>
              </div>

              {/* 입금 완료 버튼 */}
              <button
                type="submit"
                className="btn btn--primary btn--full btn--lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    처리 중...
                  </>
                ) : (
                  '입금 완료했어요'
                )}
              </button>

              <p className="checkout-note">
                관리자 확인 후 1시간 이내 구독이 활성화됩니다
              </p>

              <p className="checkout-help">
                입금했는데 활성화가 안 되나요? <Link to="/support">고객센터 문의</Link>
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

              <div className="checkout-summary__row checkout-summary__row--total">
                <span>결제 금액 (VAT 포함)</span>
                <span>₩{selectedPlan.price.toLocaleString()}</span>
              </div>

              <div className="checkout-summary__info">
                <p>구독 기간: 30일</p>
                <p>구독 갱신 전 알림을 보내드립니다.</p>
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
