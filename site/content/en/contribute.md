---
title: Contributing
description: How to contribute
---

# Contributing

Issues and pull requests are welcome on the [GitHub repository](https://github.com/b4moss/jp-local-gov-id).

## Repository layout

| Path | Contents |
|------|----------|
| `packages/jp-local-gov-id` | JS API |
| `packages/jp-local-gov-id-data` | `index.json` + `.bin.br` (prefectures, per-pref, JLIX). CSV / uncompressed `.bin` are repo-only |
| `scripts/` | Excel → data generation |
| `site/` | This docs site |
| `docs/` | Internal specs |

## Getting started

```bash
npm install
npm test
npm run build
```

### Required gate before PRs

```bash
npm run ci:local            # preferred (nektos/act + Docker)
npm run ci:local:fallback   # when Docker is unavailable
```

Regenerate data (Excel → CSV / `.bin` for review → `.bin.br` + hybrid JLIX for npm):

```bash
npm run generate
```

Docs site locally:

```bash
npm run dev:site
```

## Guidance

- Bug fixes, docs, and tests are welcome
- Breaking API or data-format changes should start with an Issue
- See `docs/` (especially `logics.md`, `main.md`, `test-spec-63-search-ngrams.md`) for contracts

License: MIT.
