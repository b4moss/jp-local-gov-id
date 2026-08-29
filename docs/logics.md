# API ロジック仕様

実装の正はコード。議論・変更はまずここに書く。

関連: [main.md](./main.md)

---

## 共通ルール

- 見つからない・一意に決まらない → `null` または `[]`（throw しない）
- スキーマ不正 → `LocalGovSchemaError`
- ネットワーク / HTTP 失敗 → 通常の fetch エラー
- 都道府県コード: 2 桁（入力は `"1"` / `"01"` どちらも可）
- 市区町村コード: 6 桁（チェックデジット込み）
- 市区町村が必要な操作は async（遅延ロード）

### `LocalGov`

| フィールド | 内容 |
|------------|------|
| `code` | 都道府県 2 桁 / 市区町村 6 桁 |
| `name` | 名称（例: `千代田区` / `東京都` / `札幌市中央区`） |
| `nameKana` | 半角カナ |
| `prefectureCode` | 所属都道府県コード（都道府県自身の場合は自身） |
| `prefectureName` | 所属都道府県名 |
| `prefectureNameKana` | 所属都道府県カナ |
| `municipalityCounts?` | 都道府県のみ。`{ both, city, ward }`（`designatedCity` と同キー） |

### `SearchOptions`

| フィールド | 既定 | 内容 |
|------------|------|------|
| `prefecture` | なし | 都道府県コードまたは名称で絞り込み |
| `target` | `"all"` | `"all"` \| `"prefectures"` \| `"cities"` |
| `matchField` | `"both"` | `"name"` \| `"nameKana"` \| `"both"` |
| `designatedCity` | `"both"` | `"both"` \| `"city"` \| `"ward"`（政令指定都市の市/区フィルタ） |

### `DesignatedCityMode` / `ListMunicipalitiesOptions`

| 値 | 意味 |
|----|------|
| `"both"` | 政令市本体と行政区の両方（既定・現行どおり） |
| `"city"` | 政令市本体のみ（行政区を除外） |
| `"ward"` | 行政区のみ（政令市本体を除外） |

判定（データフィールド追加なし）:

1. 政令市区: `name` が `/^.+市.+区$/`（例: `札幌市中央区`）
2. 政令市本体: 上記区から市名プレフィックス（例: `札幌市`）を集め、同名のレコード
3. 町村・一般市・東京特別区（`千代田区` 等）は全モードで残す

適用 API: `listMunicipalitiesByPrefecture` / `searchByText` / `getLocalGovCodeByName` / `getMunicipalityCountByPrefecture`

文字列比較前にクエリ・データ双方へ正規化を適用する:

- ひらがな → カタカナ
- 全角カナ → 半角カナ

`both` では正規化後の `name` / `nameKana` のどちらかに一致すればヒット。

### キャッシュ（`url` 経路のみ）

| 経路 | localStorage 書き込み（`cache: true`） | メモリ |
|------|----------------------------------------|--------|
| 初期化（index / prefectures） | する | する |
| `getByCode` / `listMunicipalitiesByPrefecture` / `getMunicipalityByCode` | する | する |
| 都道府県指定の `searchByText` / `getLocalGovCodeByName` | する | する |
| **全国**の `searchByText` / `getLocalGovCodeByName`（市区町村対象） | **しない** | する |

- `cache` 既定 `true`。`false` で localStorage 読み書きなし
- `cacheTtlSeconds` 既定 `31536000`（1 年）。単位は秒
- `data` モードではキャッシュしない

全国検索の並列度: 同時 6（`MUNICIPALITY_FETCH_CONCURRENCY`）

---

## 公開 API

### パッケージ: `@b4moss/jp-local-gov-id`

#### `createLocalGovClient(options)` → `Promise<LocalGovClient>`

- `options`: `{ data }` または `{ url }`（どちらか必須、両方不可）
- `cache?: boolean`（既定 `true`）— `url` モードの localStorage キャッシュ
- `cacheTtlSeconds?: number`（既定 `31536000`）— TTL（秒）。`url` かつ `cache: true` のとき有効
- index + 都道府県を読み込み、スキーマ検証してクライアントを返す
- 市区町村はまだ読まない

#### クライアントメソッド

##### `listPrefectures()` → `LocalGov[]`

- 全都道府県（同期・初期化済み）

##### `getPrefectureByCode(code)` → `LocalGov | null`

- 都道府県コード → エンティティ（同期）
- `"1"` / `"01"` 同一視
- 見つからなければ `null`

