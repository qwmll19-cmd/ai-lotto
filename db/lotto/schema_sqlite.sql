-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 로또 6/45 당첨 번호 테이블 (SQLite)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS lotto_draws (
    draw_no INTEGER PRIMARY KEY,
    draw_date TEXT NOT NULL,
    n1 INTEGER NOT NULL CHECK (n1 BETWEEN 1 AND 45),
    n2 INTEGER NOT NULL CHECK (n2 BETWEEN 1 AND 45),
    n3 INTEGER NOT NULL CHECK (n3 BETWEEN 1 AND 45),
    n4 INTEGER NOT NULL CHECK (n4 BETWEEN 1 AND 45),
    n5 INTEGER NOT NULL CHECK (n5 BETWEEN 1 AND 45),
    n6 INTEGER NOT NULL CHECK (n6 BETWEEN 1 AND 45),
    bonus INTEGER NOT NULL CHECK (bonus BETWEEN 1 AND 45),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lotto_draws_date ON lotto_draws(draw_date);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 통계 캐시 테이블 (SQLite)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS lotto_stats_cache (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    updated_at DATETIME NOT NULL,
    total_draws INTEGER NOT NULL,
    most_common TEXT NOT NULL,
    least_common TEXT NOT NULL,
    ai_scores TEXT NOT NULL
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 추천 로그 테이블 (SQLite)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS lotto_recommend_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    account_user_id INTEGER,
    target_draw_no INTEGER NOT NULL,
    lines TEXT NOT NULL,
    recommend_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    match_results TEXT DEFAULT NULL,
    plan_type TEXT,
    pool_lines TEXT,
    revealed_indices TEXT,
    settings_data TEXT,
    is_matched INTEGER DEFAULT 0,
    matched_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_lotto_logs_user ON lotto_recommend_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_lotto_logs_account_user ON lotto_recommend_logs(account_user_id);
CREATE INDEX IF NOT EXISTS idx_lotto_logs_draw ON lotto_recommend_logs(target_draw_no);
CREATE INDEX IF NOT EXISTS idx_lotto_logs_time ON lotto_recommend_logs(recommend_time);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 무료 체험 신청 테이블 (SQLite)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS free_trial_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    combo_count INTEGER NOT NULL CHECK (combo_count BETWEEN 1 AND 50),
    status TEXT NOT NULL DEFAULT 'pending',
    consent_terms INTEGER NOT NULL DEFAULT 0,
    consent_marketing INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_free_trial_phone ON free_trial_applications(phone);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 사용자 테이블 (SQLite)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT UNIQUE,
    password_hash TEXT,
    email TEXT,
    name TEXT,
    phone_number TEXT,
    profile_image_url TEXT,
    last_login_at DATETIME,
    refresh_token_hash TEXT,
    refresh_token_updated_at DATETIME,
    is_active INTEGER DEFAULT 1,
    is_admin INTEGER DEFAULT 0,
    subscription_type TEXT DEFAULT 'free',
    subscription_expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_identifier ON users(identifier);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 소셜 계정 테이블 (SQLite)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS social_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at DATETIME,
    linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON social_accounts(user_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 운영 요청 로그 테이블 (SQLite)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS ops_request_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    duration_ms REAL NOT NULL,
    is_error INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ops_logs_created ON ops_request_logs(created_at);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 결제 내역 (SQLite)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    order_id TEXT NOT NULL UNIQUE,
    payment_key TEXT,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT,
    product_name TEXT NOT NULL,
    product_type TEXT NOT NULL,
    duration_days INTEGER NOT NULL DEFAULT 30,
    pg_provider TEXT,
    paid_at DATETIME,
    refunded_at DATETIME,
    refund_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 구독 내역 (SQLite)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    payment_id INTEGER,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    plan_type TEXT NOT NULL,
    line_count INTEGER NOT NULL DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    amount INTEGER,
    auto_approve INTEGER DEFAULT 0,
    approved_by TEXT,
    approved_at DATETIME,
    started_at DATETIME,
    expires_at DATETIME,
    cancelled_at DATETIME,
    last_sent_at DATETIME,
    total_sent_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_phone ON subscriptions(phone);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_type);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 플랜별 성과 통계 (SQLite)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS plan_performance_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    draw_no INTEGER NOT NULL,
    plan_type TEXT NOT NULL,
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
    avg_match_count REAL DEFAULT 0.0,
    top_10_hit_rate REAL,
    top_15_hit_rate REAL,
    top_20_hit_rate REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plan_perf_draw ON plan_performance_stats(draw_no);
CREATE INDEX IF NOT EXISTS idx_plan_perf_plan ON plan_performance_stats(plan_type);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 비밀번호 재설정 토큰 (SQLite)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ML 학습 로그 (SQLite)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS ml_training_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trained_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_draws INTEGER NOT NULL,
    total_feedback_records INTEGER DEFAULT 0,
    train_accuracy REAL,
    test_accuracy REAL,
    weight_logic1 REAL,
    weight_logic2 REAL,
    weight_logic3 REAL,
    weight_logic4 REAL,
    plan_performance TEXT,
    notes TEXT
);
