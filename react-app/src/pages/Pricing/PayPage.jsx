import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useNotification } from '../../context/NotificationContext.jsx'

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

function PayPage() {
  const { token } = useParams()
  const { success, error: showError } = useNotification()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [paymentInfo, setPaymentInfo] = useState(null)
  const [depositorName, setDepositorName] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  // 결제 정보 조회
  useEffect(() => {
    const fetchPaymentInfo = async () => {
      try {
        const response = await fetch(`/api/pay/${token}`)
        const data = await response.json()

        if (!response.ok) {
          setErrorMessage(data.detail || '결제 정보를 불러올 수 없습니다.')
          setLoading(false)
          return
        }

        setPaymentInfo(data)
        // 기존 입금자명이 있으면 (마스킹된 상태로) 표시하지 않고 새로 입력받음
      } catch {
        setErrorMessage('결제 정보를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchPaymentInfo()
    }
  }, [token])

  // 클립보드 복사 텍스트 생성
  const getCopyText = () => {
    if (!paymentInfo) return ''
    return `${paymentInfo.bank_name} ${paymentInfo.account_number}`
  }

  // 계좌번호 복사
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
      const copyText = getCopyText()
      await navigator.clipboard.writeText(copyText)
      success('계좌번호가 복사되었습니다. 앱에서 붙여넣기 하세요.', '복사 완료')
      window.location.href = bank.scheme
    } catch {
      window.location.href = bank.scheme
    }
  }

  // 입금 완료 제출
  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!depositorName.trim()) {
      showError('입금자명을 입력해주세요.', '오류')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`/api/pay/${token}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositor_name: depositorName.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || '처리에 실패했습니다.')
      }

      setSubmitted(true)
      success('입금 확인 요청이 완료되었습니다.', '신청 완료')
    } catch (err) {
      showError(err?.message || '처리 중 오류가 발생했습니다.', '오류')
    } finally {
      setSubmitting(false)
    }
  }

  // 로딩 상태
  if (loading) {
    return (
      <div className="page pay-page">
        <section className="checkout-content">
          <div className="checkout-content__inner checkout-content__inner--centered">
            <div className="checkout-pending">
              <div className="checkout-pending__icon">
                <span className="spinner" />
              </div>
              <p>결제 정보를 불러오는 중...</p>
            </div>
          </div>
        </section>
      </div>
    )
  }

  // 에러 상태
  if (errorMessage) {
    return (
      <div className="page pay-page">
        <section className="checkout-content">
          <div className="checkout-content__inner checkout-content__inner--centered">
            <div className="checkout-pending">
              <div className="checkout-pending__icon">⚠️</div>
              <h2>결제 링크 오류</h2>
              <p>{errorMessage}</p>
              <Link to="/pricing" className="btn btn--primary">
                요금제 페이지로 이동
              </Link>
            </div>
          </div>
        </section>
      </div>
    )
  }

  // 제출 완료 후 대기 화면
  if (submitted) {
    return (
      <div className="page pay-page">
        <section className="checkout-hero">
          <div className="checkout-hero__inner">
            <h1>입금 확인 중</h1>
            <p>{paymentInfo.plan_name} 플랜 결제 요청이 완료되었습니다</p>
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
                  <span>{paymentInfo.plan_name}</span>
                </div>
                <div className="checkout-pending__row">
                  <span>결제 금액</span>
                  <span>₩{paymentInfo.amount.toLocaleString()}</span>
                </div>
                <div className="checkout-pending__row">
                  <span>입금자명</span>
                  <span>{depositorName}</span>
                </div>
              </div>

              <p className="checkout-pending__help">
                이 창을 닫아도 됩니다. 구독 활성화 시 알림을 보내드립니다.
              </p>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page pay-page">
      <section className="checkout-hero">
        <div className="checkout-hero__inner">
          <h1>결제하기</h1>
          <p>{paymentInfo.plan_name} 플랜</p>
        </div>
      </section>

      <section className="checkout-content">
        <div className="checkout-content__inner checkout-content__inner--single">
          <form className="checkout-form" onSubmit={handleSubmit}>
            {/* 결제 정보 */}
            <div className="checkout-section">
              <h2>입금 정보</h2>

              <div className="checkout-account checkout-account--main">
                <div className="checkout-account__row">
                  <span className="checkout-account__label">은행명</span>
                  <span className="checkout-account__value">{paymentInfo.bank_name}</span>
                </div>
                <div className="checkout-account__row">
                  <span className="checkout-account__label">계좌번호</span>
                  <span className="checkout-account__value checkout-account__value--account">{paymentInfo.account_number}</span>
                </div>
                <div className="checkout-account__row">
                  <span className="checkout-account__label">예금주</span>
                  <span className="checkout-account__value">{paymentInfo.account_holder}</span>
                </div>
                <div className="checkout-account__row checkout-account__row--amount">
                  <span className="checkout-account__label">입금 금액</span>
                  <span className="checkout-account__value checkout-account__value--price">₩{paymentInfo.amount.toLocaleString()}</span>
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

            {/* 은행 앱 바로가기 */}
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

            {/* 입금자명 입력 */}
            <div className="checkout-section">
              <h2>입금자명 <span className="checkout-section__required">*필수</span></h2>
              <div className="checkout-field">
                <input
                  type="text"
                  value={depositorName}
                  onChange={(e) => setDepositorName(e.target.value)}
                  placeholder="홍길동 (은행 계좌 실명)"
                  maxLength={50}
                />
                <p className="checkout-field__hint checkout-field__hint--important">
                  은행 계좌에 등록된 실명을 입력해주세요 (입금 확인용)
                </p>
              </div>
            </div>

            {/* 입금 완료 버튼 */}
            <button
              type="submit"
              className="btn btn--primary btn--full btn--lg"
              disabled={submitting}
            >
              {submitting ? (
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
          </form>
        </div>
      </section>
    </div>
  )
}

export default PayPage