##### `getPrefectureCodeByName(name)` → `string | null`

- 都道府県名の完全一致 → 2 桁コード
- 見つからなければ `null`

##### `getMunicipalityCountByPrefecture(pref, options?)` → `number | null`

- `pref`: コードまたは名称（`listMunicipalitiesByPrefecture` と同じ解決）
- `options.designatedCity`: `"both"` \| `"city"` \| `"ward"`（既定 `"both"`）
- 初期化済み都道府県の `municipalityCounts[mode]` を返す（同期・県別データ不要）
- 未知の都道府県 / 件数未載荷 → `null`

##### `listMunicipalitiesByPrefecture(pref, options?)` → `Promise<LocalGov[]>`

- `pref`: コードまたは名称
- `options.designatedCity`: `"both"` \| `"city"` \| `"ward"`（既定 `"both"`）
- 配下の市区町村（市本体・区を含む。`designatedCity` でフィルタ可）
- 未ロードなら当該県の `.bin` を取得してデコード（キャッシュ可）
- 不正な `pref` → `[]`

##### `getMunicipalityByCode(code)` → `Promise<LocalGov | null>`

- 6 桁のみ（それ以外は `null`）
- 先頭 2 桁で県を特定してロード
- 不正・不明 → `null`

##### `getByCode(code)` → `Promise<LocalGov | null>`

- 2 桁 → `getPrefectureByCode`（同期相当を async で返す）
- 6 桁 → `getMunicipalityByCode`
- 不正・不明 → `null`

##### `searchByText(text, options?)` → `Promise<LocalGov[]>`

- **部分一致**（正規化後 `includes`）
- `target` / `prefecture` / `matchField` / `designatedCity` で対象を絞る
- 全国かつ市区町村対象 → 未ロード県を 6 並列で取得（メモリのみ）
- 都道府県のみ対象 → 追加 fetch なし
- 不正な `prefecture` → `[]`

##### `getLocalGovCodeByName(name, options?)` → `Promise<string | null>`

- **完全一致**（正規化後）
- ヒットがちょうど 1 件のときだけその `code` を返す
- 0 件・複数件 → `null`
- `designatedCity` で候補をフィルタしてから一致判定
- ロード／キャッシュ方針は `searchByText` と同じ

#### その他の export

| 名前 | 種別 | 内容 |
|------|------|------|
| `LocalGovSchemaError` | class | スキーマ不一致／不正な JSON・バイナリデータ |
| `LOCAL_GOV_SCHEMA_VERSION` | const | 現行スキーマ版（`1`） |
| `MUNICIPALITY_FETCH_CONCURRENCY` | const | 全国検索の並列度（`6`） |

型: `LocalGov`, `LocalGovClient`, `CreateLocalGovOptions`, `CreateLocalGovCacheOptions`, `SearchOptions`, `SearchTarget`, `MatchField`, `DesignatedCityMode`, `ListMunicipalitiesOptions`, `LocalGovDataset`, `LocalGovIndexFile`, `LocalGovPrefecturesFile`, `LocalGovMunicipalitiesFile`, `LocalGovDataFile`（deprecated）

定数: `DEFAULT_CACHE_TTL_SECONDS`（`31536000`）、`CACHE_TTL_MS`（deprecated 互換）、`LOCAL_GOV_SCHEMA_VERSION`、`MUNICIPALITY_FETCH_CONCURRENCY`

旧名（`createLocalGov`, `getPrefectureCode`, `getMunicipalitiesByPrefecture`, `search`, `getCodeByName`）に互換エイリアスは置かない。

---

### パッケージ: `@b4moss/jp-local-gov-id-data`

| 名前 | 内容 |
|------|------|
| default `dataset` | `{ index, prefectures, municipalitiesByCode, loadMunicipalities }` |
| `index` | インデックス（`index.json`、プレーン JSON） |
| `prefectures` | 都道府県データ（`prefectures.bin` をデコード済み） |
| `municipalitiesByCode` | 県コード → 市区町村データ（`.bin` をデコード済み） |
| `loadMunicipalities(code)` | 県コードで市区町村ファイル（`.bin`）を読み込み、デコードして返す |

---

## 変更ログ（このファイル）

| 日付 | 内容 |
|------|------|
| 2026-07-11 | 現状 API を書き出し |
| 2026-07-11 | 整理案を確定（改名 + カナ検索 `matchField`） |
| 2026-07-11 | `designatedCity` オプション（`both` / `city` / `ward`）を追加 |
