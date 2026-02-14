from __future__ import annotations

import argparse
from datetime import datetime, timedelta, date
from typing import Optional

from app.collectors.lotto.api_client import LottoAPIClient
from app.db.models import LottoDraw
from app.db.session import SessionLocal


def _normalize_date(value: str) -> str:
    return datetime.strptime(value, "%Y-%m-%d").date().isoformat()


_FIRST_DRAW_DATE = date(2002, 12, 7)


def _compute_draw_date(draw_no: int) -> str:
    return (_FIRST_DRAW_DATE + timedelta(days=7 * (draw_no - 1))).isoformat()


def update_draw_dates(
    start: Optional[int] = None,
    end: Optional[int] = None,
    delay: float = 0.3,
    dry_run: bool = False,
    use_formula: bool = False,
) -> int:
    api = LottoAPIClient(delay=delay)
    updated = 0

    with SessionLocal() as db:
        query = db.query(LottoDraw).order_by(LottoDraw.draw_no.asc())
        if start is not None:
            query = query.filter(LottoDraw.draw_no >= start)
        if end is not None:
            query = query.filter(LottoDraw.draw_no <= end)

        draws = query.all()
        for idx, draw in enumerate(draws, start=1):
            api_date = None
            if not use_formula:
                draw_info = api.get_lotto_draw(draw.draw_no, retries=2)
                if draw_info and draw_info.get("date"):
                    api_date = _normalize_date(draw_info["date"])
            if not api_date:
                api_date = _compute_draw_date(draw.draw_no)

            if draw.draw_date != api_date:
                if dry_run:
                    print(f"[DRY] draw_no={draw.draw_no} {draw.draw_date} -> {api_date}")
                else:
                    draw.draw_date = api_date
                    db.add(draw)
                updated += 1

            if not dry_run and idx % 50 == 0:
                db.commit()

        if not dry_run:
            db.commit()

    return updated


def main() -> None:
    parser = argparse.ArgumentParser(description="Update lotto draw dates from official API")
    parser.add_argument("--start", type=int, default=None, help="Start draw number")
    parser.add_argument("--end", type=int, default=None, help="End draw number")
    parser.add_argument("--delay", type=float, default=0.3, help="Delay between requests")
    parser.add_argument("--dry-run", action="store_true", help="Do not write changes")
    parser.add_argument("--use-formula", action="store_true", help="Fallback to date formula when API is unavailable")
    args = parser.parse_args()

    updated = update_draw_dates(
        start=args.start,
        end=args.end,
        delay=args.delay,
        dry_run=args.dry_run,
        use_formula=args.use_formula,
    )
    print(f"Updated draws: {updated}")


if __name__ == "__main__":
    main()
