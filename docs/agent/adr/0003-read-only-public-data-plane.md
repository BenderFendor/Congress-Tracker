# Separate the read-only public data plane from operator ingestion

CongressTracker's hosted website and public API are read-only and serve bounded,
prepared evidence. Discovery, downloads, OCR, parsing, identity resolution,
gold verification, adjudication, refreshes, and backfills run only through
private local operator workflows; no public request can start or mutate them.

## Consequences

- Public routes expose no mutation, job-control, refresh, parser, or review
  capability.
- Expensive aggregates are precomputed; list and graph queries are indexed,
  paginated, time-bounded, cached where safe, and rate-limited.
- Agent review is a local auditable workflow rather than a hosted admin UI.
- The worker uses the interactive-safe resource profile independently of public
  request traffic.
- The guaranteed baseline is a single Ryzen 5 3600 desktop hosting Next.js,
  `intel_backend`, PostgreSQL, and the worker. Each process receives explicit
  resource and connection budgets; the architecture remains separable later.
- A future public audit view may display sanitized adjudication history but
  cannot modify it.
