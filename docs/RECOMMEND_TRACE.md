# Recommend Flow Trace

Use these checks to verify that recommendations are created and persisted
for the current user and draw.

## 1) Identify current target draw

```sql
SELECT draw_no
FROM lotto_draws
ORDER BY draw_no DESC
LIMIT 1;
```

The target draw is `latest + 1`.

## 2) Inspect latest recommend log

```sql
SELECT id, account_user_id, target_draw_no, plan_type, recommend_time,
       jsonb_array_length(lines) AS line_count
FROM lotto_recommend_logs
WHERE account_user_id = :user_id
ORDER BY id DESC
LIMIT 5;
```

## 3) Inspect pool fields (paid plans)

```sql
SELECT id, target_draw_no, plan_type,
       jsonb_array_length(pool_lines) AS pool_total,
       jsonb_array_length(revealed_indices) AS revealed_count,
       settings_data
FROM lotto_recommend_logs
WHERE account_user_id = :user_id
ORDER BY id DESC
LIMIT 5;
```

## 4) Common mismatch symptoms
- `pool_lines` is NULL but `lines` exists → older data before pool system
- `pool_lines` exists but `revealed_indices` empty → numbers not revealed yet
- `target_draw_no` mismatch → user viewing a different draw

## 5) API sanity check
- `GET /api/lotto/recommend?check_only=true`
- `GET /api/lotto/recommend/pool-status`
- `GET /api/lotto/mypage/lines`
