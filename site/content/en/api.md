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
- `schemaVersion` is **2** (prefecture `code` is 6-digit; no `prefecture*` fields on prefectures)

## `Prefecture` / `Municipality`

| Field | Prefecture | Municipality |
|-------|------------|--------------|
| `code` | 6-digit local-gov code | 6-digit local-gov code |
| `name` / `nameKana` | yes | yes |
| `prefectureCode` / `prefectureName` / `prefectureNameKana` | **no** | belonging prefecture (2-digit + names) |
| `municipalityCounts?` | `{ both, city, ward }` | no |

`LocalGov = Prefecture | Municipality`

## Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `listPrefectures()` | `Prefecture[]` | All prefectures (each `code` is 6-digit) |
| `getPrefectureByCode(code)` | `Prefecture \| null` | 2-digit org code or 6-digit entity code |
| `getPrefectureCodeByName(name)` | `string \| null` | Official name → **2-digit** prefecture code |
| `getMunicipalityCountByPrefecture(pref, options?)` | `number \| null` | Sync counts |
| `listMunicipalitiesByPrefecture(pref, options?)` | `Promise<Municipality[]>` | Lazy-load municipalities |
| `getMunicipalityByCode(code)` | `Promise<Municipality \| null>` | Municipality 6-digit only |
| `getByCode(code)` | `Promise<LocalGov \| null>` | 2- or 6-digit (6-digit prefers prefecture entity) |
| `searchByText(text, options?)` | `Promise<LocalGov[]>` | Partial match |
| `getLocalGovCodeByName(name, options?)` | `Promise<string \| null>` | Exact name → **6-digit** local-gov code |

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
