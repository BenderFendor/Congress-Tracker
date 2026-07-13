# ADR Format

Architecture Decision Records live in `docs/agent/adr/` with sequential four-digit numbering.

## When to create an ADR

Only when ALL three are true:
1. Hard to reverse — the cost of changing your mind later is meaningful
2. Surprising without context — a future reader will wonder "why did they do it this way?"
3. The result of a real trade-off — there were genuine alternatives and you picked one for specific reasons

## Template

```md
# {Short title of the decision}

{1-3 sentences: what's the context, what did we decide, and why.}
```

Optional sections (only when they add value):
- **Status** frontmatter: `proposed | accepted | deprecated | superseded by ADR-NNNN`
- **Considered Options** — only when rejected alternatives are worth remembering
- **Consequences** — only when non-obvious downstream effects need calling out
