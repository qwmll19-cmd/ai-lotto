from __future__ import annotations

from backend.app.db.models import LottoDraw, LottoStatsCache
from backend.app.db.session import SessionLocal


def main() -> None:
    with SessionLocal() as db:
        draw_count = db.query(LottoDraw).count()
        latest_draw = db.query(LottoDraw.draw_no).order_by(LottoDraw.draw_no.desc()).first()
        cache = db.query(LottoStatsCache).first()

        print(f"Draws: {draw_count}")
        print(f"Latest draw: {latest_draw[0] if latest_draw else 'N/A'}")
        if cache:
            print(f"Cache updated_at: {cache.updated_at}")
            print(f"Cache total_draws: {cache.total_draws}")
        else:
            print("Cache: not found")


if __name__ == "__main__":
    main()
