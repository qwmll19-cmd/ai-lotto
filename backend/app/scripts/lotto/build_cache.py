from __future__ import annotations

import json
from datetime import datetime, timezone

from backend.app.db.models import LottoStatsCache, LottoDraw
from backend.app.db.session import SessionLocal
from backend.app.services.lotto.stats_calculator import LottoStatsCalculator


def build_cache() -> bool:
    with SessionLocal() as db:
        draws = db.query(LottoDraw).order_by(LottoDraw.draw_no).all()
        if not draws:
            return False

        draws_dict = [
            {
                "draw_no": d.draw_no,
                "n1": d.n1,
                "n2": d.n2,
                "n3": d.n3,
                "n4": d.n4,
                "n5": d.n5,
                "n6": d.n6,
                "bonus": d.bonus,
            }
            for d in draws
        ]

        calculator = LottoStatsCalculator()
        most, least = calculator.calculate_most_least(draws_dict)
        ai_scores = calculator.calculate_ai_scores(draws_dict)
        ai_scores = {str(k): v for k, v in ai_scores.items()}

        def _stringify_keys(obj):
            if isinstance(obj, dict):
                return {str(k): _stringify_keys(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [_stringify_keys(v) for v in obj]
            return obj

        patterns = calculator.analyze_historical_patterns(draws_dict)
        best_patterns = calculator.get_best_patterns(patterns)
        payload = {
            "patterns": _stringify_keys(patterns),
            "best_patterns": _stringify_keys(best_patterns),
        }

        cache = db.query(LottoStatsCache).first()
        if cache is None:
            cache = LottoStatsCache(
                id=1,
                updated_at=datetime.now(timezone.utc),
                total_draws=len(draws_dict),
                most_common=json.dumps(most, ensure_ascii=False),
                least_common=json.dumps(least, ensure_ascii=False),
                ai_scores=json.dumps(payload | {"scores": ai_scores}, ensure_ascii=False),
            )
            db.add(cache)
        else:
            cache.updated_at = datetime.now(timezone.utc)
            cache.total_draws = len(draws_dict)
            cache.most_common = json.dumps(most, ensure_ascii=False)
            cache.least_common = json.dumps(least, ensure_ascii=False)
            cache.ai_scores = json.dumps(payload | {"scores": ai_scores}, ensure_ascii=False)

        db.commit()
        return True


def main() -> None:
    ok = build_cache()
    if ok:
        print("Cache built.")
    else:
        print("No draws found. Cache not built.")


if __name__ == "__main__":
    main()
