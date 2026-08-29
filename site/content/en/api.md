---
title: API
description: Public LocalGovClient methods
---

# API

Overview of the client returned by `createLocalGovClient`.

## `createLocalGovClient(options)`

| Option | Description |
|--------|-------------|
| `data` | npm dataset (includes `searchNgramShards`) |
| `url` | Versioned `index.json` URL (resolves sibling `.bin.br` paths) |
| `cache` | localStorage cache for `url` mode (default `true`) |
| `cacheTtlSeconds` | Cache TTL in seconds (default `31536000`) |

Exactly one of `data` or `url` is required.

## Data & search highlights

- On-wire payloads are **Brotli (`.bin.br`)**; the client decompresses then decodes
- Nationwide string search uses hybrid JLIX (hot 2-gram regions + cold 3-gram shards)
- After normalize: `&lt;2` → empty / `2` → 2-gram only / `≥3` → merge both
- Index fetch: concurrency 3 with 100ms start stagger; candidate pref bins: concurrency 6
- localStorage stores minified decoded JSON (not raw Brotli). Nationwide pref loads + JLIX are memory-only

## `LocalGov`

| Field | Type | Description |
|-------|------|-------------|
| `code` | `string` | Entity code |
| `name` | `string` | Name |
| `nameKana` | `string` | Halfwidth kana |
| `prefectureCode` | `string` | Prefecture code (2 digits) |
| `prefectureName` | `string` | Prefecture name |
| `prefectureNameKana` | `string` | Prefecture kana |
| `municipalityCounts?` | `{ both, city, ward }` | Prefectures only |

## Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `listPrefectures()` | `LocalGov[]` | All prefectures |
| `getPrefectureByCode(code)` | `LocalGov \| null` | By prefecture code |
| `getPrefectureCodeByName(name)` | `string \| null` | Official name → code |
| `getMunicipalityCountByPrefecture(pref, options?)` | `number \| null` | Sync counts |
| `listMunicipalitiesByPrefecture(pref, options?)` | `Promise<LocalGov[]>` | Lazy-load municipalities |
| `getMunicipalityByCode(code)` | `Promise<LocalGov \| null>` | 6-digit code |
| `getByCode(code)` | `Promise<LocalGov \| null>` | 2- or 6-digit |
| `searchByText(text, options?)` | `Promise<LocalGov[]>` | Partial match |
| `getLocalGovCodeByName(name, options?)` | `Promise<string \| null>` | Exact name → code |

### `designatedCity`

`"both"` (default) / `"city"` / `"ward"`. Tokyo special wards are unaffected.

### Search options

| Key | Default | Description |
|-----|---------|-------------|
| `prefecture` | — | Scope to one prefecture (skips JLIX) |
| `target` | `'all'` | `'all' \| 'prefectures' \| 'cities'` |
| `matchField` | `'both'` | `'name' \| 'nameKana' \| 'both'` |
| `designatedCity` | `'both'` | Designated-city filter |

## Errors & empty results

- Schema / invalid payload → `LocalGovSchemaError`
- Network / HTTP → normal fetch errors
- Missing / ambiguous → `null` / `[]` (no throw)
