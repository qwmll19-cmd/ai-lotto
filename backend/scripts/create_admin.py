#!/usr/bin/env python3
"""관리자 계정 생성 스크립트"""

import sys
import os

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.db.session import SessionLocal
from app.db.models import User
from app.services.auth import hash_password


def create_admin(identifier: str, password: str):
    """관리자 계정 생성 또는 기존 계정 승격"""
    db = SessionLocal()
    try:
        # 기존 계정 확인
        user = db.query(User).filter(User.identifier == identifier).first()

        if user:
            # 기존 계정을 관리자로 승격
            user.is_admin = True
            db.commit()
            print(f"기존 계정 '{identifier}'을(를) 관리자로 승격했습니다.")
        else:
            # 새 관리자 계정 생성
            user = User(
                identifier=identifier,
                password_hash=hash_password(password),
                is_admin=True,
                is_active=True,
            )
            db.add(user)
            db.commit()
            print(f"관리자 계정 '{identifier}'을(를) 생성했습니다.")

        print(f"\n로그인 정보:")
        print(f"  아이디: {identifier}")
        print(f"  비밀번호: {password}")
        print(f"\n로그인 후 헤더에 빨간색 '관리자' 링크가 보입니다.")

    finally:
        db.close()


def promote_to_admin(identifier: str):
    """기존 계정을 관리자로 승격"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.identifier == identifier).first()
        if not user:
            print(f"계정 '{identifier}'을(를) 찾을 수 없습니다.")
            return False

        user.is_admin = True
        db.commit()
        print(f"계정 '{identifier}'을(를) 관리자로 승격했습니다.")
        return True
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법:")
        print("  새 관리자 생성: python create_admin.py create <아이디> <비밀번호>")
        print("  기존 계정 승격: python create_admin.py promote <아이디>")
        print()
        print("예시:")
        print("  python create_admin.py create admin admin123")
        print("  python create_admin.py promote myuser@email.com")
        sys.exit(1)

    command = sys.argv[1]

    if command == "create":
        if len(sys.argv) < 4:
            print("아이디와 비밀번호를 입력하세요.")
            print("예: python create_admin.py create admin admin123")
            sys.exit(1)
        create_admin(sys.argv[2], sys.argv[3])

    elif command == "promote":
        if len(sys.argv) < 3:
            print("아이디를 입력하세요.")
            print("예: python create_admin.py promote myuser@email.com")
            sys.exit(1)
        promote_to_admin(sys.argv[2])

    else:
        print(f"알 수 없는 명령: {command}")
        print("'create' 또는 'promote'를 사용하세요.")
        sys.exit(1)
