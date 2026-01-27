from __future__ import annotations

import os
import sys

if __package__ is None:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
    if repo_root not in sys.path:
        sys.path.insert(0, repo_root)

from app.db import models  # noqa: F401
from sqlalchemy import text

from app.db.session import Base, engine, db_url


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    if _is_sqlite():
        _ensure_lotto_recommend_columns()
        _ensure_user_refresh_columns()
        _ensure_user_social_columns()
        _ensure_social_accounts_table()
        _ensure_oauth_one_time_tokens_table()
    else:
        # PostgreSQL 마이그레이션
        _ensure_postgres_oauth_columns()


def _is_sqlite() -> bool:
    return db_url.startswith("sqlite")


def _ensure_lotto_recommend_columns() -> None:
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(lotto_recommend_logs)"))
        columns = {row[1] for row in result.fetchall()}
        if "account_user_id" not in columns:
            conn.execute(text("ALTER TABLE lotto_recommend_logs ADD COLUMN account_user_id INTEGER"))
            conn.commit()


def _ensure_user_refresh_columns() -> None:
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(users)"))
        columns = {row[1] for row in result.fetchall()}
        if "refresh_token_hash" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN refresh_token_hash TEXT"))
        if "refresh_token_updated_at" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN refresh_token_updated_at DATETIME"))
        conn.commit()


def _ensure_user_social_columns() -> None:
    """소셜 로그인 지원을 위한 User 테이블 컬럼 추가"""
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(users)"))
        columns = {row[1] for row in result.fetchall()}
        if "email" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN email TEXT"))
        if "name" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN name TEXT"))
        if "phone_number" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN phone_number TEXT"))
        if "profile_image_url" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN profile_image_url TEXT"))
        if "last_login_at" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN last_login_at DATETIME"))
        conn.commit()


def _ensure_social_accounts_table() -> None:
    """social_accounts 테이블 생성 (없는 경우)"""
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='social_accounts'")
        )
        if not result.fetchone():
            conn.execute(text("""
                CREATE TABLE social_accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    provider VARCHAR(20) NOT NULL,
                    provider_user_id VARCHAR(100) NOT NULL,
                    access_token VARCHAR(1000),
                    refresh_token VARCHAR(1000),
                    token_expires_at DATETIME,
                    linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE (provider, provider_user_id)
                )
            """))
            conn.execute(text("CREATE INDEX ix_social_accounts_user_id ON social_accounts(user_id)"))
            conn.commit()


def _ensure_oauth_one_time_tokens_table() -> None:
    """oauth_one_time_tokens 테이블 생성 및 컬럼 추가 (다중 워커 환경 OAuth 지원)"""
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='oauth_one_time_tokens'")
        )
        if not result.fetchone():
            conn.execute(text("""
                CREATE TABLE oauth_one_time_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    token VARCHAR(64) NOT NULL UNIQUE,
                    user_id INTEGER NOT NULL,
                    expires_at DATETIME NOT NULL,
                    used_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    is_new_user BOOLEAN DEFAULT 0,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """))
            conn.execute(text("CREATE INDEX ix_oauth_one_time_tokens_token ON oauth_one_time_tokens(token)"))
            conn.commit()
        else:
            # 기존 테이블에 is_new_user 컬럼 추가
            result = conn.execute(text("PRAGMA table_info(oauth_one_time_tokens)"))
            columns = {row[1] for row in result.fetchall()}
            if "is_new_user" not in columns:
                conn.execute(text("ALTER TABLE oauth_one_time_tokens ADD COLUMN is_new_user BOOLEAN DEFAULT 0"))
                conn.commit()


def _ensure_postgres_oauth_columns() -> None:
    """PostgreSQL: oauth_one_time_tokens 테이블에 is_new_user 컬럼 추가"""
    with engine.connect() as conn:
        # 컬럼 존재 여부 확인 (PostgreSQL)
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'oauth_one_time_tokens' AND column_name = 'is_new_user'
        """))
        if not result.fetchone():
            try:
                conn.execute(text("ALTER TABLE oauth_one_time_tokens ADD COLUMN is_new_user BOOLEAN DEFAULT FALSE"))
                conn.commit()
                print("Added is_new_user column to oauth_one_time_tokens (PostgreSQL)")
            except Exception as e:
                print(f"Column may already exist or error: {e}")
                conn.rollback()


if __name__ == "__main__":
    init_db()
