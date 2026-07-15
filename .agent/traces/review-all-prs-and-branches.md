# Review all PRs and branches

**Goal:** Inventory and review every open pull request and every local/remote non-main branch, verify each unique change set, and decide merge readiness without merging.

**Files changed:**
- `.agent/traces/review-all-prs-and-branches.md`
- `papercuts.md`

**Commands run:**
- `git fetch --all --prune` - passed; refreshed all remote branch heads.
- `gh pr list --state all --limit 100 --json ...` - found nine open PRs, numbered 1 through 9.
- `git branch --all --verbose --no-abbrev` and `git rev-list --left-right --count main...<branch>` - found one additional local branch, `temp_fix_branch`; it is 125 commits behind `main` with zero unique commits.
- `gh run view 29360379794 --log-failed` - reproduced PR #4's frontend failure: TypeScript TS2322 at `frontend/components/ui/member-identity.tsx:64`.
- Full-file and diff review of every changed workflow/package file and all 42 files in PR #9 - completed.
- Pairwise `git merge-tree` checks - the three workflow-action PRs conflict with each other; all five frontend dependency PRs conflict with each other after independent same-base lockfile generation.
- `CARGO_TARGET_DIR=... cargo test -p intel_backend candidates::tests --lib` - passed, 2 tests.
- `CARGO_TARGET_DIR=... cargo test -p intel_worker sample_corpus_tests --lib` - passed, 3 tests.
- `pnpm verify` in the PR #9 worktree - passed, including 84 unit tests, typecheck, ESLint, Oxlint, and production build.
- `scripts/self-test` in the PR #9 worktree - passed: plan lint, backend format/clippy/check/tests/compile, and frontend verify/build.
- Live PR #9 backend launch on port 4120 - blocked by unavailable local Postgres (`PoolTimedOut`).
- Chrome DevTools desktop/mobile verification - blocked because Chrome was not running and `DevToolsActivePort` was absent.
- GitHub status inspection - GitHub Actions backend/frontend jobs pass for PRs #1-#3 and #5-#9; PR #4 frontend fails. Vercel fails for every PR and for current `main`, indicating a baseline deployment problem rather than a branch-specific signal.

**Review findings:**
- PR #4 is not merge-ready: TypeScript 5.9.3 exposes an inference failure at `member-identity.tsx:64`.
- PRs #4-#8 are not merge-ready as generated: each single-package PR also refreshes unrelated direct dependencies pinned as `latest` (`@radix-ui/react-slot`, `@vercel/analytics`, and `recharts`) and rewrites both lockfiles. Regenerate with only the intended dependency or explicitly review/test the combined dependency set.
- PR #9 is not merge-ready: old member dossier deep links `?tab=donations` and `?tab=voting` now normalize to Overview instead of aliasing to Funding and Votes.
- PR #9 is not merge-ready: candidate detail coverage is inferred only from row presence and ignores relevant `source_runs`, so a partial/stale FEC import can be labeled `loaded` without a warning.
- PRs #1-#3 are individually merge-ready based on full workflow context and successful CI, but must be merged/rebased one at a time because their adjacent workflow edits conflict.
- `temp_fix_branch` has no unique work and should not be merged.

**Tests added:** None. This was a review-only task; existing targeted and full checks were executed.

**Assumptions:**
- The requested scope is all currently open GitHub PRs plus every currently visible local/remote non-main branch after fetch.
- A baseline Vercel failure does not make the workflow-only PRs branch-specific failures, but production deployment remains unresolved.
- No merge was authorized until all reviewed work was good; because blockers exist, no merge was attempted.

**Risk tier:** medium

**Rollback:** Revert the review-artifact commit and delete tag `review-all-prs-and-branches`; no product code or PR branch was changed.

**Status:** done

Docs checked, no update needed: this review did not change public behavior, setup, APIs, architecture, dependencies, or tests.
