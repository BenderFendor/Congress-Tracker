# Debug Trace: LDA Bill Relationship Persistence

**Task:** Run the M5 explicit LDA-to-bill derivation against live data.

**Failure:** `lobbying-bill-links --year 2026` failed because PostgreSQL could
not assign a text bind parameter to the `confidence_level` enum column.

**Reproduction:**

`cargo run -p intel_backend --bin ingest -- lobbying-bill-links --year 2026`

**First wrong transition:**

- File: `backend/crates/intel_backend/src/repository/relationships.rs`
- Boundary: `RelationshipEvidenceInsert.confidence` to PostgreSQL
- Actual: `$5` remained a text bind parameter.
- Required: `$5` must be cast to `confidence_level` before insertion.

**Fix:** Cast `$5::confidence_level` in the shared repository insert. The live
derivation also now stores the official LDA filing URL and filing date on each
explicit bill relationship.

**Verification:** Rerun the original live command, inspect terminal source-run
state, and query the persisted `lobbied` relationship rows.

**Risk:** Medium. The cast applies to every caller of the shared relationship
insert and enforces the existing database enum rather than changing accepted
values.

## Follow-on Bill Endpoint Failure

The live `/api/bills/119/hr/6489/intel` check then returned HTTP 500 while
decoding a PostgreSQL `NUMERIC` aggregate into Rust `f64`. The first wrong
transition was `build_funding_overlay`: aggregate expressions retained their
database numeric and enum types while the Rust tuple expected `f64` and
`String`. The query now casts monetary aggregates to `float8` and confidence to
text. The original endpoint is the regression check.
