"""
번호 풀 관리 통합 서비스
- DB 접근 로직 일원화
- JSON 변환 통합
- Single Source of Truth
"""

import json
import random
import logging
from datetime import datetime
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.db.models import LottoRecommendLog, LottoDraw

logger = logging.getLogger(__name__)

# 플랜별 줄 수 제한
PLAN_LINE_LIMITS = {
    "free": 1,
    "basic": 5,
    "premium": 10,
    "vip": 20,
}

# 플랜별 번호 제외 제한
PLAN_EXCLUDE_LIMITS = {
    "free": 0,
    "basic": 0,
    "premium": 2,
    "vip": 3,
}

# 플랜별 번호 고정 제한
PLAN_FIXED_LIMITS = {
    "free": 0,
    "basic": 0,
    "premium": 2,
    "vip": 3,
}


class PoolService:
    """
    번호 풀 관리 통합 서비스

    모든 풀 관련 DB 접근은 이 클래스를 통해서만 수행
    - JSON 변환 일원화
    - 비즈니스 로직 중앙화
    - 에러 처리 통합
    """

    def __init__(self, db: Session):
        self.db = db

    # ============================================
    # JSON 변환 (통합)
    # ============================================

    @staticmethod
    def to_json(value) -> Optional[str]:
        """Python 객체 → JSON 문자열 (저장용)"""
        if value is None:
            return None
        return json.dumps(value, ensure_ascii=False)

    @staticmethod
    def from_json(value, default=None):
        """
        JSON 문자열/객체 → Python 객체 (읽기용)

        SQLAlchemy JSON 타입은 자동 변환되지만,
        TEXT 타입 또는 마이그레이션 데이터는 문자열일 수 있음
        """
        if value is None:
            return default
        if isinstance(value, (list, dict)):
            return value
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning(f"JSON 파싱 실패: {e}, value type: {type(value)}")
            return default

    # ============================================
    # 내부 헬퍼
    # ============================================

    def _get_log(self, user_id: int, target_draw_no: int,
                 plan_type: str) -> Optional[LottoRecommendLog]:
        """추천 로그 조회"""
        return self.db.query(LottoRecommendLog).filter(
            LottoRecommendLog.account_user_id == user_id,
            LottoRecommendLog.target_draw_no == target_draw_no,
            LottoRecommendLog.plan_type == plan_type,
        ).first()

    def _build_stats(self) -> Optional[dict]:
        """통계 데이터 생성 (번호 생성에 필요)"""
        # 순환 import 방지를 위해 함수 내에서 import
        from . import build_stats_from_draws, draws_to_dict_list

        draws = self.db.query(LottoDraw).order_by(
            LottoDraw.draw_no.desc()
        ).limit(200).all()

        if not draws:
            logger.warning("로또 추첨 데이터가 없습니다")
            return None

        return build_stats_from_draws(draws_to_dict_list(draws))

    def _generate_pool(self, plan_type: str, stats: Optional[dict],
                       exclude: List[int] = None,
                       fixed: List[int] = None) -> List[List[int]]:
        """
        플랜/설정별 번호 풀 생성

        Args:
            plan_type: free, basic, premium, vip
            stats: 통계 데이터 (없으면 랜덤 생성)
            exclude: 제외할 번호 리스트
            fixed: 고정할 번호 리스트
        """
        # 순환 import 방지를 위해 함수 내에서 import
        from .generator import (
            generate_basic_lines,
            generate_premium_lines,
            generate_vip_lines,
            generate_basic_lines_with_exclude,
            generate_premium_lines_with_fixed,
            generate_vip_lines_with_fixed,
            generate_free_line,
        )

        exclude = exclude or []
        fixed = fixed or []
        has_settings = bool(exclude or fixed)

        # 통계 없으면 완전 랜덤 생성
        if not stats:
            max_lines = PLAN_LINE_LIMITS.get(plan_type, 1)
            logger.info(f"통계 없음 - 랜덤 {max_lines}줄 생성")
            return [sorted(random.sample(range(1, 46), 6)) for _ in range(max_lines)]

        # 플랜별 생성 로직
        if plan_type == "vip":
            if has_settings:
                return generate_vip_lines_with_fixed(stats, exclude, fixed)
            return generate_vip_lines(stats)

        elif plan_type == "premium":
            if has_settings:
                return generate_premium_lines_with_fixed(stats, exclude, fixed)
            return generate_premium_lines(stats)

        elif plan_type == "basic":
            if exclude:
                return generate_basic_lines_with_exclude(stats, 5, exclude)
            return generate_basic_lines(stats, 5)

        else:  # free
            return [generate_free_line(stats)]

    # ============================================
    # 공개 API
    # ============================================

    def get_pool_status(self, user_id: int, target_draw_no: int,
                        plan_type: str) -> dict:
        """
        풀 상태 조회 (프론트엔드 API용)

        Returns:
            {
                pool_exists: bool,
                pool_total: int,
                revealed_count: int,
                revealed_lines: List[List[int]],
                all_revealed: bool,
                settings: {exclude: [], fixed: []}
            }
        """
        log = self._get_log(user_id, target_draw_no, plan_type)
        max_lines = PLAN_LINE_LIMITS.get(plan_type, 1)

        if not log:
            return {
                "pool_exists": False,
                "pool_total": max_lines,
                "revealed_count": 0,
                "revealed_lines": [],
                "all_revealed": False,
                "settings": {"exclude": [], "fixed": []},
            }

        pool = self.from_json(log.pool_lines, [])
        revealed = self.from_json(log.revealed_indices, [])
        settings = self.from_json(log.settings_data, {"exclude": [], "fixed": []})

        pool_total = len(pool) if pool else max_lines
        revealed_lines = [pool[i] for i in sorted(revealed)] if pool else []

        return {
            "pool_exists": bool(pool),
            "pool_total": pool_total,
            "revealed_count": len(revealed),
            "revealed_lines": revealed_lines,
            "all_revealed": len(revealed) >= pool_total,
            "settings": settings,
        }

    def get_or_create_pool(self, user_id: int, target_draw_no: int,
                           plan_type: str, exclude: List[int] = None,
                           fixed: List[int] = None) -> LottoRecommendLog:
        """
        풀 조회 또는 생성

        - 기존 풀이 있고 설정이 같으면 재사용
        - 설정이 다르면 새 풀 생성 (기존 풀 교체)
        - 풀이 없으면 새로 생성
        """
        exclude = sorted(exclude or [])
        fixed = sorted(fixed or [])
        settings = {"exclude": exclude, "fixed": fixed}

        log = self._get_log(user_id, target_draw_no, plan_type)

        if log:
            existing_pool = self.from_json(log.pool_lines, None)
            existing_settings = self.from_json(log.settings_data, {"exclude": [], "fixed": []})

            # 풀이 있고 설정이 같으면 재사용
            if existing_pool:
                if (existing_settings.get("exclude", []) == exclude and
                    existing_settings.get("fixed", []) == fixed):
                    logger.debug(f"기존 풀 재사용: user={user_id}, draw={target_draw_no}")
                    return log

            # 설정 변경 또는 풀 없음 → 새로 생성
            logger.info(f"풀 재생성: user={user_id}, 설정 변경={settings}")
            stats = self._build_stats()
            pool = self._generate_pool(plan_type, stats, exclude, fixed)

            log.pool_lines = pool
            log.revealed_indices = []
            log.lines = self.to_json([])
            log.settings_data = self.to_json(settings)
            # JSON 컬럼 변경 명시적 알림
            flag_modified(log, "pool_lines")
            flag_modified(log, "revealed_indices")
            flag_modified(log, "lines")
            flag_modified(log, "settings_data")
            self.db.commit()
            return log

        # 새 로그 생성
        logger.info(f"새 풀 생성: user={user_id}, plan={plan_type}")
        stats = self._build_stats()
        pool = self._generate_pool(plan_type, stats, exclude, fixed)

        log = LottoRecommendLog(
            user_id=user_id,
            account_user_id=user_id,
            target_draw_no=target_draw_no,
            lines=self.to_json([]),
            recommend_time=datetime.utcnow(),
            plan_type=plan_type,
            pool_lines=pool,
            revealed_indices=[],
            settings_data=self.to_json(settings),
            is_matched=False,
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log

    def reveal_one_line(self, user_id: int, target_draw_no: int,
                        plan_type: str, exclude: List[int] = None,
                        fixed: List[int] = None) -> dict:
        """
        1줄 공개

        Returns:
            {
                success: bool,
                line: List[int] or None,
                message: str (실패 시),
                revealed_count: int,
                pool_total: int,
                all_revealed: bool,
                revealed_lines: List[List[int]],
                settings: dict
            }
        """
        log = self.get_or_create_pool(user_id, target_draw_no, plan_type, exclude, fixed)

        pool = self.from_json(log.pool_lines, [])
        revealed = self.from_json(log.revealed_indices, [])
        settings = self.from_json(log.settings_data, {"exclude": [], "fixed": []})

        # 이미 모두 공개됨
        if len(revealed) >= len(pool):
            revealed_lines = [pool[i] for i in sorted(revealed)]
            return {
                "success": False,
                "message": "이미 모든 번호를 받았습니다.",
                "line": None,
                "revealed_count": len(revealed),
                "pool_total": len(pool),
                "all_revealed": True,
                "revealed_lines": revealed_lines,
                "settings": settings,
            }

        # 미공개 인덱스에서 랜덤 선택
        unrevealed = [i for i in range(len(pool)) if i not in revealed]
        selected_idx = random.choice(unrevealed)
        selected_line = pool[selected_idx]

        # 업데이트
        revealed.append(selected_idx)
        revealed_lines = [pool[i] for i in sorted(revealed)]

        # 새 리스트로 할당하여 SQLAlchemy가 변경 감지하도록 함
        log.revealed_indices = list(revealed)
        log.lines = self.to_json(revealed_lines)
        # JSON 컬럼 변경 명시적 알림
        flag_modified(log, "revealed_indices")
        flag_modified(log, "lines")
        self.db.commit()

        logger.info(f"1줄 공개: user={user_id}, {len(revealed)}/{len(pool)}, indices={log.revealed_indices}")

        return {
            "success": True,
            "line": selected_line,
            "revealed_count": len(revealed),
            "pool_total": len(pool),
            "all_revealed": len(revealed) >= len(pool),
            "revealed_lines": revealed_lines,
            "settings": settings,
        }

    def reveal_all_lines(self, user_id: int, target_draw_no: int,
                         plan_type: str, exclude: List[int] = None,
                         fixed: List[int] = None) -> dict:
        """
        전체 공개

        Returns:
            {
                success: bool,
                lines: List[List[int]],
                pool_total: int,
                all_revealed: bool,
                already_revealed: bool,
                settings: dict
            }
        """
        log = self.get_or_create_pool(user_id, target_draw_no, plan_type, exclude, fixed)

        pool = self.from_json(log.pool_lines, [])
        revealed = self.from_json(log.revealed_indices, [])
        settings = self.from_json(log.settings_data, {"exclude": [], "fixed": []})

        already_revealed = len(revealed) >= len(pool)

        # 모두 공개 처리
        all_indices = list(range(len(pool)))

        log.revealed_indices = list(all_indices)
        log.lines = self.to_json(pool)
        # JSON 컬럼 변경 명시적 알림
        flag_modified(log, "revealed_indices")
        flag_modified(log, "lines")
        self.db.commit()

        logger.info(f"전체 공개: user={user_id}, {len(pool)}줄, already={already_revealed}")

        return {
            "success": True,
            "lines": pool,
            "pool_total": len(pool),
            "all_revealed": True,
            "already_revealed": already_revealed,
            "settings": settings,
        }

    # ============================================
    # 유틸리티
    # ============================================

    @staticmethod
    def get_max_exclude(plan_type: str) -> int:
        """플랜별 최대 제외 개수"""
        return PLAN_EXCLUDE_LIMITS.get(plan_type, 0)

    @staticmethod
    def get_max_fixed(plan_type: str) -> int:
        """플랜별 최대 고정 개수"""
        return PLAN_FIXED_LIMITS.get(plan_type, 0)

    @staticmethod
    def get_max_lines(plan_type: str) -> int:
        """플랜별 최대 줄 수"""
        return PLAN_LINE_LIMITS.get(plan_type, 1)
