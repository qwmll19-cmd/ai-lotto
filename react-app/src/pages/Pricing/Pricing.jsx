import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

function Pricing() {
  const { isAuthed } = useAuth()
  // hash 네비게이션은 ScrollToTop에서 중앙 처리

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      period: '월',
      description: '로또 AI를 처음 체험해보는 분께',
      subDescription: 'AI 정밀 분석 기반 1줄 추천',
      highlight: '가입 첫 회차 2줄!',
      features: [
        { text: '매주 AI 추천 (1줄)', included: true },
        { text: '가입 첫 회차 보너스 +1줄', included: true, bonus: true },
        { text: '기본 통계 조회', included: true },
        { text: '히스토리 14일 보관', included: true },
        { text: '번호 제외 설정', included: false },
        { text: '번호 고정 설정', included: false },
      ],
      buttonText: isAuthed ? '현재 플랜' : '무료로 시작',
      buttonLink: isAuthed ? null : '/signup',
      buttonVariant: 'ghost',
      isCurrent: true,
    },
    {
      id: 'basic',
      name: 'Basic',
      price: 4900,
      period: '월',
      description: '더 많은 조합이 필요한 분께',
      subDescription: 'AI 정밀 분석 기반 5줄 추천',
      features: [
        { text: '매주 AI 추천 (5줄)', included: true },
        { text: '상세 통계 및 분석', included: true },
        { text: '히스토리 30일 보관', included: true },
        { text: '번호 제외 설정', included: false },
        { text: '번호 고정 설정', included: false },
        { text: '우선 고객 지원', included: false },
      ],
      buttonText: '시작하기',
      buttonLink: '/checkout?plan=basic',
      buttonVariant: 'primary',
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 9900,
      period: '월',
      description: '본격적인 AI 분석이 필요한 분께',
      subDescription: 'AI 정밀 분석 10줄 + AI 핵심 1줄 포함',
      popular: true,
      features: [
        { text: '매주 AI 추천 (10줄)', included: true },
        { text: 'AI 핵심 조합 1줄 포함', included: true },
        { text: '히스토리 60일 보관', included: true },
        { text: '번호 제외/고정 (각 2개)', included: true },
        { text: '고급 패턴 분석', included: true },
        { text: '우선 고객 지원', included: false },
      ],
      buttonText: '시작하기',
      buttonLink: '/checkout?plan=premium',
      buttonVariant: 'ghost',
    },
    {
      id: 'vip',
      name: 'VIP',
      price: 13900,
      period: '월',
      description: '최대 당첨 확률을 원하는 분께',
      subDescription: 'AI 정밀 분석 + 풀커버리지, AI 핵심 2줄 포함',
      features: [
        { text: '매주 AI 추천 (20줄)', included: true },
        { text: 'AI 핵심 조합 2줄 포함', included: true },
        { text: '히스토리 90일 보관', included: true },
        { text: '번호 제외/고정 (각 3개)', included: true },
        { text: '고급 패턴 분석', included: true },
        { text: '우선 고객 지원', included: true },
      ],
      buttonText: '시작하기',
      buttonLink: '/checkout?plan=vip',
      buttonVariant: 'ghost',
    },
  ]

  return (
    <div className="page pricing-page">
      {/* Hero */}
      <section className="pricing-hero">
        <div className="pricing-hero__inner">
          <h1>요금제 안내</h1>
          <p>나에게 맞는 플랜을 선택하고 AI 추천 번호를 받아보세요.</p>
          <p className="pricing-hero__vat">모든 가격은 VAT 별도입니다.</p>
        </div>
      </section>

      {/* Plans */}
      <section className="pricing-plans">
        <div className="pricing-plans__inner">
          <div className="pricing-plans__grid">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`pricing-card ${plan.popular ? 'pricing-card--popular' : ''}`}
              >
                {plan.popular && <div className="pricing-card__badge">인기</div>}
                {plan.highlight && <div className="pricing-card__badge pricing-card__badge--bonus">{plan.highlight}</div>}
                <div className="pricing-card__header">
                  <h3>{plan.name}</h3>
                  <p className="pricing-card__desc">{plan.description}</p>
                  {plan.subDescription && (
                    <p className="pricing-card__sub-desc">{plan.subDescription}</p>
                  )}
                  <div className="pricing-card__price">
                    <span className="pricing-card__currency">₩</span>
                    <span className="pricing-card__amount">{plan.price.toLocaleString()}</span>
                    <span className="pricing-card__period">/{plan.period}</span>
                  </div>
                </div>

                <ul className="pricing-card__features">
                  {plan.features.map((feature, idx) => (
                    <li
                      key={idx}
                      className={`${feature.included ? '' : 'pricing-card__features--disabled'} ${feature.bonus ? 'pricing-card__features--bonus' : ''}`}
                    >
                      {feature.included ? '✓' : '✗'} {feature.text}
                    </li>
                  ))}
                </ul>

                {plan.buttonLink ? (
                  <Link
                    to={plan.buttonLink}
                    className={`btn btn--${plan.buttonVariant} btn--full`}
                  >
                    {plan.buttonText}
                  </Link>
                ) : (
                  <button
                    className={`btn btn--${plan.buttonVariant} btn--full`}
                    disabled
                  >
                    {plan.buttonText}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="pricing-comparison" id="comparison">
        <div className="pricing-comparison__inner">
          <h2>상세 기능 비교</h2>
          <div className="pricing-table-wrapper">
            <table className="pricing-table">
              <thead>
                <tr>
                  <th>기능</th>
                  <th>Free</th>
                  <th>Basic</th>
                  <th>Premium</th>
                  <th>VIP</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>주간 AI 추천 줄 수</td>
                  <td>1줄 <span className="pricing-table__bonus">(첫 회차 2줄)</span></td>
                  <td>5줄</td>
                  <td>10줄</td>
                  <td>20줄</td>
                </tr>
                <tr>
                  <td>AI 분석 범위</td>
                  <td>AI 정밀 분석</td>
                  <td>AI 정밀 분석</td>
                  <td>AI 정밀 분석</td>
                  <td>AI 정밀 분석 + 풀커버리지</td>
                </tr>
                <tr>
                  <td>AI 핵심 조합</td>
                  <td className="pricing-table--no">-</td>
                  <td className="pricing-table--no">-</td>
                  <td className="pricing-table--yes">1줄 포함</td>
                  <td className="pricing-table--yes">2줄 포함</td>
                </tr>
                <tr>
                  <td>히스토리 보관</td>
                  <td>14일</td>
                  <td>30일</td>
                  <td>60일</td>
                  <td>90일</td>
                </tr>
                <tr>
                  <td>번호 제외</td>
                  <td className="pricing-table--no">-</td>
                  <td className="pricing-table--no">-</td>
                  <td className="pricing-table--yes">2개</td>
                  <td className="pricing-table--yes">3개</td>
                </tr>
                <tr>
                  <td>번호 고정</td>
                  <td className="pricing-table--no">-</td>
                  <td className="pricing-table--no">-</td>
                  <td className="pricing-table--yes">2개</td>
                  <td className="pricing-table--yes">3개</td>
                </tr>
                <tr>
                  <td>상세 통계 분석</td>
                  <td className="pricing-table--no">-</td>
                  <td className="pricing-table--yes">✓</td>
                  <td className="pricing-table--yes">✓</td>
                  <td className="pricing-table--yes">✓</td>
                </tr>
                <tr>
                  <td>프리미엄 AI 분석</td>
                  <td className="pricing-table--no">-</td>
                  <td className="pricing-table--no">-</td>
                  <td className="pricing-table--yes">✓</td>
                  <td className="pricing-table--yes">✓</td>
                </tr>
                <tr>
                  <td>고급 패턴 분석</td>
                  <td className="pricing-table--no">-</td>
                  <td className="pricing-table--no">-</td>
                  <td className="pricing-table--yes">✓</td>
                  <td className="pricing-table--yes">✓</td>
                </tr>
                <tr>
                  <td>우선 고객 지원</td>
                  <td className="pricing-table--no">-</td>
                  <td className="pricing-table--no">-</td>
                  <td className="pricing-table--no">-</td>
                  <td className="pricing-table--yes">✓</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pricing-faq">
        <div className="pricing-faq__inner">
          <h2>자주 묻는 질문</h2>
          <div className="pricing-faq__grid">
            <div className="pricing-faq__item">
              <h3>언제든지 플랜을 변경할 수 있나요?</h3>
              <p>
                네, 언제든지 플랜을 업그레이드하거나 다운그레이드할 수 있습니다.
                업그레이드 시 즉시 적용되며, 다운그레이드는 다음 결제일부터 적용됩니다.
              </p>
            </div>
            <div className="pricing-faq__item">
              <h3>환불 정책은 어떻게 되나요?</h3>
              <p>
                결제일로부터 7일 이내 청약철회가 가능합니다.
                단, AI 추천 번호를 열람한 경우 해당 회차분은 제외되며,
                미열람 회차에 한해 부분 환불이 가능합니다.
              </p>
            </div>
            <div className="pricing-faq__item">
              <h3>결제 수단은 무엇이 있나요?</h3>
              <p>
                신용카드, 체크카드, 카카오페이, 네이버페이 등
                다양한 결제 수단을 지원합니다.
              </p>
            </div>
            <div className="pricing-faq__item">
              <h3>무료 체험은 자동 결제되나요?</h3>
              <p>
                아니요, 무료 플랜은 카드 등록 없이 이용 가능하며
                자동으로 유료 전환되지 않습니다.
              </p>
            </div>
          </div>
          <div className="pricing-faq__more">
            <Link to="/faq" className="btn btn--ghost">
              더 많은 FAQ 보기
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Pricing
