# Edge Function Timeout Policy

Gemini-backed display enhancements must return before the Supabase Edge Runtime idle timeout.

- `translateProductToKorean` is non-critical display enrichment.
- The Edge Function aborts the Gemini translation request after 12 seconds and returns `UPSTREAM_TIMEOUT`.
- The browser translation caller aborts the Edge Function request after 15 seconds.
- On timeout or any translation failure, product lookup must continue with the original product data.

## In-flight Request Deduplication

The browser Edge Function client deduplicates concurrent identical read-only action requests by
`url`, `apikey`, `timeoutMs`, `action`, and `payload`.

- Deduplication is in-flight only; completed requests are not cached.
- Mutating actions such as review enqueue/update and product upsert are never deduplicated.
- This prevents React development-mode effect replays from sending duplicate product lookup and
  enrichment POSTs to `app-api`, reducing avoidable 429 responses.
