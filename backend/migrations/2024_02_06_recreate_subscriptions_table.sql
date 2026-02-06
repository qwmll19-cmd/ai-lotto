-- Subscriptions 테이블 재생성 (모델과 일치시키기)
-- 2024-02-06
-- 주의: 기존 데이터가 없는 경우에만 실행

-- 기존 테이블 삭제
DROP TABLE IF EXISTS subscriptions;

-- 새 테이블 생성 (모델과 일치)
CREATE TABLE subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,

    -- 구독자 정보
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,

    -- 플랜 정보
    plan_type VARCHAR(20) NOT NULL,
    line_count INTEGER NOT NULL DEFAULT 5,

    -- 상태 관리
    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    -- 결제 정보
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    amount INTEGER,

    -- 자동 승인 여부
    auto_approve BOOLEAN DEFAULT 0,
    approved_by VARCHAR(100),
    approved_at DATETIME,

    -- 기간
    started_at DATETIME,
    expires_at DATETIME,
    cancelled_at DATETIME,

    -- 발송 정보
    last_sent_at DATETIME,
    total_sent_count INTEGER DEFAULT 0,

    -- 입금 확인용 (송금 결제)
    depositor_name VARCHAR(100),
    receipt_phone VARCHAR(30),
    receipt_issued BOOLEAN DEFAULT 0,

    -- 타임스탬프
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX ix_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX ix_subscriptions_payment_id ON subscriptions(payment_id);
CREATE INDEX ix_subscriptions_expires_at ON subscriptions(expires_at);
CREATE INDEX idx_subscriptions_phone ON subscriptions(phone);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
