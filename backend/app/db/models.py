from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, Integer, String, Text, JSON, CheckConstraint, UniqueConstraint, ForeignKey

from backend.app.db.session import Base


class NewsDaily(Base):
    __tablename__ = "news_daily"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(Date, index=True)
    source = Column(String(100))
    title = Column(String(500))
    url = Column(String(500))
    category = Column(String(50), index=True)

    # 기사 메타 정보
    is_top = Column(Boolean, default=False)
    keywords = Column(Text, nullable=True)
    sentiment = Column(String(50), nullable=True)

    # 속보 관련
    is_breaking = Column(Boolean, default=False)
    alert_sent = Column(Boolean, default=False)

    # 중복 제거용 (날짜별 주제 키)
    topic_key = Column(String(100), index=True, nullable=True)

    # 핫 점수
    hot_score = Column(Integer, default=0, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)


class MarketDaily(Base):
    __tablename__ = "market_daily"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(Date, index=True)

    # 환율
    usd_krw = Column(Float, nullable=True)

    # 크립토 (주요 BTC 포커스, 나머지는 JSON으로 확장 가능)
    btc_usdt = Column(Float, nullable=True)
    btc_krw = Column(Float, nullable=True)
    btc_usd = Column(Float, nullable=True)
    btc_change_24h = Column(Float, nullable=True)

    # 추가 코인들 (ETH, XRP, SOL, TRX 등) - 심볼: 가격(USD) 형태
    crypto_usd = Column(JSON, nullable=True)

    # 금속/원자재 (USD 기준)
    gold_usd = Column(Float, nullable=True)       # 금 1oz USD
    silver_usd = Column(Float, nullable=True)     # 은 1oz USD
    platinum_usd = Column(Float, nullable=True)   # 백금 1oz USD
    copper_usd = Column(Float, nullable=True)     # 구리 1oz USD
    palladium_usd = Column(Float, nullable=True)  # 팔라디움 1oz USD
    aluminum_usd = Column(Float, nullable=True)   # 알루미늄 1oz USD
    nickel_usd = Column(Float, nullable=True)     # 니켈 1oz USD
    zinc_usd = Column(Float, nullable=True)       # 아연 1oz USD
    lead_usd = Column(Float, nullable=True)       # 납 1oz USD
    oil_usd = Column(Float, nullable=True)        # 원유(예: WTI) 배럴당 USD
    coffee_usd = Column(Float, nullable=True)     # 커피 원두 USD

    # KOSPI 및 지수 관련
    kospi_index = Column(Float, nullable=True)
    kospi_top5 = Column(JSON, nullable=True)  # [{name, price, change, change_rate}]

    # 나스닥
    nasdaq_index = Column(Float, nullable=True)
    nasdaq_top5 = Column(JSON, nullable=True)

    # 글로벌 지수 확장용 (현재는 수집 보류)
    # 예: {"sp500": {...}, "nasdaq100": {...}, "dow": {...}}
    indices = Column(JSON, nullable=True)

    # 전일대비 (09:05에 계산)
    usd_krw_change = Column(Float, nullable=True)
    usd_krw_change_pct = Column(Float, nullable=True)
    kospi_index_change = Column(Float, nullable=True)
    kospi_index_change_pct = Column(Float, nullable=True)
    nasdaq_index_change = Column(Float, nullable=True)
    nasdaq_index_change_pct = Column(Float, nullable=True)

    summary_comment = Column(Text, nullable=True)

    # 데이터 수집 타임스탬프
    created_at = Column(DateTime, default=datetime.utcnow)


class Subscriber(Base):
    __tablename__ = "subscriber"

    chat_id = Column(String(50), primary_key=True, index=True)
    subscribed_alert = Column(Boolean, default=True)
    custom_time = Column(String(10), default="09:10")  # 알림 시간 (HH:MM 형식)
    created_at = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 기존 이메일/휴대폰 로그인용 (소셜 로그인 시 nullable)
    identifier = Column(String(200), nullable=True, unique=True, index=True)
    password_hash = Column(String(200), nullable=True)

    # 소셜 로그인 추가 필드
    email = Column(String(200), nullable=True, index=True)
    name = Column(String(100), nullable=True)
    phone_number = Column(String(30), nullable=True)
    profile_image_url = Column(String(500), nullable=True)
    last_login_at = Column(DateTime, nullable=True)

    # 인증 관련
    refresh_token_hash = Column(String(200), nullable=True)
    refresh_token_updated_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    is_admin = Column(Boolean, default=False, index=True)

    # 구독 관련
    subscription_type = Column(String(20), default="free")  # free, basic, premium, vip
    subscription_expires_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SocialAccount(Base):
    """소셜 계정 연동 (네이버/카카오)"""
    __tablename__ = "social_accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(20), nullable=False)  # NAVER, KAKAO
    provider_user_id = Column(String(100), nullable=False)
    access_token = Column(String(1000), nullable=True)  # OAuth access token (필요시)
    refresh_token = Column(String(1000), nullable=True)  # OAuth refresh token (필요시)
    token_expires_at = Column(DateTime, nullable=True)
    linked_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('provider', 'provider_user_id', name='uq_social_provider_user'),
    )


