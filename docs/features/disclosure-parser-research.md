# Disclosure Parser Prior-Art Research

This document defines revision-pinned research for improving the Rust House and
Senate financial-disclosure parsers. It prioritizes repositories processing the
same official sources and uses generic PDF projects only for isolated,
deterministic algorithms. Research requires license review, gold-corpus proof,
benchmarks, and provenance before promotion.

## Repository Order

### Domain-specific parsers

1. `seralifatih/congress-trading-pipeline` — House acquisition and
   marker-anchored PTR row reconstruction.
2. `neelsomani/senator-filings` — Senate eFD sessions, search, pagination, and
   filing extraction.
3. `tg12/congressional-filings-explorer` — House index acquisition, parallel
   download, PDF rendering, and failure handling. Hosted/generative analysis is
   excluded.
4. Other maintained repositories discovered through primary GitHub search that
   demonstrably parse House Clerk or Senate eFD forms.

### Secondary algorithm references

- `camelot-dev/camelot` — ruled-line, whitespace, network, and hybrid table
  reconstruction ideas; Python and ML production runtimes are excluded.
- `xavctn/img2table` — deterministic table/cell geometry and Tesseract
  integration ideas; its Python runtime is excluded.
- `opendataloader-project/opendataloader-pdf` — deterministic bounding-box and
  structured-output ideas; AI and hybrid modes are excluded.
- Tesseract documentation — hOCR/TSV coordinates, segmentation, DPI, and
  reproducible OCR configuration.

Attempt DeepWiki first. If a repository is not indexed, use its primary GitHub
repository and a scoped clone rather than a secondary summary.

## Scoped Clone Protocol

Clone each repository separately under:

```text
/tmp/congress-tracker-parser-research/<owner>--<repo>/
```

Record for every clone:

- repository URL, exact commit SHA, branch/tag, and retrieval timestamp;
- license and file-level exceptions;
- languages and runtime dependencies;
- official sources, forms, layouts, and years supported;
- acquisition, pagination, retry, caching, and versioning behavior;
- text, coordinate, table, OCR, row-boundary, wrapped-cell, and multi-page logic;
- ownership, date, amount-range, validation, provenance, and failure semantics;
- measured Raspberry Pi and Ryzen feasibility, or an explicit unknown;
- generative, hosted, abandoned, incompatible, or unsafe techniques to reject.

Delete or refresh clones after saving the revision manifest and comparison
notes. Never add a cloned repository to this worktree.

## Comparison And Promotion

For each useful technique:

1. Describe behavior, inputs, outputs, invariants, and known failures without
   copying implementation text.
2. Compare it with the current Rust parser on identical official filings.
3. Add representative filings to the dual-agent-verified gold corpus.
4. Implement the smallest generalized Rust strategy. Version-pinned native
   extraction executables are allowed; Python production runtimes are not.
5. Run exactness, row-precision, layout-family, determinism, Pi, Ryzen burst,
   and interactive-safe benchmarks.
6. Promote only when all M2/M3 accuracy, provenance, and performance gates pass
   without regressing existing layout families.

External repositories provide algorithms and test ideas, never factual
congressional evidence. Official filings remain canonical.
