-- Migration: Add nickname to users table and user_checked_at to lotto_recommend_logs table
-- Date: 2024-01-27
-- Description:
--   1. Issue 1: 계정 정보 표시 문제 해결 - nickname 컬럼 추가
--   2. Issue 2: 히스토리 자동 결과 노출 문제 해결 - user_checked_at 컬럼 추가
--   3. Issue 3: 닉네임 설정 기능 추가

-- ============================================
-- 1. users 테이블에 nickname 컬럼 추가
-- ============================================
-- SQLite
ALTER TABLE users ADD COLUMN nickname VARCHAR(50) NULL;

-- PostgreSQL (if using)
-- ALTER TABLE users ADD COLUMN nickname VARCHAR(50) NULL;


-- ============================================
-- 2. lotto_recommend_logs 테이블에 user_checked_at 컬럼 추가
-- ============================================
-- SQLite
ALTER TABLE lotto_recommend_logs ADD COLUMN user_checked_at TIMESTAMP NULL;

-- PostgreSQL (if using)
-- ALTER TABLE lotto_recommend_logs ADD COLUMN user_checked_at TIMESTAMP NULL;


-- ============================================
-- Verification queries (optional)
-- ============================================
-- Check users table structure
-- PRAGMA table_info(users);
-- or for PostgreSQL: \d users

-- Check lotto_recommend_logs table structure
-- PRAGMA table_info(lotto_recommend_logs);
-- or for PostgreSQL: \d lotto_recommend_logs
