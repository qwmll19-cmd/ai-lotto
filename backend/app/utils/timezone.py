"""한국 시간대 유틸리티"""
from datetime import datetime, timezone, timedelta

# 한국 표준시 (UTC+9)
KST = timezone(timedelta(hours=9))


def now_kst() -> datetime:
    """
    현재 UTC 시간 반환 (timezone-naive)

    주의: 함수명은 now_kst이지만 실제로는 UTC를 반환합니다.
    DB에 UTC로 저장되어 있고, 프론트엔드에서 KST로 변환하여 표시하므로
    백엔드에서는 UTC를 사용해야 합니다.

    TODO: 함수명을 now_utc로 변경하거나, DB 저장 방식을 KST로 통일 필요
    """
    return datetime.utcnow()
