from __future__ import annotations

import argparse
from typing import Optional

from backend.app.collectors.lotto.api_client import LottoAPIClient
from backend.app.collectors.lotto.db_manager import LottoDBManager
from backend.app.db.session import SessionLocal


def fetch_draws(start: Optional[int] = None, end: Optional[int] = None, delay: float = 0.3) -> int:
    api = LottoAPIClient(delay=delay)

    with SessionLocal() as db:
        db_manager = LottoDBManager(db)
        latest_db = db_manager.get_max_draw_no() or 0

        if start is None:
            start = latest_db + 1
        if end is None:
            end = api.get_latest_draw_no()

        if end < start:
            return 0

        saved_count = 0
        for draw_no in range(start, end + 1):
            draw_info = api.get_lotto_draw(draw_no, retries=3)
            if draw_info is None:
                continue
            if db_manager.save_draw(draw_info):
                saved_count += 1
        return saved_count


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch lotto draws into DB")
    parser.add_argument("--start", type=int, default=None, help="Start draw number")
    parser.add_argument("--end", type=int, default=None, help="End draw number")
    parser.add_argument("--delay", type=float, default=0.3, help="Delay between requests")
    args = parser.parse_args()

    saved = fetch_draws(start=args.start, end=args.end, delay=args.delay)
    print(f"Saved draws: {saved}")


if __name__ == "__main__":
    main()
