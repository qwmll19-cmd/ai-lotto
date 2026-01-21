# Lotto Data Pipeline (Stage 6)

This stage runs without SMS vendor integration.

## Step 1: Draw Ingestion
Fetch new draws into SQLite.

```bash
python3 -m backend.app.scripts.lotto.fetch_draws
```

Options:
```bash
python3 -m backend.app.scripts.lotto.fetch_draws --start 1000 --end 1100
```

**Checks**
- No errors in stdout.
- `lotto_draws` table has new rows.

## Step 2: Cache Build
Build stats cache used by recommendation logic.

```bash
python3 -m backend.app.scripts.lotto.build_cache
```

**Checks**
- `lotto_stats_cache` has 1 row.
- `updated_at` is recent.

## Step 3: Verification
Verify counts and cache status.

```bash
python3 -m backend.app.scripts.lotto.verify_pipeline
```

**Checks**
- Draw count > 0
- Latest draw number exists
- Cache updated_at exists

## Notes
- Steps 1/2 require network access to fetch official draw data.
- If blocked, run later after allowing network access.
