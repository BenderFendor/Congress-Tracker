# M7 item 9 — search index parity proof

**Goal:** execute the plan proof for M7.9 (migration 0052's 5 pg_trgm GIN
indexes): confirm the migration is applied, confirm `EXPLAIN` shows index
usage for committee/PAC/lobbying-client/registrant search, and confirm p95
latency is under the 2000ms search budget. Read-only investigation task —
no source code changes permitted.

**Files changed:**
- `reports/verification/search-parity-explain-2026-07-14.md` (new — the proof report)
- `docs/agent/traces/m7-search-parity-proof.md` (this worksheet)

No application code, migrations, or other repo files were modified.

**Commands run:**
- `scripts/db-query "SELECT indexname, tablename FROM pg_indexes WHERE indexname IN (...)"` —
  confirmed all 5 migration-0052 indexes plus the pre-existing PAC index
  (`idx_fec_committees_name_trgm`, migration 0030) are already live. Migration
  0052 was already applied (backend auto-applies on start) — no manual apply
  was necessary.
- `scripts/db-query "SELECT extname FROM pg_extension WHERE extname='pg_trgm'"` — installed.
- `scripts/db-query "EXPLAIN (ANALYZE, BUFFERS) ..."` run for the exact SQL
  shapes in `search.rs` (`search_committees_similarity`), `fec.rs`
  (`search_pacs_similarity`), `lobbying.rs`
  (`search_lobbying_clients_similarity`, `search_lobbying_registrants_similarity`),
  each with a term known (via a prior `similarity()` scalar check) to clear
  the 0.3 threshold: judiciary/committees, teamsters/fec_committees,
  american/lobbying_clients, strategies/lobbying_registrants. Each run 5x,
  max recorded as p95 stand-in. Also ran the PAC ILIKE fallback path
  (term "boeing", which the app actually reaches because its similarity <
  0.3) and the bill search ILIKE query for context.

**Tests added:** none — this is a verification/proof task, not a code
change. No test files were touched.

**Findings (see report for full detail):**
- Migration 0052 was already applied; all 5 indexes plus `pg_trgm` extension
  confirmed present.
- All four in-scope similarity-first queries (committee, PAC, lobbying
  client, lobbying registrant) use `WHERE similarity(name, $1) > 0.3 ORDER BY
  similarity(name, $1) DESC`. This predicate is a plain function-call
  comparison, not one of pg_trgm's indexable operators (`%`, `<->`,
  `~~`/`~~*` for the GIN opclass). `EXPLAIN` confirms **Seq Scan** for all
  four, on both tiny tables (49–146 rows) and a 31,812-row table
  (`fec_committees`).
  The ILIKE fallback path (reached only when the similarity query returns
  zero rows) does correctly produce a `Bitmap Index Scan` on the trgm index
  — the indexes are structurally fine; the primary query just can't reach
  them.
- Latency is not a problem: worst observed p95-stand-in was 129 ms
  (PAC/teamsters seq scan over 31,812 rows), far under the 2000ms budget.
  Bill search (informational only, not part of migration 0052's scope) is a
  Parallel Seq Scan over 162,616 rows at ~109 ms — also under budget but
  not index-accelerated, and the plan log's claim that bill search uses the
  "similarity-first-then-ILIKE" pattern does not match the code (bill
  search has no similarity path at all).
- **Verdict: index-usage proof FAILS for all four in-scope search types.**
  Latency budget passes. Diagnosis: similarity-operator vs. trgm-opclass
  mismatch — the code needs to filter with the indexable `%` operator (or
  an equivalent expression Postgres can match to `gin_trgm_ops`) instead of
  a bare `similarity(...) > 0.3` predicate. Not fixed here per the
  read-only scope of this task.

**Assumptions:**
- "p95" is approximated as the max of 5 local `EXPLAIN ANALYZE` runs, per
  the task's explicit instruction, not a real percentile over concurrent
  production traffic.
- Search terms were selected using a preliminary `similarity()` scalar
  query against real data so the terms genuinely clear the 0.3 threshold
  used by the code (rather than guessing and hitting the always-empty
  branch). This is disclosed in the report per term.
- Dataset sizes are small for the committee/lobbying tables (49–146 rows);
  Postgres would likely prefer a Seq Scan there even with an indexable
  predicate purely on cost grounds. The `fec_committees` case (31,812 rows)
  is the strongest evidence the failure is structural (operator mismatch),
  not just planner cost-based avoidance on tiny tables.

**Risk tier:** low (read-only verification; no code paths executed beyond
ad hoc `EXPLAIN` queries via `scripts/db-query`).

**Rollback:** N/A — no code or schema changes were made. Delete the report
file and this worksheet to fully revert if needed.

**Status:** done — proof executed, finding is a FAIL with diagnosis. No
code was modified per task scope; a follow-up fix (rewrite the WHERE clause
to use the `%` operator so the GIN indexes are reachable) is needed before
M7.9 can be marked complete against index-usage evidence, not just latency.
