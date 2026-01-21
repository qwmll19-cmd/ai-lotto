"""페이지네이션 공통 스키마"""
from typing import Generic, TypeVar, List
from pydantic import BaseModel

T = TypeVar('T')


class PaginationMeta(BaseModel):
    """페이지네이션 메타 정보"""
    total: int
    page: int
    page_size: int


class PaginatedResponse(BaseModel, Generic[T]):
    """
    제네릭 페이지네이션 응답

    사용 예시:
        class UserListResponse(PaginatedResponse[UserListItem]):
            users: List[UserListItem]
    """
    total: int
    page: int
    page_size: int
