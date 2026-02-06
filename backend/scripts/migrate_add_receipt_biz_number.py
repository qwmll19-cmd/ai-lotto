#!/usr/bin/env python3
"""현금영수증 사업자번호 컬럼 추가 마이그레이션

subscriptions 테이블에 receipt_biz_number 컬럼을 추가합니다.
"""
import os
import sys

# 프로젝트 루트를 경로에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2

from app.config import settings

def migrate():
    """receipt_biz_number 컬럼 추가"""
    db_url = settings.DB_URL

    # SQLAlchemy URL을 psycopg2 형식으로 변환
    if db_url.startswith("postgresql+psycopg2://"):
        db_url = db_url.replace("postgresql+psycopg2://", "postgresql://")
    elif db_url.startswith("sqlite"):
        print("SQLite 데이터베이스는 마이그레이션이 필요하지 않습니다.")
        return

    print(f"Connecting to database...")

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    try:
        # 컬럼이 이미 존재하는지 확인
        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'subscriptions' AND column_name = 'receipt_biz_number'
        """)

        if cur.fetchone():
            print("receipt_biz_number 컬럼이 이미 존재합니다.")
            return

        # 컬럼 추가
        print("Adding receipt_biz_number column...")
        cur.execute("""
            ALTER TABLE subscriptions
            ADD COLUMN receipt_biz_number VARCHAR(10) NULL
        """)

        conn.commit()
        print("Migration completed successfully!")

        # 확인
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'subscriptions' AND column_name = 'receipt_biz_number'
        """)
        result = cur.fetchone()
        if result:
            print(f"  - {result[0]}: {result[1]} (nullable: {result[2]})")

    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    migrate()
