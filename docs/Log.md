# Project Change Log

This log records changes to public behavior, developer workflows, data
contracts, and verification requirements. It does not replace Git history or
the detailed worksheets under `.agent/traces/`.

## 2026-07-11 - Stronger Frontend Verification Gate

- Replaced non-semantic command-palette and election-map interaction roles with native dialog, button, figure, output, and live-region behavior.
- Fixed every existing Oxlint accessibility warning without changing the visible navigation or election data flow.
- Changed `scripts/self-test` to run `pnpm verify`, which includes frontend helper tests, TypeScript, ESLint, Oxlint, and the production build.
- Verified the full backend and frontend self-test successfully.
- Browser proof remains pending because Chrome MCP could not find a running Chrome `DevToolsActivePort`.
