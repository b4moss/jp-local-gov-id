---
title: API
description: LocalGovClient public methods
---

# API

Overview of the client returned by `createLocalGovClient`.

## `createLocalGovClient(options)`

| Option | Description |
|--------|-------------|
| `data` | npm dataset (or equivalent object) |
| `url` | Versioned URL to `index.json` |
| `cache` | localStorage cache for `url` mode. Default `true` |
| `cacheTtlSeconds` | Cache TTL in seconds. Default `31536000` (1 year) |

Exactly one of `data` or `url` is required. `cache` / `cacheTtlSeconds` apply to `url` mode (unused for URL caching when using `data`).

## `LocalGov`

| Field | Type | Description |
|-------|------|-------------|
| `code` | `string` | Entity code |
| `name` | `string` | Name |
| `nameKana` | `string` | Halfwidth kana |
| `prefectureCode` | `string` | Prefecture code (2 digits) |
| `prefectureName` | `string` | Prefecture name |
| `prefectureNameKana` | `string` | Prefecture kana |
| `municipalityCounts?` | `{ both, city, ward }` | Prefecture records only; counts by `designatedCity` mode |

## Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `listPrefectures()` | `LocalGov[]` | All prefectures |
| `getPrefectureByCode(code)` | `LocalGov \| null` | Lookup by prefecture code |
| `getPrefectureCodeByName(name)` | `string \| null` | Prefecture code from exact name |
| `getMunicipalityCountByPrefecture(pref, options?)` | `number \| null` | Sync count from `municipalityCounts` (no municipality JSON load) |
| `listMunicipalitiesByPrefecture(pref, options?)` | `Promise<LocalGov[]>` | Municipalities in a prefecture (lazy) |
| `getMunicipalityByCode(code)` | `Promise<LocalGov \| null>` | Lookup by 6-digit municipality code |
| `getByCode(code)` | `Promise<LocalGov \| null>` | Auto-detect 2-digit / 6-digit |
| `searchByText(text, options?)` | `Promise<LocalGov[]>` | Partial-match search |
| `getLocalGovCodeByName(name, options?)` | `Promise<string \| null>` | Code from exact name |

### `designatedCity` option

Filters designated-city bodies vs administrative wards. Default is `"both"`. Tokyo special wards (e.g. `千代田区`) are not affected.

| Value | Meaning |
|-------|---------|
| `"both"` | City body and wards (default) |
| `"city"` | City body only (exclude wards) |
| `"ward"` | Wards only (exclude city bodies) |

Applies to: `listMunicipalitiesByPrefecture` / `searchByText` / `getLocalGovCodeByName` / `getMunicipalityCountByPrefecture`

### `listMunicipalitiesByPrefecture` / `getMunicipalityCountByPrefecture` options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `designatedCity` | `'both' \| 'city' \| 'ward'` | `'both'` | Designated-city body/ward filter |

### `searchByText` / `getLocalGovCodeByName` options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `prefecture` | `string` | — | Filter by prefecture |
| `target` | `'all' \| 'prefectures' \| 'cities'` | `'all'` | Search target |
| `matchField` | `'name' \| 'nameKana' \| 'both'` | `'both'` | Fields to match |
| `designatedCity` | `'both' \| 'city' \| 'ward'` | `'both'` | Designated-city body/ward filter |

String search normalizes hiragana / fullwidth kana to halfwidth kana.

## Errors and empty results

- Schema mismatch / invalid JSON → `LocalGovSchemaError`
- Network / HTTP failures → normal fetch errors
- Missing or ambiguous results → `null` / `[]` (no throw)

## Caching in `url` mode

- By default, fetched files are cached in localStorage (key = URL)
- Disable with `cache: false`
- Set TTL with `cacheTtlSeconds` (seconds; default 1 year = `31536000`)
- Municipality JSON loaded by **nationwide** string search stays in memory only
