# Domain docs

**Layout: single-context.**

- `CONTEXT.md` at the repo root is the domain glossary: the canonical terms,
  what each one means, and the terms to avoid.
- `docs/adr/` at the repo root holds Architecture Decision Records, numbered
  sequentially (`0001-<slug>.md`, `0002-<slug>.md`, ...).

Neither exists yet. Create them lazily the first time a term or a
hard-to-reverse decision needs recording (for example, via `domain-modeling`
or `grill-with-docs`).

## Rules for consumers

- Before planning, specifying, or ticketing work, read `CONTEXT.md` if it
  exists. Use its terms in issues, specs, code, and commit messages.
- Before you change an area covered by an ADR, read the relevant ADRs in
  `docs/adr/`. Don't silently contradict an accepted ADR; propose a new one
  that supersedes it.
- When a new term is settled or an existing one sharpened, update `CONTEXT.md`.
- Record only decisions that are hard to reverse, surprising, or the result
  of a real trade-off as ADRs.
