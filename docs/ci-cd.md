# CI / CD

This document describes when GitHub Actions runs, the mandatory local pre-PR gate, how npm publish reuses CI history, and how the documentation site is published.

## Local gate (required before app PR)

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

### Agents (app / library)

1. Run `npm run ci:local` (or `ci:local:fallback` only when Docker is absent).
2. If non-zero, fix and re-run; do not call the PR creation tool yet.
3. Only then open/update the PR.

## App CI (`.github/workflows/ci.yml`)

| Item | Rule |
|------|------|
| Trigger | `pull_request` whose **base** is `develop` or `dev-*` |
| Not triggered | Push to arbitrary branches; PRs into `main` / `release` / `doc-site` / other bases |
| Skip heavy jobs | Same head SHA already has a successful `CI` workflow run |
| Docs-only | Changes limited to `docs/**`, `site/content/**`, `*.md` (and similar) → skip Test/Build on GitHub; local act still runs full jobs by default |
| Parallelism | `Test` and `Build` jobs run in parallel after `Gate` |
| Required check name | Aggregate job **`Test & Build`** (stable for branch protection) |

## Docs CI (`.github/workflows/ci-docs.yml`)

| Item | Rule |
|------|------|
| Trigger | `pull_request` whose **base** is `doc-site` |
| Job | **`Docs Build`**: `npm ci` + `npm run build:site` |
| Out of scope | App `npm test`, app package-only verification, and app CI success/failure — **ignored** for merging into `doc-site` |

### PR targets

| Change type | Open PR against |
|-------------|-----------------|
| Documentation / site (`site/**`, public docs content) | **`doc-site`** |
| Library / data / app scripts | `develop` or `dev-*` (unchanged) |

When the playground needs a newer published library build that already landed on `main` / `release`, merge that branch into `doc-site`. App CI status does not gate that merge.

## Docs deploy (`.github/workflows/deploy-docs.yml`)

| Item | Rule |
|------|------|
| Trigger | `push` to **`doc-site`** (typically after merge) |
| Build | `npm run build:site` → `site/.output/public` |
| Publish | Force-orphan commit to the **`gh-pages`** branch |
| Independent of | App CI, `data-v*` / `app-v*` npm releases, and legacy `site-v*` tags (removed) |

**Manual repo setting:** GitHub Pages → Source = **Deploy from a branch** → `gh-pages` / `(root)`. Custom domain `jplocalgov.oss.b4m.jp` is kept via `site/public/CNAME`.

## Source Excel monitor (`.github/workflows/monitor-source-hash.yml`)

| Item | Rule |
|------|------|
| Trigger | Weekly cron (Monday 01:30 UTC) + `workflow_dispatch` |
| Action | Fetch MIC Excel, SHA-256 vs `resources/000925835.xlsx`, commit `site/public/source-monitor.json` |
| On anomaly | Open/comment Issue with `source-monitor` label; fail the job |
| Details | [test-spec-66-source-hash.md](./test-spec-66-source-hash.md) / Issue #66 |

## CD — npm publish (`.github/workflows/publish.yml`)

| Item | Rule |
|------|------|
| Trigger | GitHub Release **published** for `data-v*` / `app-v*`, or `workflow_dispatch` with a tag |
| Ancestry | Tag commit must be an ancestor of `origin/release` (`git merge-base --is-ancestor`) |
| Verify skip | If that SHA already has CI success → skip Test/Build; always pack + provenance publish |
| No CI history | Run Test + Build, then publish |
| Dispatch | Optional `force_test` to always run Test+Build |

Create `data-v*` / `app-v*` tags from the **`release`** branch. `release-on-tag.yml` auto-creates the GitHub Release for those tag patterns only.

## Quick reference

```text
# App / library
local change → npm run ci:local (must pass)
            → open PR to develop / dev-*
            → CI Gate → Test ‖ Build → "Test & Build"
tag on release → Release → Publish (reuse CI or re-verify) → npm

# Documentation site
site change → open PR to doc-site
           → Docs CI ("Docs Build")
           → merge to doc-site → Deploy Docs → gh-pages → GitHub Pages
```
