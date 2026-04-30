# Known Errors

## Congress.gov API key not found

Symptom:
```
Congress.gov API key not found. Returning empty bills.
```

Cause:
- `CONGRESS_GOV_API_KEY` not set in `.env` or `frontend/.env.local`
- Wrong key value (e.g., OpenFEC key used instead of Congress.gov key)

Fix:
1. Check `echo $CONGRESS_GOV_API_KEY`
2. Set in `.env`: `CONGRESS_GOV_API_KEY=your_key`
3. Set in `frontend/.env.local`: `NEXT_PUBLIC_CONGRESS_GOV_API_KEY=same_key`

---

## Proxy returns Congress.gov data but frontend shows "Data Unavailable"

Symptom:
```
GET /api/congress-proxy?url=... 200  (proxy works)
Error fetching legislator from proxy: TypeError: Cannot read properties of undefined (reading 'includes')
```

Cause:
- `mergeProxyMember` expects `member.name` but Congress.gov API returns `firstName`/`lastName`/`directOrderName` instead
- `terms` field is a direct array, not `{ item: [...] }`
- `partyName` is nested under `partyHistory[]`, not a flat field

Fix:
See `frontend/lib/services/legislators.ts` `mergeProxyMember` for the fallback chain that handles these API shape mismatches.

---

## Backend connection refused on port 4020

Symptom:
```
TypeError: Failed to fetch
ERR_CONNECTION_REFUSED
```

Cause:
- Backend not running

Fix:
```bash
cd backend && cargo run -p backend_server
```

---

## Trade data shows 0 buy/sell orders

Symptom:
- Buy Orders: 0, Sell Orders: 0 on portfolio page

Cause:
- `Trade` interface field names don't match backend response shape
- Backend returns `txType` not `type`, `asset.assetTicker` not `ticker`, etc.

Fix:
The `mapBackendTrade` adapter in `frontend/lib/api.ts` handles this. Ensure `fetchTrades` uses it.

---

## Cargo build: unresolved import / private module

Symptom:
```
error[E0432]: unresolved import `capitoltrades_api::client::CapitolTradesClient`
error[E0603]: module `client` is private
```

Cause:
- Importing private module paths instead of public re-exports

Fix:
Use the public re-exports:
```rust
use capitoltrades_api::Client as CapitolTradesClient;
use capitoltrades_api::TradeQuery;
```
Not:
```rust
use capitoltrades_api::client::CapitolTradesClient;
use capitoltrades_api::query::TradeQuery;
```
