---
title: API
description: LocalGovClient の公開メソッド
---

# API

`createLocalGovClient` が返すクライアントの概要です。

## `createLocalGovClient(options)`

| オプション | 説明 |
|------------|------|
| `data` | npm データセット（または同等オブジェクト） |
| `url` | `index.json` の版付き URL |
| `cache` | `url` モードの localStorage キャッシュ。既定 `true` |
| `cacheTtlSeconds` | キャッシュ TTL（秒）。既定 `31536000`（1 年） |

どちらか一方が必須（`data` または `url`）。両方指定は不可。`cache` / `cacheTtlSeconds` は `url` モード向け（`data` では URL キャッシュに使わない）。

## `Prefecture` / `Municipality` / `LocalGov`

`LocalGov = Prefecture | Municipality`。

### `Prefecture`

| フィールド | 型 | 説明 |
|------------|-----|------|
| `code` | `string` | 地方公共団体コード（6 桁） |
| `name` | `string` | 名称 |
| `nameKana` | `string` | 半角カナ |
| `municipalityCounts?` | `{ both, city, ward }` | `designatedCity` モード別件数 |

所属都道府県フィールド（`prefecture*`）は持たない。

### `Municipality`

| フィールド | 型 | 説明 |
|------------|-----|------|
| `code` | `string` | 地方公共団体コード（6 桁） |
| `name` | `string` | 名称 |
| `nameKana` | `string` | 半角カナ |
| `prefectureCode` | `string` | 所属都道府県コード（2 桁） |
| `prefectureName` | `string` | 都道府県名 |
| `prefectureNameKana` | `string` | 都道府県カナ |

## メソッド

| メソッド | 戻り値 | 説明 |
|----------|--------|------|
| `listPrefectures()` | `Prefecture[]` | 全都道府県 |
| `getPrefectureByCode(code)` | `Prefecture \| null` | 2 桁都道府県コードまたは 6 桁団体コードで取得 |
| `getPrefectureCodeByName(name)` | `string \| null` | 正式名称から**都道府県コード（2 桁）** |
| `getMunicipalityCountByPrefecture(pref, options?)` | `number \| null` | `municipalityCounts` から同期で件数取得（県別 JSON 不要） |
| `listMunicipalitiesByPrefecture(pref, options?)` | `Promise<Municipality[]>` | 県内の市区町村（遅延ロード） |
| `getMunicipalityByCode(code)` | `Promise<Municipality \| null>` | 市区町村 6 桁で取得 |
| `getByCode(code)` | `Promise<LocalGov \| null>` | 2 桁 / 6 桁を自動判定（6 桁は都道府県エンティティ優先） |
| `searchByText(text, options?)` | `Promise<LocalGov[]>` | 部分一致検索 |
| `getLocalGovCodeByName(name, options?)` | `Promise<string \| null>` | 正式名称から**地方公共団体コード（6 桁）** |

### `designatedCity` オプション

政令指定都市の市本体 / 行政区の出し分けです。既定は `"both"`。東京特別区（`千代田区` など）は対象外です。

| 値 | 意味 |
|----|------|
| `"both"` | 市本体と区の両方（既定） |
| `"city"` | 市本体のみ（行政区を除外） |
| `"ward"` | 区のみ（市本体を除外） |

適用 API: `listMunicipalitiesByPrefecture` / `searchByText` / `getLocalGovCodeByName` / `getMunicipalityCountByPrefecture`

### `listMunicipalitiesByPrefecture` / `getMunicipalityCountByPrefecture` の options

| キー | 型 | 既定 | 説明 |
|------|-----|------|------|
| `designatedCity` | `'both' \| 'city' \| 'ward'` | `'both'` | 政令指定都市の市/区フィルタ |

### `searchByText` / `getLocalGovCodeByName` の options

| キー | 型 | 既定 | 説明 |
|------|-----|------|------|
| `prefecture` | `string` | — | 都道府県で絞り込み |
| `target` | `'all' \| 'prefectures' \| 'cities'` | `'all'` | 検索対象 |
| `matchField` | `'name' \| 'nameKana' \| 'both'` | `'both'` | 照合フィールド |
| `designatedCity` | `'both' \| 'city' \| 'ward'` | `'both'` | 政令指定都市の市/区フィルタ |

文字列検索はひらがな／全角カナを半角カナへ正規化します。

## エラーと空結果

- スキーマ不一致・不正 JSON → `LocalGovSchemaError`
- ネットワーク / HTTP 失敗 → 通常の fetch エラー
- 見つからない・同名衝突 → `null` / `[]`（throw しない）

## `url` モードのキャッシュ

- 既定で取得ファイルを localStorage にキャッシュ（キーは URL）
- `cache: false` で無効化できる
- `cacheTtlSeconds` で TTL を秒単位で指定（既定 1 年 = `31536000`）
- **全国対象**の文字列検索で読み込んだ県別 JSON はメモリのみ（localStorage に書かない）
