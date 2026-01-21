# Admin Setup

This project uses `User.is_admin` as the single source of truth for admin access.

## Create or Promote an Admin Account

Run the script from the repository root:

```bash
python3 backend/scripts/create_admin.py create <identifier> <password>
python3 backend/scripts/create_admin.py promote <identifier>
```

Notes:
- `<identifier>` matches the login ID used in `/api/auth` (email or username).
- Use a strong password and rotate it after first login.
