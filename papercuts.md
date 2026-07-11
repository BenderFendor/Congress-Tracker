## 2026-07-11 17:15

**What happened:** Migration 7 modified after applied — breaks existing databases. Migration integrity needed in Phase 0.

**Probable cause:** agent edited an already-applied migration instead of creating new migration

**Fix or workaround:** never edit applied migrations; add migration integrity test

---

## 2026-07-11 17:15

**What happened:** Mid-session scope change from review to implementation — user provided HTML mockup, agent pivoted without fresh session context

**Probable cause:** scope changed mid-session, stale context from review phase polluted implementation

**Fix or workaround:** if scope changes, start fresh session with clean context

---

## 2026-07-11 17:15

**What happened:** Post-tool lint hook masking loop — 7+ calm lint-recovery prompts replaced raw lint output, agent in fix-lint-edit-lint loop

**Probable cause:** calm prompt obscures lint output, agent doesn't realize it's looping

**Fix or workaround:** track lint-fix count per session; if >5, batch all lint fixes instead of one-by-one

---

## 2026-07-11 17:15

**What happened:** 100% rate limit exhausted — ~29M input tokens in one session, context compacted 3 times. Review + implementation + frontend redesign in one session.

**Probable cause:** session too long, too many distinct tasks in one session

**Fix or workaround:** bounded sessions: one deliverable per session. compact more aggressively

---

## 2026-07-11 17:15

**What happened:** Worker parsed House Clerk TSV index as XML — 2026FD.txt is tab-separated, not XML. Zero discovery records until format was corrected.

**Probable cause:** worker assumed XML format without inspecting real Clerk index file

**Fix or workaround:** add format-detection test with real fixture to Phase 0

---

## 2026-07-11 17:56

**What happened:** Next 14 production build passes but emits Node DEP0205 module.register() deprecation warnings; identify the emitting loader before the Node runtime upgrade makes this noisy warning actionable.

---

## 2026-07-11 17:56

**What happened:** pnpm verify passes but Next build reports an outdated caniuse-lite database; add a bounded dependency-maintenance step instead of hiding the warning.

---

## 2026-07-11 17:57

**What happened:** Frontend visual verification could not connect because Chrome was not running with a DevToolsActivePort at /home/bender/.config/google-chrome/DevToolsActivePort; browser proof was skipped explicitly.

---

## 2026-07-11 17:58

**What happened:** A ripgrep pattern containing backticks was passed through the shell and accidentally executed scripts/self-test via command substitution; quote search patterns so backticks stay literal.

---

## 2026-07-11 18:01

**What happened:** Fresh migration probe initially used createdb -d, but this PostgreSQL client only accepts --maintenance-db for a connection string; inspect local CLI help before assuming newer aliases.

---

## 2026-07-11 18:03

**What happened:** The source-run audit script patch was blocked because merely referencing .env triggered the sensitive-path hook; operational scripts should require DATABASE_URL from the caller instead of sourcing credential files.

---

## 2026-07-11 18:05

**What happened:** A negative CLI test used the variable name status under zsh, where status is read-only; portable shell checks should use exit_code instead.

---
