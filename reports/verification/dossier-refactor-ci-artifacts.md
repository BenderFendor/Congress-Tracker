# Dossier Refactor CI Artifacts

GitHub Actions run `29364346560` retained these diagnostic artifacts while passing the complete repository gate:

- `component-size-report`: generated TSX size audit and monolith threshold report.
- `oxlint-report`: exact Oxlint diagnostics, retained even when the log viewer truncates output.
- `rust-deterministic-test-report`: complete deterministic Rust test output, including the bounded disclosure corpus.

The implementation and scope worksheet is `docs/agent/traces/frontend-dossier-refactor-and-bounded-parser-corpus.md`.
