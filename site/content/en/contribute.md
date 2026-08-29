---
title: Contribute
description: How to contribute
---

# Contribute

Issues and pull requests are welcome. Join us on the [GitHub repository](https://github.com/b4m-oss/jp-local-gov-id).

## Repository layout

This is an npm workspaces monorepo.

| Path | Contents |
|------|----------|
| `packages/jp-local-gov-id` | JS API |
| `packages/jp-local-gov-id-data` | `index.json` + binary (`.bin`) datasets (CSV intermediates repo-only) |
| `scripts/` | Data generation from Excel, etc. |
| `site/` | This documentation site |
| `docs/` | Internal specs |

## Getting started

```bash
npm install
npm test
npm run build
```

### Required gate before PR

Before opening or updating a PR targeting `develop` / `dev-*`, run local CI (do not open a PR while it fails):

```bash
npm run ci:local            # preferred (nektos/act + Docker)
npm run ci:local:fallback   # only if Docker is unavailable
```

See [docs/ci-cd.md](https://github.com/b4moss/jp-local-gov-id/blob/main/docs/ci-cd.md) for triggers, CD, and agent instructions.

Regenerate data (Ministry of Internal Affairs Excel → CSV in the repo → `.bin` for npm):

```bash
npm run generate
```

Run the docs site locally:

```bash
npm run dev:site
```

## Guidelines

- Bug fixes, docs improvements, and tests are welcome
- Please open an Issue first for breaking API or data-format changes
- See `docs/` in the repository for detailed specs

Licensed under MIT.
