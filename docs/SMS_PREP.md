# SMS Integration Prep

This project keeps SMS wiring in a provider-agnostic stub until a vendor is chosen.

## Current Behavior
- `get_sms_client()` returns `StubSmsClient`.
- Sends are logged to stdout with `[SMS:STUB]`.
- No external network calls are made.

## Environment Variables (placeholders)
Set these in your runtime or `.env` once the vendor is selected:

- `AI_LOTTO_SMS_PROVIDER` (example: `cool_sms`, `aligo`, `toast`)
- `AI_LOTTO_SMS_API_KEY`
- `AI_LOTTO_SMS_API_SECRET`
- `AI_LOTTO_SMS_SENDER_ID`

## Next Steps After Vendor Selection
1. Implement a real client in `backend/app/services/sms/`.
2. Update `get_sms_client()` to return the vendor client.
3. Add request/response logging (redact phone numbers).
4. Add retry/backoff policy and failure alerts.
5. Add integration tests using the vendor sandbox.
