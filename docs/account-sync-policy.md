# Account Sync Policy

Last updated: 2026-05-16

This app keeps local history in `localStorage` by default. Account sync adds a server-side snapshot so users can restore search and scan history after closing or reinstalling the app environment.

## Stored Data

The server stores the same versioned snapshot used by local data export:

- recent scanned products
- saved products
- provisional user-submitted products
- personal preferences
- OCR drafts
- recent search terms

The snapshot schema remains `app: "food-scan"` and `version: 1`.

## Authentication Model

Account sync uses an app-level account ID and numeric PIN.

- Account IDs allow lowercase letters, numbers, dot, dash, and underscore, 3-32 characters.
- PINs allow 4-12 digits.
- PINs are not stored in plaintext. The Edge Function stores a PBKDF2-SHA-256 hash with a per-account salt.
- Session tokens are returned to the client once and only their SHA-256 hashes are stored in Supabase.
- Sessions expire after 30 days.

This is prototype-grade account persistence, not a replacement for a full identity provider. There is no PIN reset flow. Lost PIN means the stored account snapshot cannot be recovered through the app.

## Server Tables

The migration `supabase/migrations/20260516090000_account_sync.sql` creates:

- `public.app_users`: account ID, display name, PIN salt/hash
- `public.app_user_sessions`: hashed session token and expiry
- `public.app_user_data`: latest user data snapshot

All three tables have RLS enabled and no public policies. They are intended to be accessed only through the `app-api` Edge Function with `SUPABASE_SERVICE_ROLE_KEY`.

## Sync Behavior

- On login, the app fetches the server snapshot.
- If a server snapshot exists, it is merged with the current local snapshot. Server entries win on duplicates.
- After merge, the merged snapshot is written locally and pushed back to the server.
- While logged in, local changes queue a debounced background snapshot sync.
- Manual controls in Settings can fetch the server snapshot or push the current local snapshot.
- Logout removes only the local session token. It does not delete local history or the server snapshot.

## Limitations

- Snapshot size is capped at 200 KB in the Edge Function.
- Sync is last-write-wins at the whole-snapshot level after client-side merge.
- If `SUPABASE_SERVICE_ROLE_KEY` is missing from the Edge Function environment, account sync returns unavailable.
- Existing manual JSON export/import remains the fallback for users who do not want server sync.
