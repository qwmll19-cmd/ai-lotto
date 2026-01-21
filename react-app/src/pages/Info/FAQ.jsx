function FAQ() {
  return (
    <section className="info">
      <div className="page-head">
        <h1>FAQ · 이용 안내</h1>
        <p>서비스 이용 전 자주 묻는 질문을 확인해 주세요.</p>
      </div>
      <div className="faq-list">
        <div className="faq-item">
          <h3>정말 당첨 확률이 올라가나요?</h3>
          <p>
            로또는 매 회차 독립 추첨으로 당첨을 보장할 수 없습니다. AI는 과거 통계와 패턴을
            바탕으로 당첨 가능성이 낮은 조합을 걸러내고 합리적인 후보를 제시하는 정보 서비스입니다.
          </p>
        </div>
        <div className="faq-item">
          <h3>로직은 공개되나요?</h3>
          <p>
            핵심 알고리즘과 세부 기준은 서비스의 기술 자산이므로 공개하지 않습니다.
            대신 큰 흐름과 분석 방식은 페이지에서 투명하게 설명해 드립니다.
          </p>
        </div>
        <div className="faq-item">
          <h3>무료 체험 이후에는 어떻게 되나요?</h3>
          <p>
            무료 체험은 자동 결제나 강제 유료 전환이 없습니다.
            원하시는 경우에만 별도 구독을 선택할 수 있습니다.
          </p>
        </div>
        <div className="faq-item">
          <h3>환불이나 당첨 보장은 되나요?</h3>
          <p>
            결제일로부터 7일 이내에 청약철회가 가능합니다.
            단, AI 추천 번호를 1회라도 열람한 경우 해당 회차분은 환불 대상에서 제외되며,
            미열람 회차에 한해 부분 환불이 가능합니다.
            본 서비스는 당첨 확률 개선이나 수익 보장을 제공하지 않으며,
            이용 결과로 발생한 손익에 대한 책임은 이용자 본인에게 있습니다.
          </p>
        </div>
      </div>
    </section>
  )
}

export default FAQ
