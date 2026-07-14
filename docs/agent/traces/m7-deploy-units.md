# m7-deploy-units

**Goal:** M7 item 3 — supervised deployment. systemd user units for
`intel_backend` and the Next.js frontend, plus a Caddy reverse proxy with
TLS (local self-signed, no public domain yet) and stock-Caddy rate/cache
defaults, so the M6 load gate can later be run through the proxy.

**Files changed:**
- `deploy/systemd/congress-backend.service` (new)
- `deploy/systemd/congress-frontend.service` (new)
- `deploy/systemd/congress-caddy.service` (new)
- `deploy/caddy/Caddyfile` (new)
- `reports/verification/deploy-units-proof-2026-07-14.md` (new)
- `~/.config/systemd/user/congress-backend.service` (installed copy)
- `~/.config/systemd/user/congress-frontend.service` (installed copy)
- `~/.config/systemd/user/congress-caddy.service` (installed copy, disabled)
- `backend/target/release/intel_backend` (built, not tracked in git —
  `cargo build --release -p intel_backend --bin intel_backend`)

Not touched: `deploy/systemd/congress-backup.service`,
`deploy/systemd/congress-backup.timer` (owned by a concurrent agent),
`docs/IMPLEMENTATION_PLAN.md`, `docs/agent/tools.md`.

**Commands run:**
- `rg -l "intel_worker" --glob "*.service" /` → found
  `backend/crates/intel_worker/intel_worker.service` (system-scope
  template: `User=congress_tracker`, `EnvironmentFile=`, `Restart=always`,
  journal logging, `ProtectSystem=strict` + `ReadWritePaths`/`ReadOnlyPaths`
  hardening). Adapted these conventions to user-unit scope (see proof doc).
- `command -v caddy` → not found.
- `ls backend/target/release/intel_backend` → missing, then built via
  `cargo build --release -p intel_backend --bin intel_backend` (1m12s,
  succeeded, 12 cores available, 37G disk free at the time).
- `ss -ltnp` before enabling → port 4020 held by a pre-existing dev
  `target/debug/intel_backend` process (pid 2898245); port 3000 free.
- `systemctl --user daemon-reload`, `systemctl --user enable
  congress-backend.service congress-frontend.service` (both exit 0, both
  report `enabled`). Did NOT pass `--now` — see proof doc for the port
  conflict / `BindsTo` reasoning. Did NOT enable `congress-caddy.service`
  since caddy is not installed (`is-enabled` correctly reports `disabled`,
  exit 1 — expected).
- Full transcript in `reports/verification/deploy-units-proof-2026-07-14.md`.

**Tests added:** None (infra/ops task, no application test surface).
Verification is the `systemctl --user is-enabled` proof plus the recorded
port-occupancy checks above.

**Assumptions:**
- Repo path `/home/bender/classwork/congress-tracker` and user `bender`
  (uid 1000) are the actual deploy target on this host — this is a dev
  machine, not the `congress_tracker` service-account host the worker
  unit's system-scope template implies. If this ever moves to that
  production host, the backend/frontend units need the same `User=`/path
  rewrite the worker unit already has.
- `.env` at repo root is the correct env file for both backend and frontend
  (matches `run_all.sh`'s `source .env` and `scripts/db-backup`'s
  documented loading convention). Never read its contents directly, per
  task instructions and the sandbox's sensitive-path guard.
- Frontend unit's `EnvironmentFile=-/.../.env` uses the optional-file `-`
  prefix since `NEXT_PUBLIC_*` vars are baked at build time, not required
  at `pnpm start` runtime; this may need revisiting if runtime-only env
  vars are added later.
- Caddy will be installed manually by a human (no `sudo`/package-manager
  access assumed available to agents, and instructions explicitly forbid
  installing packages here).
- Building the release backend binary was in scope even though the plan's
  proof criteria only requires `is-enabled`, because a unit that points at
  a binary that doesn't exist would misrepresent "deployment" — flagging
  this as a judgment call since it wasn't explicitly requested.

**Risk tier:** low. No existing process was touched or restarted; no
services were started with `--now`; no packages were installed; only new
files were added plus a local release build artifact (untracked, not
committed).

**Rollback:**
- `systemctl --user disable congress-backend.service congress-frontend.service`
- `rm ~/.config/systemd/user/congress-backend.service
     ~/.config/systemd/user/congress-frontend.service
     ~/.config/systemd/user/congress-caddy.service`
- `systemctl --user daemon-reload`
- `rm -rf deploy/systemd/congress-backend.service deploy/systemd/congress-frontend.service deploy/systemd/congress-caddy.service deploy/caddy`
- The release binary at `backend/target/release/intel_backend` can be left
  or removed with `cargo clean --release -p intel_backend`; it is not
  tracked by git either way.

**Status:** done for backend/frontend units (enabled, proof captured).
blocked-with-reason for the Caddy proxy itself: caddy is not installed on
this host and installing packages is out of scope for this task. Configs
are written, internally consistent, and ready to enable once caddy is
present — see `reports/verification/deploy-units-proof-2026-07-14.md` for
the exact follow-up command.
