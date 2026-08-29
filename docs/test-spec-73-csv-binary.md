# テスト仕様書: データソース CSV / 独自バイナリ移行（#73）

対象マイルストーン: `data-v1.0.0-rc.10` / `app-v1.0.0-rc.10`  
関連: [main.md](./main.md) / [logics.md](./logics.md) / Issue #73  
作業ブランチ: `dev-app-v1.0.0-rc.10`

## 1. 目的

配信データを JSON から独自 `.bin` に移行しても、**公開 API・公開オブジェクト形・キャッシュ意味**が現行と同等であることを固定する。

- 中間形式 CSV（リポジトリ同梱・npm 非同梱）→ 配信形式 `.bin`（npm 公開）
- `index.json` は残し、`paths` のみ `.bin` を指す
- `schemaVersion` は `1` 据え置き。フォーマット版はバイナリヘッダ `version`
- 公開 `LocalGov` に `hasWard` / `isWard` / 生の数値コードを載せない
- Brotli 等の転送圧縮は **#74（非対象）**
- localStorage の「文字列圧縮」は **minify**（`JSON.stringify` の空白なし）の意味

## 2. 用語

| 用語 | 意味 |
|------|------|
| JLPR | 都道府県一覧バイナリ（magic `JLPR`） |
| JLDT | 都道府県分割市区町村バイナリ（magic `JLDT`） |
| 公開エンベロープ | デコード後の `{ schemaVersion, asOf, … }` オブジェクト（現行 JSON ファイル相当） |
| 公開 LocalGov | API / メモリ上の団体オブジェクト（ゼロ埋め文字列コード） |
| minify キャッシュ | localStorage にデコード後オブジェクトを `JSON.stringify` で保存（空白なし） |

代表サンプル（公開形・現行踏襲）:

| 名称 | 都道府県 `code` | 団体 `code` |
|------|-----------------|-------------|
| 北海道 | `"01"` | （県本体の団体コードは bin/CSV の `muniCode`。公開 pref の `code` は 2 桁） |
| 札幌市 | — | `"011002"` |
| 大阪府 | `"27"` | — |

## 3. バイナリ形式ケース（TC-B）

実装先の目安: `packages/jp-local-gov-id/src/binary/*.test.ts`

### TC-B01: JLPR ラウンドトリップ

- **操作**: 既知の都道府県レコード配列 + `asOf` を encode → decode
- **期待**: `version === 1`、`asOf` 一致、各フィールド一致
- **期待**: 公開正規化後、`prefCode` は 2 桁ゼロ埋め文字列、`municipalityCounts` が復元される

### TC-B02: JLDT ラウンドトリップ

- **操作**: 既知の市区町村レコード（`hasWard`/`isWard` 含む）を encode → decode
- **期待**: コード・名・かな・フラグが一致
- **期待**: 公開エンベロープ化後、`code` は 6 桁ゼロ埋め。`hasWard`/`isWard` は **公開オブジェクトに現れない**

### TC-B03: レコードサイズ

- **期待**: 都道府県レコード **16 bytes**（`u1+u4+u4+u4+u1+u1+u1`）
- **期待**: 市区町村レコード **14 bytes**
- **期待**: [`schema/local-government-code.ksy`](../schema/local-government-code.ksy) の定義と定数が一致

### TC-B04: string table の必須共有

- **前提**: 同一文字列が複数レコードで使われる入力
- **期待**: encode 後、当該文字列の offset はすべて同一
- **期待**: string table 上の実体は 1 エントリ（NUL 終端 UTF-8）

### TC-B05: 不正 magic

- **操作**: 先頭 4 バイトを改変して decode
- **期待**: エラー（JLPR/JLDT 期待と不一致）

### TC-B06: 非対応 version

- **操作**: `version !== 1` のバッファを decode
- **期待**: エラー

### TC-B07: バッファ不足

- **操作**: ヘッダ途中 / レコード途中 / string 途中で切ったバッファを decode
- **期待**: エラー

### TC-B08: 不正 string offset

- **操作**: offset が string table 外、または NUL 終端がバッファ末尾を超える値
- **期待**: エラー

### TC-B09: 末尾余剰バイト

- **操作**: 正当なペイロード末尾に余分なバイトを付与して decode
- **期待**: エラー（厳格）

### TC-B10: endian / ヘッダ順

