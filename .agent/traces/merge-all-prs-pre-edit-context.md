# Pre-Edit Context Scan

- Root: `/home/bender/classwork/congress-tracker`
- Stack: `{'node': ['package-lock.json']}`

## Guidance
- `AGENTS.md`
- `docs/agent/testing.md`
- `docs/agent/known-errors.md`
- `README.md`

## Targets
- `frontend/lib/member-dossier-state.mjs` -> `frontend/lib/member-dossier-state.mjs`
  - Exported or declared symbols: normalizeMemberTab, nextMemberTab, memberTabHref, MEMBER_TAB_IDS
- `backend/crates/intel_backend/src/routes/candidates.rs` -> `backend/crates/intel_backend/src/routes/candidates.rs`
  - Exported or declared symbols: validate_candidate_id, validate_cycle, get_candidate, candidate_identifiers_are_bounded_and_alphanumeric, candidate_cycles_are_even_and_bounded, CandidateDetailQuery, CandidateDetail, CandidateCommittee, CandidateCoverage, CandidateProvenance, CandidateDetailResponse

## Call-Site Signals
- `normalizeMemberTab`: 9 matches
  - `frontend/scripts/member-dossier-utils.test.mjs:7` normalizeMemberTab,
  - `frontend/scripts/member-dossier-utils.test.mjs:16` assert.equal(normalizeMemberTab("votes"), "votes")
  - `frontend/scripts/member-dossier-utils.test.mjs:17` assert.equal(normalizeMemberTab("unknown"), "overview")
  - `frontend/scripts/member-dossier-utils.test.mjs:18` assert.equal(normalizeMemberTab(null), "overview")
  - `frontend/lib/member-dossier-state.mjs:16` export function normalizeMemberTab(value) {
- `CandidateCoverage`: 3 matches
  - `backend/crates/intel_backend/src/routes/candidates.rs:38` pub struct CandidateCoverage {
  - `backend/crates/intel_backend/src/routes/candidates.rs:56` pub coverage: CandidateCoverage,
  - `backend/crates/intel_backend/src/routes/candidates.rs:145` coverage: CandidateCoverage {
- `nextMemberTab`: 8 matches
  - `frontend/scripts/member-dossier-utils.test.mjs:6` nextMemberTab,
  - `frontend/scripts/member-dossier-utils.test.mjs:22` assert.equal(nextMemberTab("overview", "ArrowLeft"), "biography")
  - `frontend/scripts/member-dossier-utils.test.mjs:23` assert.equal(nextMemberTab("biography", "ArrowRight"), "overview")
  - `frontend/scripts/member-dossier-utils.test.mjs:24` assert.equal(nextMemberTab("trades", "Home"), "overview")
  - `frontend/scripts/member-dossier-utils.test.mjs:25` assert.equal(nextMemberTab("trades", "End"), "biography")
- `memberTabHref`: 6 matches
  - `frontend/scripts/member-dossier-utils.test.mjs:5` memberTabHref,
  - `frontend/scripts/member-dossier-utils.test.mjs:29` assert.equal(memberTabHref("/legislators/A000001?tab=votes", "funding"), "/legislators/A000001?tab=funding")
  - `frontend/scripts/member-dossier-utils.test.mjs:30` assert.equal(memberTabHref("/legislators/A000001?tab=votes", "overview"), "/legislators/A000001")
  - `frontend/lib/member-dossier-state.mjs:38` export function memberTabHref(href, tab) {
  - `frontend/components/dossiers/member/use-member-dossier.ts:17` import { memberTabHref, normalizeMemberTab } from "@/lib/member-dossier-state.mjs"
- `MEMBER_TAB_IDS`: 6 matches
  - `frontend/lib/member-dossier-state.mjs:1` export const MEMBER_TAB_IDS = [
  - `frontend/lib/member-dossier-state.mjs:17` return MEMBER_TAB_IDS.includes(value ?? "") ? value : "overview"
  - `frontend/lib/member-dossier-state.mjs:26` const currentIndex = Math.max(0, MEMBER_TAB_IDS.indexOf(normalizeMemberTab(current)))
  - `frontend/lib/member-dossier-state.mjs:27` if (key === "Home") return MEMBER_TAB_IDS[0]
  - `frontend/lib/member-dossier-state.mjs:28` if (key === "End") return MEMBER_TAB_IDS[MEMBER_TAB_IDS.length - 1]
- `validate_candidate_id`: 7 matches
  - `backend/crates/intel_backend/src/routes/candidates.rs:60` fn validate_candidate_id(candidate_id: &str) -> Result<(), AppError> {
  - `backend/crates/intel_backend/src/routes/candidates.rs:93` validate_candidate_id(&candidate_id)?;
  - `backend/crates/intel_backend/src/routes/candidates.rs:167` use super::{validate_candidate_id, validate_cycle};
  - `backend/crates/intel_backend/src/routes/candidates.rs:171` assert!(validate_candidate_id("H0CA12345").is_ok());
  - `backend/crates/intel_backend/src/routes/candidates.rs:172` assert!(validate_candidate_id("").is_err());
- `validate_cycle`: 7 matches
  - `backend/crates/intel_backend/src/routes/candidates.rs:75` fn validate_cycle(cycle: Option<i32>) -> Result<(), AppError> {
  - `backend/crates/intel_backend/src/routes/candidates.rs:94` validate_cycle(query.cycle)?;
  - `backend/crates/intel_backend/src/routes/candidates.rs:167` use super::{validate_candidate_id, validate_cycle};
  - `backend/crates/intel_backend/src/routes/candidates.rs:179` assert!(validate_cycle(None).is_ok());
  - `backend/crates/intel_backend/src/routes/candidates.rs:180` assert!(validate_cycle(Some(2026)).is_ok());
- `get_candidate`: 2 matches
  - `backend/crates/intel_backend/src/routes/mod.rs:395` axum::routing::get(candidates::get_candidate),
  - `backend/crates/intel_backend/src/routes/candidates.rs:88` pub async fn get_candidate(
- `candidate_identifiers_are_bounded_and_alphanumeric`: 1 matches
  - `backend/crates/intel_backend/src/routes/candidates.rs:170` fn candidate_identifiers_are_bounded_and_alphanumeric() {
- `candidate_cycles_are_even_and_bounded`: 1 matches
  - `backend/crates/intel_backend/src/routes/candidates.rs:178` fn candidate_cycles_are_even_and_bounded() {
- `CandidateDetailQuery`: 2 matches
  - `backend/crates/intel_backend/src/routes/candidates.rs:9` pub struct CandidateDetailQuery {
  - `backend/crates/intel_backend/src/routes/candidates.rs:91` Query(query): Query<CandidateDetailQuery>,
- `CandidateDetail`: 5 matches
  - `backend/crates/intel_backend/src/routes/candidates.rs:14` pub struct CandidateDetail {
  - `backend/crates/intel_backend/src/routes/candidates.rs:54` pub candidate: CandidateDetail,
  - `backend/crates/intel_backend/src/routes/candidates.rs:96` let candidate: CandidateDetail = sqlx::query_as(
  - `frontend/lib/services/candidates.ts:9` export type CandidateDetail = {
  - `frontend/lib/services/candidates.ts:32` candidate: CandidateDetail

## Query Matches
- Query: `source_runs FEC candidate coverage`
- No direct matches

## Likely Tests
- No nearby test files detected

## Verification Candidates
- `scripts/self-test`: `scripts/self-test`

## Must Read Before Write
- `AGENTS.md`
- `docs/agent/testing.md`
- `docs/agent/known-errors.md`
- `README.md`
- `frontend/lib/member-dossier-state.mjs`
- `backend/crates/intel_backend/src/routes/candidates.rs`