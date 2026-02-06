-- Subscription 테이블 신규 필드 추가 (송금 결제 지원)
-- 2024-02-06
-- 주의: SQLite는 IF NOT EXISTS를 지원하지 않으므로 먼저 컬럼 존재 여부 확인 필요

-- 구독자 정보 (신규)
ALTER TABLE subscriptions ADD COLUMN name VARCHAR(100);
ALTER TABLE subscriptions ADD COLUMN phone VARCHAR(30);

-- 플랜 정보
ALTER TABLE subscriptions ADD COLUMN line_count INTEGER DEFAULT 5;

-- 결제 정보
ALTER TABLE subscriptions ADD COLUMN payment_method VARCHAR(50);
ALTER TABLE subscriptions ADD COLUMN payment_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE subscriptions ADD COLUMN amount INTEGER;

-- 승인 정보
ALTER TABLE subscriptions ADD COLUMN auto_approve BOOLEAN DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN approved_by VARCHAR(100);
ALTER TABLE subscriptions ADD COLUMN approved_at DATETIME;

-- 발송 정보
ALTER TABLE subscriptions ADD COLUMN last_sent_at DATETIME;
ALTER TABLE subscriptions ADD COLUMN total_sent_count INTEGER DEFAULT 0;

-- 입금 확인용 (송금 결제)
ALTER TABLE subscriptions ADD COLUMN depositor_name VARCHAR(100);
ALTER TABLE subscriptions ADD COLUMN receipt_phone VARCHAR(30);
ALTER TABLE subscriptions ADD COLUMN receipt_issued BOOLEAN DEFAULT 0;

-- 타임스탬프
ALTER TABLE subscriptions ADD COLUMN updated_at DATETIME;

-- user_id nullable로 변경 (SQLite에서는 불가능하므로 스킵)
-- 새 테이블 생성 후 데이터 마이그레이션 필요 시 별도 스크립트 작성

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_subscriptions_phone ON subscriptions (phone);