class FreeTrialApplication(Base):
    __tablename__ = "free_trial_applications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(30), nullable=False, index=True)
    combo_count = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    consent_terms = Column(Boolean, nullable=False, default=False)
    consent_marketing = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("combo_count BETWEEN 1 AND 50", name="combo_count_range"),
    )


class LottoStatsCache(Base):
    """로또 통계 캐시 (싱글톤)"""
    __tablename__ = "lotto_stats_cache"

    id = Column(Integer, primary_key=True, default=1)
    updated_at = Column(DateTime, nullable=False)
    total_draws = Column(Integer, nullable=False)
    most_common = Column(JSON, nullable=False)   # 가장 많이 나온 번호들
    least_common = Column(JSON, nullable=False)  # 가장 적게 나온 번호들
    ai_scores = Column(JSON, nullable=False)     # AI 스코어

    __table_args__ = (
        CheckConstraint('id = 1', name='singleton_check'),
    )


class LottoDraw(Base):
    """로또 당첨 번호 이력"""
    __tablename__ = "lotto_draws"

    draw_no = Column(Integer, primary_key=True)  # 회차
    draw_date = Column(String, nullable=False, index=True)  # 추첨일
    n1 = Column(Integer, nullable=False)
    n2 = Column(Integer, nullable=False)
    n3 = Column(Integer, nullable=False)
    n4 = Column(Integer, nullable=False)
    n5 = Column(Integer, nullable=False)
    n6 = Column(Integer, nullable=False)
    bonus = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint('n1 BETWEEN 1 AND 45', name='n1_range'),
        CheckConstraint('n2 BETWEEN 1 AND 45', name='n2_range'),
        CheckConstraint('n3 BETWEEN 1 AND 45', name='n3_range'),
        CheckConstraint('n4 BETWEEN 1 AND 45', name='n4_range'),
        CheckConstraint('n5 BETWEEN 1 AND 45', name='n5_range'),
        CheckConstraint('n6 BETWEEN 1 AND 45', name='n6_range'),
        CheckConstraint('bonus BETWEEN 1 AND 45', name='bonus_range'),
    )


class LottoRecommendLog(Base):
    """로또 번호 추천 로그"""
    __tablename__ = "lotto_recommend_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    account_user_id = Column(Integer, nullable=True, index=True)
    target_draw_no = Column(Integer, nullable=False, index=True)
    lines = Column(Text, nullable=False)  # JSON string: 추천한 번호 조합들 (공개된 번호)
    recommend_time = Column(DateTime, default=datetime.utcnow)
    match_results = Column(Text, nullable=True)  # JSON string: 당첨 결과

    # 플랜 타입 (무료/베이직/프리미엄/VIP)
    plan_type = Column(String(20), nullable=True, index=True)  # free, basic, premium, vip

    # 번호 풀 시스템 (1줄씩 받기 기능용)
    pool_lines = Column(JSON, nullable=True)  # 전체 풀 번호 (BASIC 5줄, PREMIUM 10줄, VIP 20줄)
    revealed_indices = Column(JSON, nullable=True)  # 이미 공개된 줄 인덱스 [0, 3, 5, ...]

    # 고급 설정 메타데이터 (제외/고정 번호 등)
    settings_data = Column(JSON, nullable=True)  # {"exclude": [1,2,3], "fixed": [7,8]}

    # 매칭 완료 여부
    is_matched = Column(Boolean, default=False, index=True)
    matched_at = Column(DateTime, nullable=True)

    # 동일 유저, 동일 회차, 동일 플랜에 대해 중복 발급 방지
    __table_args__ = (
        UniqueConstraint('account_user_id', 'target_draw_no', 'plan_type', name='uq_user_draw_plan'),
    )


