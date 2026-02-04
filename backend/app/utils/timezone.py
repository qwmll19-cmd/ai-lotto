"""한국 시간대 유틸리티"""
from datetime import datetime, timezone, timedelta

# 한국 표준시 (UTC+9)
KST = timezone(timedelta(hours=9))


def now_kst() -> datetime:
    """현재 한국 시간 반환 (timezone-naive for DB compatibility)"""
    # DB에 저장된 datetime과 비교 가능하도록 timezone-naive로 반환
    return datetime.now(KST).replace(tzinfo=None)
