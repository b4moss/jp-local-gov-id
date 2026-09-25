# テスト仕様書: 都道府県返却スキーマの変更（#53）

対象マイルストーン: `data-v1.0.0-rc.4` / `app-v1.0.0-rc.3`  
関連: [main.md](./main.md) / [logics.md](./logics.md) / Issue #53

## 1. 目的

都道府県を地方公共団体として正しく表現する破壊的変更の受け入れ条件を固定する。

- 都道府県エンティティの `code` は **6 桁の地方公共団体コード**
- 都道府県は所属都道府県フィールド（`prefecture*`）を持たない
- 市区町村のみ所属都道府県フィールドを持つ
- 型は `Prefecture` / `Municipality` に分割（`LocalGov` は union）
- **2 桁の都道府県コードによる解決は維持**
- `getPrefectureCodeByName` は都道府県コード（2 桁）を返す（変更なし）
- `getLocalGovCodeByName`（都道府県ヒット時）は地方公共団体コード（6 桁）を返す

## 2. 用語

| 用語 | 意味 | 例（東京都） |
|------|------|----------------|
| 都道府県コード（組織キー） | 2 桁。ファイルパス・`index.prefectureCodes`・フィルタ・`getPrefectureCodeByName` の戻り | `"13"` |
| 地方公共団体コード | 6 桁。エンティティの `code`。`getLocalGovCodeByName` / `getByCode` の正 | `"130001"` |

代表サンプル:

| 名称 | 都道府県コード | 地方公共団体コード |
|------|----------------|--------------------|
| 北海道 | `01` | `010006` |
| 東京都 | `13` | `130001` |
| 新潟県 | `15` | `150002` |
| 沖縄県 | `47` | `470007` |

## 3. データ仕様ケース（TC-D）

実装先の目安: `municipalityCounts.test.ts` 相当、または `#53` 用 data 契約テスト。

### TC-D01: 全都道府県の `code` が 6 桁

- **前提**: 再生成後の `prefectures.json`
- **操作**: 47 件すべてを検査
- **期待**: 各 `code` が `/^\d{6}$/`。先頭 2 桁は従来の都道府県コードと一致（`01`…`47`）

### TC-D02: 都道府県に `prefecture*` が無い

- **前提**: `prefectures.json` の各都道府県
- **期待**: `prefectureCode` / `prefectureName` / `prefectureNameKana` を **持たない**
- **期待**: 必須は `code` / `name` / `nameKana`。`municipalityCounts` は従来どおり都道府県にのみ存在

### TC-D03: 市区町村は所属フィールドを維持

- **前提**: `prefectures/{2桁}.json`（少なくとも `01` / `13`）
- **期待**: 各市区町村が `code`(6桁) / `name` / `nameKana` / `prefectureCode`(2桁) / `prefectureName` / `prefectureNameKana` を持つ
- **期待**: 市区町村に `municipalityCounts` は無い

### TC-D04: 代表コード値

| 名称 | `Prefecture.code` |
|------|-------------------|
| 北海道 | `010006` |
| 東京都 | `130001` |
| 新潟県 | `150002` |
| 沖縄県 | `470007` |

### TC-D05: 索引・パスは 2 桁のまま

- **期待**: `index.prefectureCodes` は `["01", …, "47"]`（2 桁）
- **期待**: 県別ファイルパスは `prefectures/01.json` 形式（2 桁）。6 桁ファイル名にしない

### TC-D06: `schemaVersion` が 2

- **期待**: `index.json` / `prefectures.json` / `prefectures/{code}.json` の `schemaVersion === 2`
- **期待**: app の `LOCAL_GOV_SCHEMA_VERSION === 2`。旧 `1` データはスキーマエラー

### TC-D07: `municipalityCounts` の配置は不変

- **期待**: `prefectures.json` の都道府県にのみ存在
- **期待**: `index.json` および県別ファイル本体・市区町村要素には無い
- **期待**: `both` / `city` / `ward` の意味・値の整合は既存 TC（旧 TC-01〜07 相当）を維持。ただし都道府県の Map キーは 2 桁組織キー（`code.slice(0,2)`）で解決する

## 4. API 仕様ケース（TC-A）

実装先の目安: `api.test.ts`

### TC-A01: `listPrefectures` の形

- **期待**: 47 件。各要素は `Prefecture`（6 桁 `code`、所属フィールドなし、`municipalityCounts` あり）
- **期待**: `prefs.map(p => p.code)` に `"130001"` を含み、`"13"` を **エンティティ code としては含まない**