class OpsRequestLog(Base):
    __tablename__ = "ops_request_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    method = Column(String(10), nullable=False)
    path = Column(String(200), nullable=False)
    status_code = Column(Integer, nullable=False)
    duration_ms = Column(Float, nullable=False)
    is_error = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Payment(Base):
    """결제 내역"""
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    order_id = Column(String(100), nullable=False, unique=True, index=True)
    payment_key = Column(String(200), nullable=True)  # PG사 결제키
    amount = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending, completed, failed, refunded, cancelled
    payment_method = Column(String(50), nullable=True)  # card, bank, vbank
    product_name = Column(String(100), nullable=False)
    product_type = Column(String(20), nullable=False)  # basic, premium
    duration_days = Column(Integer, nullable=False, default=30)
    pg_provider = Column(String(50), nullable=True)  # toss, kakao, etc
    paid_at = Column(DateTime, nullable=True)
    refunded_at = Column(DateTime, nullable=True)
    refund_reason = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Subscription(Base):
    """구독 내역"""
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True, index=True)  # 계정 연동 시
    payment_id = Column(Integer, nullable=True, index=True)

    # 구독자 정보
    name = Column(String(100), nullable=False)
    phone = Column(String(30), nullable=False, index=True)

    # 플랜 정보
    plan_type = Column(String(20), nullable=False)  # basic(5줄), premium(10줄), vip(20줄)
    line_count = Column(Integer, nullable=False, default=5)  # 발급 줄 수

    # 상태 관리
    status = Column(String(20), nullable=False, default="pending")  # pending, active, expired, cancelled

    # 결제 정보
    payment_method = Column(String(50), nullable=True)  # card, bank_transfer, manual
    payment_status = Column(String(20), nullable=False, default="pending")  # pending, confirmed, refunded
    amount = Column(Integer, nullable=True)  # 결제 금액

    # 자동 승인 여부
    auto_approve = Column(Boolean, default=False)
    approved_by = Column(String(100), nullable=True)  # 승인자 (관리자 이름/ID)
    approved_at = Column(DateTime, nullable=True)

    # 기간
    started_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True, index=True)
    cancelled_at = Column(DateTime, nullable=True)

    # 발송 정보
    last_sent_at = Column(DateTime, nullable=True)  # 마지막 번호 발송 시간
    total_sent_count = Column(Integer, default=0)  # 총 발송 횟수

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PlanPerformanceStats(Base):
    """플랜별 성과 통계"""
    __tablename__ = "plan_performance_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    draw_no = Column(Integer, nullable=False, index=True)  # 회차
    plan_type = Column(String(20), nullable=False, index=True)  # free, basic, premium, vip

    # 발행 통계
    total_lines = Column(Integer, default=0)  # 해당 회차에 발행한 총 줄 수
    total_users = Column(Integer, default=0)  # 해당 회차에 발행받은 유저 수

    # 적중 통계
    match_0 = Column(Integer, default=0)  # 0개 맞춘 줄 수
    match_1 = Column(Integer, default=0)  # 1개 맞춘 줄 수
    match_2 = Column(Integer, default=0)  # 2개 맞춘 줄 수
    match_3 = Column(Integer, default=0)  # 3개 맞춘 줄 수 (5등)
    match_4 = Column(Integer, default=0)  # 4개 맞춘 줄 수 (4등)
    match_5 = Column(Integer, default=0)  # 5개 맞춘 줄 수 (3등)
    match_5_bonus = Column(Integer, default=0)  # 5개+보너스 맞춘 줄 수 (2등)
    match_6 = Column(Integer, default=0)  # 6개 맞춘 줄 수 (1등)

    # 평균 적중률 (0~6)
    avg_match_count = Column(Float, default=0.0)

    # 상위 번호 적중률 (ML 상위 N개 중 몇 개가 실제 당첨)
    top_10_hit_rate = Column(Float, nullable=True)  # 상위 10개 중 적중 개수
    top_15_hit_rate = Column(Float, nullable=True)  # 상위 15개 중 적중 개수
    top_20_hit_rate = Column(Float, nullable=True)  # 상위 20개 중 적중 개수

    created_at = Column(DateTime, default=datetime.utcnow)


class PasswordResetToken(Base):
    """비밀번호 재설정 토큰"""
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)  # 사용 시 타임스탬프 기록 (일회용)
    created_at = Column(DateTime, default=datetime.utcnow)


class SmsVerification(Base):
    """SMS 인증코드"""
    __tablename__ = "sms_verifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    phone = Column(String(20), nullable=False, index=True)
    code = Column(String(6), nullable=False)  # 6자리 인증코드
    purpose = Column(String(50), nullable=False, default="password_reset")  # password_reset, signup 등
    expires_at = Column(DateTime, nullable=False)
    verified_at = Column(DateTime, nullable=True)  # 인증 완료 시간
    attempts = Column(Integer, default=0)  # 인증 시도 횟수
    created_at = Column(DateTime, default=datetime.utcnow)


class MLTrainingLog(Base):
    """ML 학습 로그"""
    __tablename__ = "ml_training_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trained_at = Column(DateTime, default=datetime.utcnow, index=True)

    # 학습 데이터
    total_draws = Column(Integer, nullable=False)  # 학습에 사용된 회차 수
    total_feedback_records = Column(Integer, default=0)  # 피드백 데이터 수

    # 학습 결과
    train_accuracy = Column(Float, nullable=True)
    test_accuracy = Column(Float, nullable=True)

    # AI 가중치
    weight_logic1 = Column(Float, nullable=True)
    weight_logic2 = Column(Float, nullable=True)
    weight_logic3 = Column(Float, nullable=True)
    weight_logic4 = Column(Float, nullable=True)

    # 플랜별 성과 (JSON)
    plan_performance = Column(JSON, nullable=True)  # {"free": 1.5, "basic": 2.1, ...}

    notes = Column(Text, nullable=True)
