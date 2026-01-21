function WhySection() {
  return (
    <section className="ai-principle" id="why">
      {/* 히어로 영역 */}
      <div className="ai-principle__hero">
        <h2>로또 AI 번호 생성 원리</h2>
        <p>로또, 이제 감이 아니라 데이터로 선택하세요.</p>
      </div>

      {/* 설명 박스 */}
      <div className="ai-principle__desc-box">
        <p>
          팡팡로또는 20년 이상 누적된 로또 당첨 데이터를 바탕으로, 번호별 출현 경향과 패턴을 통계·인공지능으로 분석합니다.
        </p>
        <p>
          당첨 사례가 거의 없었던 극단적인 조합·패턴은 우선적으로 제외하고, 비교적 안정적인 패턴 위주로 번호를 추천합니다.
        </p>
        <p>
          전체·최근 회차의 흐름, 번호 분포, 패턴 정보를 함께 고려해 비효율적인 조합 대신 보다 합리적인 후보군에서 번호를 골라드립니다.
        </p>
        <p className="ai-principle__disclaimer">
          정확한 알고리즘과 세부 수식은 서비스의 핵심 자산이기 때문에 비공개이며, 위 내용은 이해를 돕기 위한 개략적인 설명입니다.
        </p>
      </div>

      {/* 4단계 카드 */}
      <div className="ai-principle__steps">
        <article className="ai-principle__step-card">
          <h3>1. 전체 데이터 학습</h3>
          <p>1회부터 현재 회차까지의 모든 로또 당첨 이력을 통째로 수집해 하나의 학습 데이터로 만듭니다.</p>
          <span>회차별 번호 등장 빈도, 구간별 분포, 연속번호·패턴 등을 함께 분석해 장기적인 흐름을 파악합니다.</span>
        </article>
        <article className="ai-principle__step-card">
          <h3>2. HOT/COLD 번호 분석</h3>
          <p>전체 기간 데이터를 기준으로 자주 등장한 번호(HOT)와 오래 나오지 않은 번호(COLD)를 구분합니다.</p>
          <span>두 그룹을 단순 분리하는 데서 끝나지 않고, 회차별 변화 추이를 함께 보면서 특정 번호가 과열되었는지, 잠잠한지까지 체크합니다.</span>
        </article>
        <article className="ai-principle__step-card">
          <h3>3. 패턴 필터링</h3>
          <p>홀짝 비율, 번호 구간 분포, 연속번호·쌍번호 등 다양한 패턴을 점검해, 과거에 거의 나오지 않았던 비현실적인 조합을 걸러냅니다.</p>
          <span>이 과정을 통해 통계적으로 너무 극단적인 조합은 미리 제외하고, 실제 추첨 결과와 더 비슷한 모양의 후보만 남겨 둡니다.</span>
        </article>
        <article className="ai-principle__step-card">
          <h3>4. AI 종합 추천</h3>
          <p>서로 다른 기준으로 학습한 4가지 독립 로직이 각자 추천한 번호 후보를 먼저 만들어 냅니다.</p>
          <span>그다음 이 후보들을 하나로 통합하면서 중복·편향을 조정해, 통계적 균형과 다양성을 모두 고려한 최종 번호 조합을 추천합니다.</span>
        </article>
      </div>

      {/* 경고 문구 */}
      <p className="ai-principle__warning">
        당첨 보장은 아니지만, 데이터로 감을 보완해 줍니다.
      </p>
    </section>
  )
}

export default WhySection
