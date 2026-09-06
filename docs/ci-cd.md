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
| Trigger | `pull_request` whose **base** is `develop` or `dev-*`; `push` to **`main`** or **`release`** |
| Not triggered | Push to `develop` / arbitrary branches; PRs into `main` / `release` / `doc-site` / other bases |
| Skip heavy jobs | Same head SHA already has a successful `CI` workflow run; or docs/site-only change set (**PR and push**) |
| Docs/site-only | Changes limited to `docs/**`, `site/**`, `*.md`, docs deploy workflows, and similar → skip Test/Build on GitHub (including `main` / `release` pushes). Local act still runs full jobs by default |
| Jobs | `Gate` then a single **`Test & Build`** job (`npm ci` once → test → build). Site workspace is not installed |
| Required check name | **`Test & Build`** (stable for branch protection; job always reports, even when heavy work is skipped) |
| Why `main` push | Codecov default-branch coverage upload (#121) — **one** app CI run per code push; docs/site-only pushes skip heavy work |
| Why `release` push | Tag SHAs created from `release` get CI history so publish can skip Test |
| Not this workflow | GitHub **CodeQL** default setup is separate (`dynamic/github-code-scanning/codeql`) and may also run on `main` pushes |

## Docs CI (`.github/workflows/ci-docs.yml`)

| Item | Rule |
|------|------|
| Trigger | `pull_request` whose **base** is `doc-site` |
| Skip heavy jobs | **Content-only** change set → skip site build (check still reports success) |
| Content-only | `docs/**`, `site/content/**`, `site/public/**`, `*.md`, `site/site.meta.yaml.example`, and similar |
| Full Docs Build | Any change under site logic/config (e.g. `site/app/**`, `site/server/**`, `nuxt.config.ts`, `package.json`, i18n, workflows that affect the site build) |
| Job | **`Docs Build`**: scoped `npm ci` (site + library/data) + `npm run build:site` when not skipped |
| Out of scope | App `npm test`, app package-only verification, and app CI success/failure — **ignored** for merging into `doc-site` |
| Deploy still runs | Content-only merges to `doc-site` still trigger **Deploy Docs** so Pages stays up to date |

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
| Publish | GitHub Actions Pages (`upload-pages-artifact` → `deploy-pages`). **No `gh-pages` branch** |
| Independent of | App CI, `data-v*` / `app-v*` npm releases, and legacy `site-v*` tags (removed) |

**Manual repo setting:** GitHub Pages → Source = **GitHub Actions**. Custom domain `jplocalgov.oss.b4m.jp` is kept via `site/public/CNAME`.

## Source Excel monitor (`.github/workflows/monitor-source-hash.yml`)

| Item | Rule |
|------|------|
| Trigger | Weekly cron (Monday 01:30 UTC) + `workflow_dispatch` |
| Action | Fetch MIC Excel, SHA-256 vs `resources/000925835.xlsx`, commit `site/public/source-monitor.json` |
| Install | scripts workspace only |
| On anomaly | Open/comment Issue with `source-monitor` label; fail the job |
| Details | [test-spec-66-source-hash.md](./test-spec-66-source-hash.md) / Issue #66 |

## OpenSSF Scorecard (`.github/workflows/scorecard.yml`)

| Item | Rule |
|------|------|
| Trigger | Weekly cron (Monday 01:30 UTC), `branch_protection_rule`, `workflow_dispatch` |
| Not on | Every `main` push (removed to cut redundant runs) |

## CD — npm publish (`.github/workflows/publish.yml`)

| Item | Rule |
|------|------|
| Trigger | GitHub Release **published** for `data-v*` / `app-v*`, or `workflow_dispatch` with a tag |
| Ancestry | Tag commit must be an ancestor of `origin/release` (`git merge-base --is-ancestor`) |
| Verify skip | If that SHA already has CI success → skip **Test**; **Build always runs** (`dist/` is gitignored) |
| No CI history | Run Test + Build, then publish |
| Dispatch | Optional `force_test` to always run Test |
| Install | App workspaces only (no site) |

Create `data-v*` / `app-v*` tags from the **`release`** branch. `release-on-tag.yml` auto-creates the GitHub Release for those tag patterns only.

## v1.0.0 GA (Issue #121)

Official release is gated on Codecov **project coverage ≥ 90%** (`target: 90%` in `codecov.yml`).

1. PR into `develop` is green and Codecov project status is ≥ 90%
2. After merge to `main` / `release`, a `main` push coverage upload refreshes the default-branch badge to ≥ 90%
3. Bump app / data package versions to `1.0.0` (drop rc)
4. Tag `app-v1.0.0` / `data-v1.0.0` from `release` → Release → Publish
5. Close Issue #121

## After v1.0.0

Subsequent app tags (`app-v1.1.0`, `app-v1.2.0`, …) follow the same **tag from `release` → Release → Publish** flow. Data may remain on `data-v1.0.0` when only the API package changes (as with app `1.2.0`).

## Quick reference

```text
# App / library
local change → npm run ci:local (must pass)
            → open PR to develop / dev-*
            → CI Gate → "Test & Build" (single job)
release push → CI (history for publish skip)
tag on release → Release → Publish (reuse CI Test or re-verify; always Build) → npm

# Documentation site
site logic/config → open PR to doc-site → Docs CI ("Docs Build")
content-only     → open PR to doc-site → Docs CI Gate skips build
                 → merge to doc-site → Deploy Docs → GitHub Pages (Actions)
```

