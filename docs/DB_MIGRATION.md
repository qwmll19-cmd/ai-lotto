# DB Migration Guide

This project targets PostgreSQL for production. If you already have a running DB,
you must ensure the schema matches the current models.

## Fresh Install (Recommended)
1. Back up existing data (if needed).
2. Recreate the database.
3. Apply the schema:

```bash
psql -U ai_lotto -d ai_lotto -f db/lotto/schema.sql
```

## Existing DB (Keep Data)
If you cannot drop the database, add missing columns/tables manually based on
`db/lotto/schema.sql` and `backend/app/db/models.py`.

You can also run the idempotent migration script:

```bash
psql -U ai_lotto -d ai_lotto -f docs/migrations/001_align_schema.sql
```

Minimum required additions for pool-based recommendations:
- `lotto_recommend_logs.account_user_id`
- `lotto_recommend_logs.plan_type`
- `lotto_recommend_logs.pool_lines`
- `lotto_recommend_logs.revealed_indices`
- `lotto_recommend_logs.settings_data`
- `lotto_recommend_logs.is_matched`
- `lotto_recommend_logs.matched_at`

Also ensure these tables exist:
- `social_accounts`
- `payments`
- `subscriptions`
- `plan_performance_stats`
- `password_reset_tokens`
- `ml_training_logs`

If in doubt, prefer the fresh install path.
