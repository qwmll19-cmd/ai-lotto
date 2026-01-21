from backend.app.api.auth import router as auth_router
from backend.app.api.free_trial import router as free_trial_router
from backend.app.api.lotto import router as lotto_router
from backend.app.api.ops import router as ops_router
from backend.app.api.admin import router as admin_router
from backend.app.api.subscription import router as subscription_router
from backend.app.api.oauth import router as oauth_router
from backend.app.api.guest import router as guest_router

__all__ = [
    "auth_router",
    "free_trial_router",
    "lotto_router",
    "ops_router",
    "admin_router",
    "subscription_router",
    "oauth_router",
    "guest_router",
]
