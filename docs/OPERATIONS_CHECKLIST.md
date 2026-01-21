# Operations Checklist

## 1) Environment & Secrets
- Create `.env` from `.env.example`
- Set `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `FRONTEND_ORIGINS`, `API_BASE_URL`
- Do not commit real secrets

## 2) Database (PostgreSQL)
- Confirm Postgres is running
- Apply schema via Docker init or manual migration
- Verify tables exist (`lotto_draws`, `users`, `subscriptions`, ...)
- If DB already exists, run `docs/migrations/001_align_schema.sql`

## 3) Admin Access
- Create admin account with `backend/scripts/create_admin.py`
- Verify admin login and `/admin` access

## 4) Lotto Data Pipeline
- Fetch draws: `python3 -m backend.app.scripts.lotto.fetch_draws`
- Build cache: `python3 -m backend.app.scripts.lotto.build_cache`
- Verify: `python3 -m backend.app.scripts.lotto.verify_pipeline`

## 5) Health Checks
- Backend: `GET /health`
- Frontend: `/` served by `react-app/`

## 6) Monitoring
- Check logs in `logs/`
- Review `/ops/summary` and `/ops/metrics` as admin