### TC-A02: `getPrefectureByCode` — 2 桁解決維持

| 入力 | 期待 |
|------|------|
| `"13"` | 東京都。`code === "130001"` |
| `"1"` / `"01"` | 北海道。`code === "010006"` |
| 未知・不正 | `null` |

### TC-A03: `getPrefectureByCode` — 6 桁エンティティ解決

| 入力 | 期待 |
|------|------|
| `"130001"` | 東京都（TC-A02 と同オブジェクト） |
| `"010006"` | 北海道 |
| 市区町村コード（例: `"131016"`） | `null`（都道府県 API のため） |

### TC-A04: `getPrefectureCodeByName` は 2 桁

| 入力 | 期待 |
|------|------|
| `"東京都"` | `"13"` |
| `"北海道"` | `"01"` |
| 未知 | `null` |

※ 地方公共団体コード（6 桁）を返してはならない。

### TC-A05: `getByCode` — 2 桁 / 6 桁都道府県 / 市区町村

| 入力 | 期待 |
|------|------|
| `"13"` / `"1"`（必要なら） | 都道府県。`code === "130001"`、所属フィールドなし |
| `"130001"` | 同上の都道府県 |
| `"131016"` | 市区町村（千代田区）。所属フィールドあり |
| 未知 | `null` |

### TC-A06: `getLocalGovCodeByName` — 都道府県は 6 桁

| 入力 | 期待 |
|------|------|
| `"東京都"`（必要なら `{ target: "prefectures" }`） | `"130001"` |
| `"北海道"` | `"010006"` |
| `"千代田区"` | `"131016"`（従来どおり） |

### TC-A07: `getMunicipalityByCode` は都道府県 6 桁を市区町村扱いしない

| 入力 | 期待 |
|------|------|
| `"131016"` | 千代田区 |
| `"130001"` / `"13"` | `null` |

### TC-A08: フィルタ・一覧の都道府県指定は 2 桁（および名称）

- **操作**: `listMunicipalitiesByPrefecture("13")` / `"東京都"` / 必要なら `"1"` 相当の既存規則
- **期待**: 従来どおり市区町村配列。`options.prefecture: "13"` の検索も同様
- **期待**: 内部・ファイル解決は 2 桁組織キー。呼び出し側に 6 桁都道府県コードを強制しない（6 桁を受け付ける場合は組織キーへ正規化してよいが、本仕様の必須は 2 桁・名称の維持）

### TC-A09: `getMunicipalityCountByPrefecture` は従来どおり

- **期待**: `"13"` / `"東京都"` で同値。県別 JSON をロードしない
- **期待**: 返却件数は `municipalityCounts` 由来（既存 TC-A01〜A08 相当を追従更新）

### TC-A10: スキーマ検証

- **期待**: `schemaVersion: 1` のデータセットは `LocalGovSchemaError`
- **期待**: 都道府県に `prefectureCode` が残っている・`code` が 2 桁のみ、など不正形はエラー（validators の定義に従う）

## 5. 型・判別（TC-T）

### TC-T01: 型分割

- `Prefecture`: `code` / `name` / `nameKana` / `municipalityCounts?`
- `Municipality`: `code` / `name` / `nameKana` / `prefectureCode` / `prefectureName` / `prefectureNameKana`
- `LocalGov = Prefecture | Municipality`
- 公開 API の戻り値型を可能な範囲で精密化（例: `listPrefectures(): Prefecture[]`）

### TC-T02: 実行時判別

- Municipality: `'prefectureCode' in value`
- Prefecture: 所属フィールドを持たない（必要なら `isPrefecture` / `isMunicipality` を export しテスト）

## 6. 非対象（この仕様書では見ない）

- CJS / minify / 逆引きインデックスなど他 issue
- `municipalityCounts` の意味変更・削除
- 2 桁解決の廃止
- 市区町村スキーマのフィールド追加・削除（所属フィールド維持が前提）

## 7. 合格条件

1. TC-D / TC-A / TC-T が自動テストとして実装され、CI でグリーン
2. 既存の 2 桁解決・`getPrefectureCodeByName`（2 桁）・`municipalityCounts` 系の意図が回帰していない
3. `schemaVersion === 2` と版バンプ（data rc.4 / app rc.3）が揃っている
4. docs / site API が本仕様と矛盾しない