- **期待**: little-endian。順序は `magic(4)` → `version(u1)` → `as_of_len(u1)` → `as_of` → `record_count(u2)` → レコード配列 → string table

## 4. 生成・パッケージケース（TC-G）

実装先の目安: generate 後の契約テスト、または scripts 側スモーク

### TC-G01: 成果物パス

- **期待**: 存在すること
  - `packages/jp-local-gov-id-data/prefectures.csv`
  - `packages/jp-local-gov-id-data/prefectures/{01..47}.csv`
  - `packages/jp-local-gov-id-data/prefectures.bin`
  - `packages/jp-local-gov-id-data/prefectures/{01..47}.bin`
  - `packages/jp-local-gov-id-data/index.json`
  - `packages/jp-local-gov-id-data/dataset.js`
  - `packages/jp-local-gov-id-data/decode.js`
- **期待**: 旧ペイロード JSON（`prefectures.json` / `prefectures/*.json`）が **存在しない**

### TC-G02: `index.json` の paths

- **期待**: `schemaVersion === 1`
- **期待**: `paths.prefectures === "prefectures.bin"`
- **期待**: `paths.municipalitiesByPrefecture === "prefectures/{code}.bin"`
- **期待**: `prefectureCodes` は `["01", …, "47"]`（2 桁）

### TC-G03: CSV 列

- **都道府県 CSV**: `prefCode,name,nameKana,muniCode,muniCountBoth,muniCountCity,muniCountWard`
- **市区町村 CSV**: `code,name,nameKana,hasWard,isWard`
- **期待**: 大阪府行などで `prefCode` が数値寄りの表記でも、bin 経由の公開形はゼロ埋めされる

### TC-G04: npm 公開面

- **期待**: `package.json` の `files` / `exports` に CSV を **含めない**
- **期待**: `index.json` / `*.bin` / `dataset.js` / `decode.js` / 型定義は含める
- **期待**: `prefectures.json` サブパス export が **無い**

### TC-G05: `dataset.js` ロード時デコード

- **操作**: Node で `@b4moss/jp-local-gov-id-data` を import
- **期待**: `dataset.prefectures` / `dataset.municipalitiesByCode` / `dataset.index` が現行と同形
- **期待**: 公開オブジェクトに `hasWard` / `isWard` が無い
- **期待**: 都道府県 47、全国市区町村件数が `index.counts` と整合

### TC-G06: CSV と bin の内容一致

- **操作**: 各 CSV を解釈して encode した場合と、生成済み `.bin` を decode した結果を比較（または generate 内の同一ソース由来であることを検証）
- **期待**: レコード数・主要フィールドが一致

### TC-G07: Kaitai スキーマ配置

- **期待**: `schema/local-government-code.ksy` がリポジトリに存在し、TC-B03 のサイズ定数と矛盾しない

## 5. 公開データ形ケース（TC-D）

実装先の目安: `municipalityCounts.test.ts` 更新、または data 契約テスト

※ #53（都道府県 `code` 6 桁化）は **本 Issue の非対象**。現行どおり都道府県公開 `code` は 2 桁。

### TC-D01: 都道府県公開形

- **期待**: 各要素が `code`(2桁) / `name` / `nameKana` / `prefectureCode` / `prefectureName` / `prefectureNameKana` / `municipalityCounts` を持つ
- **期待**: `hasWard` / `isWard` / 生の `muniCode` 数値フィールドを **公開オブジェクトに持たない**

### TC-D02: 市区町村公開形

- **期待**: `code`(6桁) / `name` / `nameKana` / `prefectureCode`(2桁) / `prefectureName` / `prefectureNameKana`
- **期待**: `municipalityCounts` / `hasWard` / `isWard` を持たない
- **期待**: `prefectureCode` は団体コード先頭 2 桁と一致

### TC-D03: `municipalityCounts` 整合（既存 TC-01〜07 相当の維持）

- **期待**: 全都道府県で `both`/`city`/`ward` が正の整数
- **期待**: 県別リストに対する `filterByDesignatedCity` 件数と一致
- **期待**: 北海道 `195/185/194`、新潟 `38/30/37`、東京・沖縄は三値が等しい、など既存代表値を維持
- **期待**: `designatedCity` は **名前ヒューリスティック**（現行）で動き、bin フラグ非依存

### TC-D04: `schemaVersion` は 1

