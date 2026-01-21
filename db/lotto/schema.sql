-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 로또 6/45 당첨 번호 테이블
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS lotto_draws (
    draw_no INTEGER PRIMARY KEY,
    draw_date DATE NOT NULL,
    n1 SMALLINT NOT NULL CHECK (n1 BETWEEN 1 AND 45),
    n2 SMALLINT NOT NULL CHECK (n2 BETWEEN 1 AND 45),
    n3 SMALLINT NOT NULL CHECK (n3 BETWEEN 1 AND 45),
    n4 SMALLINT NOT NULL CHECK (n4 BETWEEN 1 AND 45),
    n5 SMALLINT NOT NULL CHECK (n5 BETWEEN 1 AND 45),
    n6 SMALLINT NOT NULL CHECK (n6 BETWEEN 1 AND 45),
    bonus SMALLINT NOT NULL CHECK (bonus BETWEEN 1 AND 45),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lotto_draws_date ON lotto_draws(draw_date);
CREATE INDEX IF NOT EXISTS idx_lotto_draws_created ON lotto_draws(created_at);

COMMENT ON TABLE lotto_draws IS '로또 6/45 당첨 번호 (2002년~현재)';
COMMENT ON COLUMN lotto_draws.draw_no IS '회차 번호';
COMMENT ON COLUMN lotto_draws.draw_date IS '추첨일';
COMMENT ON COLUMN lotto_draws.bonus IS '보너스 번호';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 통계 캐시 테이블 (주 1회 갱신)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS lotto_stats_cache (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    updated_at TIMESTAMP NOT NULL,
    total_draws INTEGER NOT NULL,
    most_common JSONB NOT NULL,
    least_common JSONB NOT NULL,
    ai_scores JSONB NOT NULL
);

COMMENT ON TABLE lotto_stats_cache IS '로또 통계 캐시 (단일 레코드, 매주 갱신)';
COMMENT ON COLUMN lotto_stats_cache.most_common IS '최다 출현 번호 15개 (JSON 배열)';
COMMENT ON COLUMN lotto_stats_cache.least_common IS '최소 출현 번호 15개 (JSON 배열)';
COMMENT ON COLUMN lotto_stats_cache.ai_scores IS 'AI 점수 (JSON 객체: {번호: 점수})';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 추천 로그 테이블 (패턴 분석용)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS lotto_recommend_logs (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    account_user_id BIGINT,
    target_draw_no INTEGER NOT NULL,
    lines JSONB NOT NULL,
    recommend_time TIMESTAMP DEFAULT NOW(),
    match_results JSONB DEFAULT NULL,
    plan_type VARCHAR(20),
    pool_lines JSONB,
    revealed_indices JSONB,
    settings_data JSONB,
    is_matched BOOLEAN DEFAULT FALSE,
    matched_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lotto_logs_user ON lotto_recommend_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_lotto_logs_account_user ON lotto_recommend_logs(account_user_id);
CREATE INDEX IF NOT EXISTS idx_lotto_logs_draw ON lotto_recommend_logs(target_draw_no);
CREATE INDEX IF NOT EXISTS idx_lotto_logs_time ON lotto_recommend_logs(recommend_time);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_draw_plan ON lotto_recommend_logs(account_user_id, target_draw_no, plan_type);

COMMENT ON TABLE lotto_recommend_logs IS '유저별 로또 추천 이력 및 당첨 결과';
COMMENT ON COLUMN lotto_recommend_logs.target_draw_no IS '추천 대상 회차';
COMMENT ON COLUMN lotto_recommend_logs.lines IS '추천 번호 (JSON 배열)';
COMMENT ON COLUMN lotto_recommend_logs.match_results IS '당첨 후 일치 개수 (JSON 객체)';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 무료 체험 신청 테이블
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS free_trial_applications (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    combo_count INTEGER NOT NULL CHECK (combo_count BETWEEN 1 AND 50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    consent_terms BOOLEAN NOT NULL DEFAULT FALSE,
    consent_marketing BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_free_trial_phone ON free_trial_applications(phone);

COMMENT ON TABLE free_trial_applications IS '로또 무료 체험 신청 정보';
COMMENT ON COLUMN free_trial_applications.status IS 'pending|sent|failed';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 사용자 테이블
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    identifier VARCHAR(200) UNIQUE,
    password_hash VARCHAR(200),
    email VARCHAR(200),
    name VARCHAR(100),
    phone_number VARCHAR(30),
    profile_image_url VARCHAR(500),
    last_login_at TIMESTAMP,
    refresh_token_hash VARCHAR(200),
    refresh_token_updated_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    subscription_type VARCHAR(20) DEFAULT 'free',
    subscription_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_identifier ON users(identifier);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_users_subscription_type ON users(subscription_type);
CREATE INDEX IF NOT EXISTS idx_users_subscription_expires ON users(subscription_expires_at);

COMMENT ON TABLE users IS '사용자 계정 정보';
COMMENT ON COLUMN users.identifier IS '사용자 식별자 (username/email)';
COMMENT ON COLUMN users.password_hash IS 'PBKDF2-SHA256 해시된 비밀번호';
COMMENT ON COLUMN users.refresh_token_hash IS '해시된 리프레시 토큰';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 소셜 계정 테이블
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS social_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,
    provider_user_id VARCHAR(100) NOT NULL,
    access_token VARCHAR(1000),
    refresh_token VARCHAR(1000),
    token_expires_at TIMESTAMP,
    linked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON social_accounts(user_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 운영 요청 로그 테이블
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS ops_request_logs (
    id SERIAL PRIMARY KEY,
    method VARCHAR(10) NOT NULL,
    path VARCHAR(200) NOT NULL,
    status_code INTEGER NOT NULL,
    duration_ms FLOAT NOT NULL,
    is_error BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_logs_created ON ops_request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ops_logs_error ON ops_request_logs(is_error);

COMMENT ON TABLE ops_request_logs IS 'API 요청 로그 (모니터링용)';
COMMENT ON COLUMN ops_request_logs.duration_ms IS '응답 시간 (밀리초)';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 결제 내역
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    order_id VARCHAR(100) NOT NULL UNIQUE,
    payment_key VARCHAR(200),
    amount INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50),
    product_name VARCHAR(100) NOT NULL,
    product_type VARCHAR(20) NOT NULL,
    duration_days INTEGER NOT NULL DEFAULT 30,
    pg_provider VARCHAR(50),
    paid_at TIMESTAMP,
    refunded_at TIMESTAMP,
    refund_reason VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 구독 내역
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    payment_id INTEGER,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    plan_type VARCHAR(20) NOT NULL,
    line_count INTEGER NOT NULL DEFAULT 5,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    amount INTEGER,
    auto_approve BOOLEAN DEFAULT FALSE,
    approved_by VARCHAR(100),
    approved_at TIMESTAMP,
    started_at TIMESTAMP,
    expires_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    last_sent_at TIMESTAMP,
    total_sent_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_phone ON subscriptions(phone);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_type);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires ON subscriptions(expires_at);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 플랜별 성과 통계
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS plan_performance_stats (
    id SERIAL PRIMARY KEY,
    draw_no INTEGER NOT NULL,
    plan_type VARCHAR(20) NOT NULL,
    total_lines INTEGER DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    match_0 INTEGER DEFAULT 0,
    match_1 INTEGER DEFAULT 0,
    match_2 INTEGER DEFAULT 0,
    match_3 INTEGER DEFAULT 0,
    match_4 INTEGER DEFAULT 0,
    match_5 INTEGER DEFAULT 0,
    match_5_bonus INTEGER DEFAULT 0,
    match_6 INTEGER DEFAULT 0,
    avg_match_count FLOAT DEFAULT 0.0,
    top_10_hit_rate FLOAT,
    top_15_hit_rate FLOAT,
    top_20_hit_rate FLOAT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_perf_draw ON plan_performance_stats(draw_no);
CREATE INDEX IF NOT EXISTS idx_plan_perf_plan ON plan_performance_stats(plan_type);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 비밀번호 재설정 토큰
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ML 학습 로그
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS ml_training_logs (
    id SERIAL PRIMARY KEY,
    trained_at TIMESTAMP DEFAULT NOW(),
    total_draws INTEGER NOT NULL,
    total_feedback_records INTEGER DEFAULT 0,
    train_accuracy FLOAT,
    test_accuracy FLOAT,
    weight_logic1 FLOAT,
    weight_logic2 FLOAT,
    weight_logic3 FLOAT,
    weight_logic4 FLOAT,
    plan_performance JSONB,
    notes TEXT
);
