import { Link } from 'react-router-dom'
import { businessInfo } from '../../config/businessInfo'

function Support() {
  return (
    <section className="info">
      <div className="page-head">
        <h1>고객센터</h1>
        <p>서비스 이용 중 궁금한 점이 있다면 아래 연락처로 문의해 주세요.</p>
      </div>
      <div className="support-box">
        <div className="support-row">
          <span>이메일</span>
          <strong>{businessInfo.email}</strong>
        </div>
        <div className="support-row">
          <span>전화</span>
          <strong>{businessInfo.phone}</strong>
        </div>
        <div className="support-row">
          <span>운영 시간</span>
          <strong>평일 10:00 - 18:00 (주말/공휴일 휴무)</strong>
        </div>
        <div className="support-row">
          <span>응답 시간</span>
          <strong>문의 접수 후 영업일 기준 1-2일 이내</strong>
        </div>
      </div>

      <div className="info__card">
        <h2>자주 묻는 질문</h2>
        <p>
          문의 전에 <Link to="/faq">FAQ 페이지</Link>를 확인해 주세요.
          대부분의 궁금증을 해결하실 수 있습니다.
        </p>
      </div>

      <div className="info__card">
        <h2>문의 유형별 안내</h2>
        <ul>
          <li><strong>서비스 이용 문의:</strong> 회원가입, 로그인, 번호 추천 관련</li>
          <li><strong>기술 문의:</strong> 오류, 버그 신고</li>
          <li><strong>계정 문의:</strong> 비밀번호 분실, 회원 탈퇴</li>
          <li><strong>기타 문의:</strong> 제휴, 광고, 기타</li>
        </ul>
      </div>

      <div className="info__card">
        <h2>비밀번호 분실</h2>
        <p>
          비밀번호를 잊어버리셨나요? 로그인 페이지에서 "비밀번호 찾기"를 클릭하시면
          가입 시 등록한 휴대폰 번호로 인증코드를 받아 비밀번호를 재설정할 수 있습니다.
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/forgot-password" className="btn btn--primary">비밀번호 찾기</Link>
        </p>
      </div>

      <div className="info__card">
        <h2>관련 페이지</h2>
        <ul>
          <li><Link to="/terms">이용약관</Link></li>
          <li><Link to="/privacy">개인정보처리방침</Link></li>
          <li><Link to="/youth">청소년보호정책</Link></li>
          <li><Link to="/faq">자주 묻는 질문</Link></li>
        </ul>
      </div>
    </section>
  )
}

export default Support
