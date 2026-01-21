-- Align Postgres schema with current models (idempotent)

-- Core tables
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

CREATE TABLE IF NOT EXISTS lotto_stats_cache (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    updated_at TIMESTAMP NOT NULL,
    total_draws INTEGER NOT NULL,
    most_common JSONB NOT NULL,
    least_common JSONB NOT NULL,
    ai_scores JSONB NOT NULL
);

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

CREATE TABLE IF NOT EXISTS ops_request_logs (
    id SERIAL PRIMARY KEY,
    method VARCHAR(10) NOT NULL,
    path VARCHAR(200) NOT NULL,
    status_code INTEGER NOT NULL,
    duration_ms FLOAT NOT NULL,
    is_error BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

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

-- Ensure columns exist for recommend logs
ALTER TABLE lotto_recommend_logs ADD COLUMN IF NOT EXISTS account_user_id BIGINT;
ALTER TABLE lotto_recommend_logs ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20);
ALTER TABLE lotto_recommend_logs ADD COLUMN IF NOT EXISTS pool_lines JSONB;
ALTER TABLE lotto_recommend_logs ADD COLUMN IF NOT EXISTS revealed_indices JSONB;
ALTER TABLE lotto_recommend_logs ADD COLUMN IF NOT EXISTS settings_data JSONB;
ALTER TABLE lotto_recommend_logs ADD COLUMN IF NOT EXISTS is_matched BOOLEAN DEFAULT FALSE;
ALTER TABLE lotto_recommend_logs ADD COLUMN IF NOT EXISTS matched_at TIMESTAMP;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lotto_draws_date ON lotto_draws(draw_date);
CREATE INDEX IF NOT EXISTS idx_lotto_draws_created ON lotto_draws(created_at);
CREATE INDEX IF NOT EXISTS idx_lotto_logs_user ON lotto_recommend_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_lotto_logs_account_user ON lotto_recommend_logs(account_user_id);
CREATE INDEX IF NOT EXISTS idx_lotto_logs_draw ON lotto_recommend_logs(target_draw_no);
CREATE INDEX IF NOT EXISTS idx_lotto_logs_time ON lotto_recommend_logs(recommend_time);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_draw_plan ON lotto_recommend_logs(account_user_id, target_draw_no, plan_type);
CREATE INDEX IF NOT EXISTS idx_users_identifier ON users(identifier);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_users_subscription_type ON users(subscription_type);
CREATE INDEX IF NOT EXISTS idx_users_subscription_expires ON users(subscription_expires_at);
CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_free_trial_phone ON free_trial_applications(phone);
CREATE INDEX IF NOT EXISTS idx_ops_logs_created ON ops_request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ops_logs_error ON ops_request_logs(is_error);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_phone ON subscriptions(phone);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_type);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires ON subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_plan_perf_draw ON plan_performance_stats(draw_no);
CREATE INDEX IF NOT EXISTS idx_plan_perf_plan ON plan_performance_stats(plan_type);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);
