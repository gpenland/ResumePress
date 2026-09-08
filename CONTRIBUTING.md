# Contributing

Thanks for considering a contribution to ResumePress.

## Getting set up

Follow the [README](./README.md) setup instructions to get a local dev environment running against Postgres.

## Before opening a PR

- `npx tsc --noEmit` should pass with no errors.
- `npm run build` should succeed.
- Keep changes scoped — a bug fix shouldn't carry unrelated refactors.

## Codebase conventions

[`CLAUDE.md`](./CLAUDE.md) documents the architecture, data model, and patterns this codebase follows — ownership checks on mutations, the server-actions layer, the LaTeX template, shadcn/base-ui quirks, etc. Please read it before making non-trivial changes; PRs that follow existing patterns are much easier to review.

## Opening a PR

- Describe what changed and why.
- Link any related issue.
- Small, focused PRs are easier to review than large ones.
