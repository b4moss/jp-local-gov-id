---
title: API
description: LocalGovClient の公開メソッド
---

# API

`createLocalGovClient` が返すクライアントの概要です。

## `createLocalGovClient(options)`

| オプション | 説明 |
|------------|------|
| `data` | npm データセット（または同等オブジェクト。`searchNgramShards` 含む） |
| `url` | `index.json` の版付き URL（配下の `.bin.br` を相対解決） |
| `cache` | `url` モードの localStorage キャッシュ。既定 `true` |
| `cacheTtlSeconds` | キャッシュ TTL（秒）。既定 `31536000`（1 年） |

どちらか一方が必須（`data` または `url`）。

## データと検索の要点

- 配信ペイロードは **Brotli（`.bin.br`）**。クライアントが展開してからデコード
- 全国文字列検索はハイブリッド JLIX（ホット 2-gram 地域 + コールド 3-gram シャード）
- 正規化後長: `&lt;2` → 空 / `2` → 2-gram のみ / `≥3` → 両索引マージ
- 索引ロードは concurrency=3・開始 100ms ずらし。候補県 `.bin.br` は同時最大 6
- localStorage に書くのはデコード後オブジェクトの minify JSON（転送 Brotli とは別）。全国検索の県別・JLIX はメモリのみ
- `schemaVersion` は **2**（都道府県は 6 桁団体コード、所属フィールドなし）

## `Prefecture` / `Municipality`

| フィールド | Prefecture | Municipality |
|------------|------------|--------------|
| `code` | 6 桁地方公共団体コード | 6 桁地方公共団体コード |
| `name` / `nameKana` | あり | あり |
| `prefectureCode` / `prefectureName` / `prefectureNameKana` | **なし** | 所属都道府県（2 桁＋名称） |
| `municipalityCounts?` | `{ both, city, ward }` | なし |

`LocalGov = Prefecture | Municipality`

## メソッド

| メソッド | 戻り値 | 説明 |
|----------|--------|------|
| `listPrefectures()` | `Prefecture[]` | 全都道府県（各 `code` は 6 桁） |
| `getPrefectureByCode(code)` | `Prefecture \| null` | 2 桁都道府県コードまたは 6 桁団体コードで取得 |
| `getPrefectureCodeByName(name)` | `string \| null` | 正式名称から**都道府県コード（2 桁）** |
| `getMunicipalityCountByPrefecture(pref, options?)` | `number \| null` | 同期で件数取得（県別データ不要） |
| `listMunicipalitiesByPrefecture(pref, options?)` | `Promise<Municipality[]>` | 県内の市区町村（遅延ロード） |
| `getMunicipalityByCode(code)` | `Promise<Municipality \| null>` | 市区町村 6 桁で取得 |
| `getByCode(code)` | `Promise<LocalGov \| null>` | 2 桁 / 6 桁を自動判定（6 桁は都道府県エンティティ優先） |
| `searchByText(text, options?)` | `Promise<LocalGov[]>` | 部分一致検索 |
| `getLocalGovCodeByName(name, options?)` | `Promise<string \| null>` | 正式名称から**地方公共団体コード（6 桁）** |

### `designatedCity` オプション

| 値 | 意味 |
|----|------|
| `"both"` | 市本体と区の両方（既定） |
| `"city"` | 市本体のみ |
| `"ward"` | 区のみ |

適用 API: `listMunicipalitiesByPrefecture` / `searchByText` / `getLocalGovCodeByName` / `getMunicipalityCountByPrefecture`。東京特別区は対象外。

### `searchByText` / `getLocalGovCodeByName` の options

| キー | 型 | 既定 | 説明 |
|------|-----|------|------|
| `prefecture` | `string` | — | 都道府県で絞り込み（このとき JLIX は使わない） |
| `target` | `'all' \| 'prefectures' \| 'cities'` | `'all'` | 検索対象 |
| `matchField` | `'name' \| 'nameKana' \| 'both'` | `'both'` | 照合フィールド |
| `designatedCity` | `'both' \| 'city' \| 'ward'` | `'both'` | 政令指定都市の市/区フィルタ |

## エラーと空結果

- スキーマ不一致・不正なデータ → `LocalGovSchemaError`
- ネットワーク / HTTP 失敗 → 通常の fetch エラー
- 見つからない・同名衝突 → `null` / `[]`（throw しない）
