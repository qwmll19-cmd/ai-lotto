"""비즈니스 상수 정의"""

# ============================================
# 구독 플랜 설정
# ============================================
PLAN_CONFIG = {
    "basic": {"line_count": 5, "price": 4900, "name": "베이직"},
    "premium": {"line_count": 10, "price": 9900, "name": "프리미엄"},
    "vip": {"line_count": 20, "price": 13900, "name": "VIP"},
}

PLAN_TYPES = ("free", "basic", "premium", "vip")


# ============================================
# 상태 상수
# ============================================
SUBSCRIPTION_STATUS = {
    "PENDING": "pending",
    "ACTIVE": "active",
    "EXPIRED": "expired",
    "CANCELLED": "cancelled",
}

PAYMENT_STATUS = {
    "PENDING": "pending",
    "COMPLETED": "completed",
    "REFUNDED": "refunded",
    "FAILED": "failed",
}

TRIAL_STATUS = {
    "PENDING": "pending",
    "SENT": "sent",
    "FAILED": "failed",
}


# ============================================
# 페이지네이션 기본값
# ============================================
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


# ============================================
# 기타
# ============================================
MIN_TRAINING_DRAWS = 10  # ML 학습에 필요한 최소 회차 수