- **期待**: `index` / デコード後都道府県ファイル / デコード後県別ファイルの `schemaVersion === 1`
- **期待**: app の `LOCAL_GOV_SCHEMA_VERSION === 1`

## 6. API・クライアントケース（TC-A）

実装先の目安: `api.test.ts`

### TC-A01: url モード — index は JSON、ペイロードは bin

- **前提**: `create({ url })`。`index.json` の paths が `.bin`
- **期待**: index は `response.json()` 相当で取得
- **期待**: 都道府県・県別は `arrayBuffer()` → decode → 既存 validator
- **期待**: 公開 API の戻りは現行と同形（例: `listPrefectures` 47 件、`code === "01"` 等）

### TC-A02: data モード — dataset 互換

- **前提**: `create({ data: dataset })`
- **期待**: 既存 API テスト相当がすべて通過（bin 内部実装を意識しない）

### TC-A03: 市区町村の所属名付与

- **前提**: JLDT 単体には都道府県名・かなが無い
- **操作**: url モードで県別 `.bin` をロード
- **期待**: 各市区町村に正しい `prefectureName` / `prefectureNameKana` が付く（ロード済み都道府県一覧から）

### TC-A04: localStorage キャッシュ（minify）

- **前提**: `cache: true` の url モード
- **期待**: キーはファイル URL（`.bin` URL を含む）
- **期待**: 値は `{ expiresAt, data }` の JSON 文字列で、`data` は **デコード後オブジェクト**（ArrayBuffer / Base64 ではない）
- **期待**: 保存文字列は minify 相当（`JSON.stringify` 既定。余分な pretty-print 空白を付けない）
- **期待**: 全国文字列検索で読んだ県別データは従来どおり persist しない

### TC-A05: キャッシュヒット後の再検証

- **操作**: キャッシュから読んだオブジェクトを再度 schema validate
- **期待**: 現行どおり validate を通し、不正ならエラー

### TC-A06: バイナリ取得失敗・不正 bin

- **操作**: HTTP エラー、または不正 magic の `.bin` を返す stub
- **期待**: 適切なエラー（ネットワークエラー / デコードエラー / `LocalGovSchemaError`）。旧「JSON parse 失敗」文言のみに依存しない

### TC-A07: 既存 API 振る舞い回帰

最低限、次を現行期待のまま維持:

- `getMunicipalityCountByPrefecture`（県別 bin をロードしない）
- `listMunicipalitiesByPrefecture` + `designatedCity`
- `getByCode` / 名称解決
- プール並列・都道府県一覧の先行ロード

### TC-A08: fetch モック契約

- **期待**: テスト stub は `.bin` URL に対し `arrayBuffer()` を提供できる
- **期待**: パス断言は `prefectures.bin` / `prefectures/13.bin` など（旧 `.json` 断言は更新）

## 7. ドキュメント・版（TC-DOC）

手動または軽い grep チェックでよい。

### TC-DOC01: パス表記

- README / site / `docs/main.md` / `docs/logics.md` が `prefectures.bin` / `prefectures/{code}.bin` 前提
- `url` 例は引き続き `index.json` で終わる

### TC-DOC02: 版

- data / app パッケージ版が `1.0.0-rc.10`
- サイトの CDN 例が大きな矛盾を起こさない（可能な範囲で rc.10 に寄せる）

### TC-DOC03: dataset 利用ガイド

- Node では `dataset.js`（ロード時デコード）が有用であること
- ブラウザでは `{ data }` と `{ url }` を選択可能であること

## 8. 非対象（この仕様書では見ない）

- Brotli / gzip 等の転送圧縮（#74）
- #53 の都道府県 6 桁 `code` 化・型分割
- localStorage への独自バイナリ保存や追加圧縮アルゴリズム
- CJS 対応・minify 配布・逆引きインデックスなど他 Issue
- CSV の npm 公開

## 9. 合格条件

1. TC-B / TC-G / TC-D / TC-A が自動テストとして実装され、CI でグリーン
2. `npm run generate` 後に JSON ペイロードが消え、CSV（repo）と bin（npm 対象）が揃う
3. 公開 API・`designatedCity`・`municipalityCounts`・`schemaVersion === 1` の回帰が無い
4. docs / site が本仕様と矛盾しない
5. デコード厳格性（TC-B05〜B09）を満たす
