-- 회원 삭제 시 관련 데이터 CASCADE 삭제를 위한 마이그레이션
-- 실행 전 반드시 백업 필수!

-- 1. subscriptions 테이블: user_id에 CASCADE FK 추가
-- 먼저 고아 레코드 정리 (존재하지 않는 user_id 참조하는 레코드)
DELETE FROM subscriptions
WHERE user_id IS NOT NULL
  AND user_id NOT IN (SELECT id FROM users);

-- FK 추가 (PostgreSQL)
ALTER TABLE subscriptions
ADD CONSTRAINT fk_subscriptions_user_id
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 2. subscriptions 테이블: payment_id에 SET NULL FK 추가
DELETE FROM subscriptions
WHERE payment_id IS NOT NULL
  AND payment_id NOT IN (SELECT id FROM payments);

ALTER TABLE subscriptions
ADD CONSTRAINT fk_subscriptions_payment_id
FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;

-- 3. lotto_recommend_logs 테이블: account_user_id에 CASCADE FK 추가
DELETE FROM lotto_recommend_logs
WHERE account_user_id IS NOT NULL
  AND account_user_id NOT IN (SELECT id FROM users);

ALTER TABLE lotto_recommend_logs
ADD CONSTRAINT fk_lotto_recommend_logs_account_user_id
FOREIGN KEY (account_user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 4. payments 테이블: user_id에 CASCADE FK 추가
DELETE FROM payments
WHERE user_id NOT IN (SELECT id FROM users);

ALTER TABLE payments
ADD CONSTRAINT fk_payments_user_id
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 완료 확인
SELECT 'Migration completed successfully' AS status;
