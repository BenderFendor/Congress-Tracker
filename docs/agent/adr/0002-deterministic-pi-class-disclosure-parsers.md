# Deterministic, Pi-class disclosure parsers

CongressTracker disclosure parsing and orchestration are implemented in Rust,
using fixed-version, CPU-only tools and reproducible rules that can run within
a Raspberry Pi-class resource envelope.
The same pipeline automatically exploits bounded parallelism and faster local
storage on the primary Ryzen 5 3600 workstation; hosted extraction, LLMs, VLMs,
and generative repair are excluded from canonical evidence production.

## Considered Options

1. Hosted or generative document extraction could cover new layouts quickly,
   but adds external cost, nondeterminism, privacy exposure, and unverifiable
   transformations.
2. A lowest-common-denominator single-threaded parser is portable but wastes
   the workstation's six cores, twelve threads, 32 GiB RAM, and SSD storage.
3. Fixed OCR/layout tools with resource profiles preserve identical evidence
   semantics while changing only concurrency, cache size, and scheduling.

## Consequences

- Identical document bytes, tool versions, and parser configuration must
  produce identical normalized output.
- Allowed tools include text extraction, deterministic image preprocessing,
  OCRmyPDF/Tesseract-class OCR, coordinate-based table extraction, and small
  fixed CPU layout classifiers.
- Version-pinned native executables such as `pdftotext`, `pdftoppm`, and
  Tesseract may act as extraction engines. All layout classification, row and
  column reconstruction, validation, normalization, provenance, retry, and
  coverage semantics remain Rust-owned. Python parser runtimes are excluded.
- Every normalized field retains page or region provenance and passes schema
  validation.
- Known layouts use the cheapest validated fast path. Partial, unknown-layout,
  and OCR-derived filings require an independent deterministic candidate parser;
  only validated agreement or one uniquely valid candidate is promoted.
- Extraction artifacts are content-addressed and reused across retries and
  candidate parsers so cross-checking does not repeat rendering or OCR.
- Resource profiles may alter throughput, never extraction semantics.
- Performance budgets are release gates, not advisory targets. The workstation
  must also provide an interactive-safe background profile that preserves
  headroom for any concurrent high-load or latency-sensitive desktop workload,
  including games, builds, local models, media work, or another project.
- `interactive-safe` is the default for normal launches and scheduled ingestion.
  Maximum-throughput `burst` execution requires explicit operator opt-in.
