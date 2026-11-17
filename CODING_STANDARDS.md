# Coding standards

Mechanical rules live in ESLint, TypeScript and the architecture tests in `src/__tests__/architecture/`. This file holds the judgement calls a reviewer checks.

- **Domain language**: names, tests and review suggestions use the terms in `GLOSSARY.md`, and model a concept the way the glossary does. For example, a cabin out of service is a Block, not a unit status.
- **Decisions**: a change that contradicts an ADR in `docs/adr/` says so and why.
- **UI**: components, pages and `index.css` follow `DESIGN.md`.
- **Area rules**: a `CLAUDE.md` inside a folder (for example `functions/api/`, `src/components/audit/`, `src/components/patterns/`) applies to code in that folder.
