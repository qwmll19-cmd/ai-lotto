-- Payment Token 컬럼 추가 (QR 결제 시스템)
-- 2024-02-07

-- payment_token: QR 코드용 고유 토큰
ALTER TABLE subscriptions ADD COLUMN payment_token VARCHAR(64) UNIQUE;

-- payment_token_expires_at: 토큰 만료 시간 (24시간)
ALTER TABLE subscriptions ADD COLUMN payment_token_expires_at DATETIME;

-- 인덱스 생성
CREATE INDEX idx_subscriptions_payment_token ON subscriptions(payment_token);
