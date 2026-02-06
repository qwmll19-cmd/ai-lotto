import { Link } from 'react-router-dom'
import HeroSection from '../../components/HeroSection.jsx'
import WhySection from '../../components/WhySection.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

function Home() {
  const { isAuthed, user } = useAuth()

  // 사용자 현재 티어
  const userTier = user?.tier?.toUpperCase() || null

  // 플랜 순서 (업그레이드/다운그레이드 판단용)
  const tierOrder = { FREE: 0, BASIC: 1, PREMIUM: 2, VIP: 3 }

  // 버튼 상태 결정 함수
  const getButtonProps = (planTier, planId) => {
    const currentIndex = tierOrder[userTier] ?? -1
    const planIndex = tierOrder[planTier]

    // 현재 이용 중인 플랜
    if (userTier === planTier) {
      return { text: '현재 이용 중', link: null, disabled: true, variant: 'ghost' }
    }

    // 로그인 상태에서 낮은 플랜
    if (isAuthed && planIndex < currentIndex) {
      return { text: '현재 플랜보다 낮음', link: null, disabled: true, variant: 'ghost' }
    }

    // 로그인 상태에서 높은 플랜
    if (isAuthed && planIndex > currentIndex) {
      return { text: '업그레이드', link: `/checkout?plan=${planId}`, disabled: false, variant: 'primary' }
    }

    // 비로그인 또는 FREE 사용자
    if (planId === 'free') {
      return { text: '무료로 시작', link: '/signup', disabled: false, variant: 'ghost' }
    }
    return { text: '시작하기', link: `/checkout?plan=${planId}`, disabled: false, variant: 'primary' }
  }
  // hash 네비게이션은 ScrollToTop에서 중앙 처리

  return (
    <div className="page">
      {/* Hero 섹션 */}
      <HeroSection />

      {/* AI 번호 생성 원리 섹션 */}
      <WhySection />

      {/* 요금제 미리보기 섹션 */}
      <section className="pricing-preview">
        <div className="pricing-preview__inner">
          <h2>요금제</h2>
          <p className="pricing-preview__desc">나에게 맞는 플랜을 선택하세요.</p>
          <p className="pricing-preview__vat">모든 가격은 VAT 포함입니다.</p>

          <div className="pricing-preview__grid">
            {/* Free */}
            {(() => {
              const btnProps = getButtonProps('FREE', 'free')
              const isCurrent = userTier === 'FREE'
              return (
                <div className={`pricing-preview__card ${isCurrent ? 'pricing-preview__card--current' : ''}`}>
                  {isCurrent && <div className="pricing-preview__badge pricing-preview__badge--current">현재 이용 중</div>}
                  <h3>Free</h3>
                  <p className="pricing-preview__subtitle">로또 AI를 처음 체험해보는 분께</p>
                  <div className="pricing-preview__price">
                    <span className="pricing-preview__amount">₩0</span>
                    <span className="pricing-preview__period">/월</span>
                  </div>
                  <ul className="pricing-preview__features">
                    <li>✓ 매주 AI 추천 (1줄)</li>
                    <li className="pricing-preview__bonus">✓ 가입 첫 회차 보너스 +1줄</li>
                    <li>✓ 기본 통계 조회</li>
                    <li>✓ 히스토리 14일 보관</li>
                  </ul>
                  {btnProps.link ? (
                    <Link to={btnProps.link} className={`btn btn--${btnProps.variant} btn--full`}>{btnProps.text}</Link>
                  ) : (
                    <button className={`btn btn--${btnProps.variant} btn--full`} disabled={btnProps.disabled}>{btnProps.text}</button>
                  )}
                </div>
              )
            })()}

            {/* Basic */}
            {(() => {
              const btnProps = getButtonProps('BASIC', 'basic')
              const isCurrent = userTier === 'BASIC'
              return (
                <div className={`pricing-preview__card ${isCurrent ? 'pricing-preview__card--current' : ''}`}>
                  {isCurrent && <div className="pricing-preview__badge pricing-preview__badge--current">현재 이용 중</div>}
                  <h3>Basic</h3>
                  <p className="pricing-preview__subtitle">더 많은 조합이 필요한 분께</p>
                  <div className="pricing-preview__price">
                    <span className="pricing-preview__amount">₩4,900</span>
                    <span className="pricing-preview__period">/월</span>
                  </div>
                  <ul className="pricing-preview__features">
                    <li>✓ 매주 AI 추천 (5줄)</li>
                    <li>✓ 상세 통계 및 분석</li>
                    <li>✓ 히스토리 14일 보관</li>
                  </ul>
                  {btnProps.link ? (
                    <Link to={btnProps.link} className={`btn btn--${btnProps.variant} btn--full`}>{btnProps.text}</Link>
                  ) : (
                    <button className={`btn btn--${btnProps.variant} btn--full`} disabled={btnProps.disabled}>{btnProps.text}</button>
                  )}
                </div>
              )
            })()}

            {/* Premium */}
            {(() => {
              const btnProps = getButtonProps('PREMIUM', 'premium')
              const isCurrent = userTier === 'PREMIUM'
              return (
                <div className={`pricing-preview__card ${isCurrent ? 'pricing-preview__card--current' : 'pricing-preview__card--popular'}`}>
                  {isCurrent ? (
                    <div className="pricing-preview__badge pricing-preview__badge--current">현재 이용 중</div>
                  ) : (
                    <div className="pricing-preview__badge">인기</div>
                  )}
                  <h3>Premium</h3>
                  <p className="pricing-preview__subtitle">본격적인 AI 분석이 필요한 분께</p>
                  <div className="pricing-preview__price">
                    <span className="pricing-preview__amount">₩8,900</span>
                    <span className="pricing-preview__period">/월</span>
                  </div>
                  <ul className="pricing-preview__features">
                    <li>✓ 매주 AI 추천 (10줄)</li>
                    <li>✓ AI 핵심 조합 1줄 포함</li>
                    <li>✓ 히스토리 60일 보관</li>
                    <li>✓ 고급 패턴 분석</li>
                  </ul>
                  {btnProps.link ? (
                    <Link to={btnProps.link} className={`btn btn--${btnProps.variant} btn--full`}>{btnProps.text}</Link>
                  ) : (
                    <button className={`btn btn--${btnProps.variant} btn--full`} disabled={btnProps.disabled}>{btnProps.text}</button>
                  )}
                </div>
              )
            })()}

            {/* VIP */}
            {(() => {
              const btnProps = getButtonProps('VIP', 'vip')
              const isCurrent = userTier === 'VIP'
              return (
                <div className={`pricing-preview__card ${isCurrent ? 'pricing-preview__card--current' : ''}`}>
                  {isCurrent && <div className="pricing-preview__badge pricing-preview__badge--current">현재 이용 중</div>}
                  <h3>VIP</h3>
                  <p className="pricing-preview__subtitle">최대 당첨 확률을 원하는 분께</p>
                  <div className="pricing-preview__price">
                    <span className="pricing-preview__amount">₩11,900</span>
                    <span className="pricing-preview__period">/월</span>
                  </div>
                  <ul className="pricing-preview__features">
                    <li>✓ 매주 AI 추천 (20줄)</li>
                    <li>✓ AI 핵심 조합 2줄 포함</li>
                    <li>✓ 히스토리 90일 보관</li>
                    <li>✓ 우선 고객 지원</li>
                  </ul>
                  {btnProps.link ? (
                    <Link to={btnProps.link} className={`btn btn--${btnProps.variant} btn--full`}>{btnProps.text}</Link>
                  ) : (
                    <button className={`btn btn--${btnProps.variant} btn--full`} disabled={btnProps.disabled}>{btnProps.text}</button>
                  )}
                </div>
              )
            })()}
          </div>

          <div className="pricing-preview__more">
            <Link to="/pricing#comparison" className="btn btn--ghost">요금제 상세 보기</Link>
          </div>
        </div>
      </section>

      {/* FAQ 섹션 - 리스트 형태 */}
      <section className="faq-list-section">
        <div className="faq-list-section__inner">
          <h2>FAQ · 이용 안내</h2>
          <p className="faq-list-section__desc">서비스 이용 전 자주 묻는 질문을 확인해 주세요.</p>

          <div className="faq-list">
            <div className="faq-list__item">
              <h3>정말 당첨 확률이 올라가나요?</h3>
              <p>로또는 매 회차 독립 추첨으로 당첨을 보장할 수 없습니다. AI는 과거 통계와 패턴을 바탕으로 당첨 가능성이 낮은 조합을 걸러내고 합리적인 후보를 제시하는 정보 서비스입니다.</p>
            </div>
            <div className="faq-list__item">
              <h3>로직은 공개되나요?</h3>
              <p>핵심 알고리즘과 세부 기준은 서비스의 기술 자산이므로 공개하지 않습니다. 대신 큰 흐름과 분석 방식은 페이지에서 투명하게 설명해 드립니다.</p>
            </div>
            <div className="faq-list__item">
              <h3>무료 체험 이후에는 어떻게 되나요?</h3>
              <p>무료 체험은 자동 결제나 강제 유료 전환이 없습니다. 원하시는 경우에만 별도 구독을 선택할 수 있습니다.</p>
            </div>
            <div className="faq-list__item">
              <h3>환불이나 당첨 보장은 되나요?</h3>
              <p>결제일로부터 7일 이내 청약철회가 가능합니다. 단, 번호 열람 시 해당 회차분은 제외되며 미열람분만 환불됩니다. 로또 당첨은 확률 게임이므로 당첨을 보장하지 않습니다.</p>
            </div>
          </div>

          <div className="faq-list-section__more">
            <Link to="/faq" className="btn btn--ghost">더 많은 FAQ 보기</Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
