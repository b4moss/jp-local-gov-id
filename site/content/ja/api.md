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

## `LocalGov`

| フィールド | 型 | 説明 |
|------------|-----|------|
| `code` | `string` | 団体コード |
| `name` | `string` | 名称 |
| `nameKana` | `string` | 半角カナ |
| `prefectureCode` | `string` | 都道府県コード（2 桁） |
| `prefectureName` | `string` | 都道府県名 |
| `prefectureNameKana` | `string` | 都道府県カナ |
| `municipalityCounts?` | `{ both, city, ward }` | 都道府県のみ |

## メソッド

| メソッド | 戻り値 | 説明 |
|----------|--------|------|
| `listPrefectures()` | `LocalGov[]` | 全都道府県 |
| `getPrefectureByCode(code)` | `LocalGov \| null` | 都道府県コードで取得 |
| `getPrefectureCodeByName(name)` | `string \| null` | 正式名称から都道府県コード |
| `getMunicipalityCountByPrefecture(pref, options?)` | `number \| null` | 同期で件数取得（県別データ不要） |
| `listMunicipalitiesByPrefecture(pref, options?)` | `Promise<LocalGov[]>` | 県内の市区町村（遅延ロード） |
| `getMunicipalityByCode(code)` | `Promise<LocalGov \| null>` | 市区町村 6 桁で取得 |
| `getByCode(code)` | `Promise<LocalGov \| null>` | 2 桁 / 6 桁を自動判定 |
| `searchByText(text, options?)` | `Promise<LocalGov[]>` | 部分一致検索 |
| `getLocalGovCodeByName(name, options?)` | `Promise<string \| null>` | 正式名称からコード |

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
