# CI / CD

This document describes when GitHub Actions runs, the mandatory local pre-PR gate, and how npm publish reuses CI history.

## Local gate (required before PR)

Before opening or updating a pull request targeting `develop` or `dev-*`, **`act` must succeed** (developers and Cloud Agents).

```bash
# Preferred (requires Docker + nektos/act)
npm run ci:local

# Equivalent
act pull_request -W .github/workflows/ci.yml
```

Defaults live in [`.actrc`](../.actrc). Under `act`, the CI gate always runs Test/Build (`ACT=true` bypasses the GitHub API skip). Codecov is skipped when `ACT` is set.

If Docker is unavailable (some Cloud Agent / constrained environments), use the fallback and treat it as a temporary substitute — **act remains the source of truth** wherever Docker works:

```bash
npm run ci:local:fallback   # npm ci && npm test && npm run build
```

Do not open or update a PR while this gate is failing.

### Agents

1. Run `npm run ci:local` (or `ci:local:fallback` only when Docker is absent).
2. If non-zero, fix and re-run; do not call the PR creation tool yet.
3. Only then open/update the PR.

## CI (`.github/workflows/ci.yml`)

| Item | Rule |
|------|------|
| Trigger | `pull_request` whose **base** is `develop` or `dev-*` |
| Not triggered | Push to arbitrary branches; PRs into `main` / `release` / other bases |
| Skip heavy jobs | Same head SHA already has a successful `CI` workflow run |
| Docs-only | Changes limited to `docs/**`, `site/content/**`, `*.md` (and similar) → skip Test/Build on GitHub; local act still runs full jobs by default |
| Parallelism | `Test` and `Build` jobs run in parallel after `Gate` |
| Required check name | Aggregate job **`Test & Build`** (stable for branch protection) |

Out of scope (unchanged): `deploy-docs.yml` (`site-v*`), `scorecard.yml`.

## CD — npm publish (`.github/workflows/publish.yml`)

| Item | Rule |
|------|------|
| Trigger | GitHub Release **published** for `data-v*` / `app-v*`, or `workflow_dispatch` with a tag |
| Ancestry | Tag commit must be an ancestor of `origin/release` (`git merge-base --is-ancestor`) |
| Verify skip | If that SHA already has CI success → skip Test/Build; always pack + provenance publish |
| No CI history | Run Test + Build, then publish |
| Dispatch | Optional `force_test` to always run Test+Build |

Create `data-v*` / `app-v*` tags from the **`release`** branch. `release-on-tag.yml` auto-creates the GitHub Release for those tag patterns only (`site-v*` stays on the docs workflow).

## Quick reference

```text
local change → npm run ci:local (must pass)
            → open PR to develop / dev-*
            → CI Gate → Test ‖ Build → "Test & Build"
tag on release → Release → Publish (reuse CI or re-verify) → npm
```
