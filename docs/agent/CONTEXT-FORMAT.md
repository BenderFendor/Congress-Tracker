# CONTEXT.md Format

`CONTEXT.md` lives at `docs/agent/CONTEXT.md`. It is a glossary of domain terms — nothing else.
- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others under `_Avoid_`.
- **Keep definitions tight.** One or two sentences max. Define what it IS, not what it does.
- **Only include terms specific to this project's domain.** General programming concepts (timeouts, error types, utility patterns) don't belong.
- **Group terms under subheadings** when natural clusters emerge.
- **No implementation details.** No table names, no column types, no code references.

## Multi-context repos

If the project has multiple bounded contexts, create a `CONTEXT-MAP.md` at the root listing them. Each context gets its own `CONTEXT.md` in a subdirectory. This project has one context.

## Template

```md
# {Context Name}

{One or two sentence description of what this context is and why it exists.}

## Language

**Term**:
{A one or two sentence description}
_Avoid_: {alternate names}
```
