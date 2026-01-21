import random
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.db.models import LottoDraw
from backend.app.db.session import get_db
from backend.app.services.lotto import LottoStatsCalculator, draws_to_dict_list

router = APIRouter(prefix="/api/guest", tags=["guest"])


class GuestDrawRequest(BaseModel):
    sessionId: Optional[str] = None


class GuestDrawResponse(BaseModel):
    number: int
    alreadyDrawn: bool = False
    topNumbers: list[int] = []


def _get_top_numbers_ml(db: Session, top_n: int = 5) -> list[int]:
    """
    ML 로직 기반 상위 N개 번호 반환
    - logic1, logic2, logic3 점수를 종합하여 최종 점수 계산
    - 가중치: logic1(0.33), logic2(0.33), logic3(0.34)
    """
    draws = db.query(LottoDraw).order_by(LottoDraw.draw_no).all()

    if not draws:
        return list(range(1, top_n + 1))

    draws_data = draws_to_dict_list(draws)

    # 3가지 로직으로 점수 계산
    scores1 = LottoStatsCalculator.calculate_ai_scores_logic1(draws_data)
    scores2 = LottoStatsCalculator.calculate_ai_scores_logic2(draws_data)
    scores3 = LottoStatsCalculator.calculate_ai_scores_logic3(draws_data)

    # 가중치 적용하여 종합 점수 계산
    scores_final = {}
    for n in range(1, 46):
        scores_final[n] = (
            scores1.get(n, 0) * 0.33 +
            scores2.get(n, 0) * 0.33 +
            scores3.get(n, 0) * 0.34
        )

    # 점수순 정렬 후 상위 N개
    sorted_numbers = sorted(scores_final.items(), key=lambda x: x[1], reverse=True)
    return [num for num, _ in sorted_numbers[:top_n]]


@router.post("/draw", response_model=GuestDrawResponse)
def guest_draw(
    request: GuestDrawRequest,
    db: Session = Depends(get_db),
):
    """
    비회원 공 뽑기 API
    - ML 로직(logic1, logic2, logic3 종합) 상위 5개 번호 중 1개를 랜덤으로 반환
    - 회차 제한은 프론트엔드 localStorage에서 처리
    """
    # ML 로직 기반 상위 5개 번호 가져오기
    top_numbers = _get_top_numbers_ml(db, top_n=5)

    if not top_numbers:
        # 데이터가 없으면 1~45 중 랜덤
        selected = random.randint(1, 45)
        top_numbers = list(range(1, 46))
    else:
        # 상위 5개 중 1개 랜덤 선택
        selected = random.choice(top_numbers)

    return GuestDrawResponse(
        number=selected,
        alreadyDrawn=False,
        topNumbers=top_numbers,
    )
