# テスト仕様書: 文字列検索用 2-gram 逆引きインデックス — CSV / JLIX 生成（#63 Phase 1）

対象マイルストーン: `data-v1.0.0-rc.10` / `app-v1.0.0-rc.10`  
関連: [main.md](./main.md) / [logics.md](./logics.md) / [test-spec-73-csv-binary.md](./test-spec-73-csv-binary.md) / Issue #63  
作業ベース: `dev-app-v1.0.0-rc.10`  
想定実装ブランチ: `cursor/issue-63-jlix-generate-4c4d`

## 1. 目的

全国文字列検索向け **2-gram 逆引きインデックス**について、中間 CSV と独自バイナリ（magic `JLIX`）の生成・デコード契約を固定する。

本仕様の範囲（Phase 1）:

- 正規化済み名称からの **コードポイント単位 2-gram** 生成
- `search-ngrams.csv`（リポジトリ同梱・npm 非同梱）
- `search-ngrams.bin`（JLIX・npm 公開）
- `index.json` の `paths.searchNgrams` **必須追加**（既存 paths は非破壊）
- `{ data }` dataset への **生 JLIX バイト**（`searchNgrams`）同梱
- Kaitai（[`schema/local-government-code.ksy`](../schema/local-government-code.ksy)）への JLIX 追加

本仕様の **非対象**（後続 Phase）:

- `searchByText` / `getLocalGovCodeByName` の索引検索への切替
- url モードの lazy ロード / localStorage 方針の変更
- Brotli 圧縮配信（#74 の取り込み拡大）
- 索引ヒット後の県 `.bin` 取得やヒット順など、クライアント検索挙動全般

## 2. 用語

| 用語 | 意味 |
|------|------|
| JLIX | 2-gram 検索インデックスバイナリ（magic `JLIX` = `0x4A 0x4C 0x49 0x58`） |
| posting | CSV/bin の 1 行（1 レコード）。`(gram, gramType, muniCode)` で一意 |
| gram | 正規化済み文字列をコードポイント単位で切った 2 文字 |
| `muniCode` | 地方公共団体コード（6 桁。都道府県も 6 桁） |
| `prefCode` | 都道府県コード（2 桁。県行も自身） |
| 生 JLIX | decode 前の `ArrayBuffer` / `Uint8Array` |

代表サンプル:

| 対象 | kind | prefCode | muniCode | 備考 |
|------|------|----------|----------|------|
| 大阪府 | pref | `27` | `270008` | 2 識別子を混同しない |
| 千代田区 | muni | `13` | `131016` | |
| 札幌市中央区 | muni | `01` | `011011` | `isWard=1` |

## 3. 2-gram ヘルパケース（TC-N）

実装先の目安: `packages/jp-local-gov-id/src/**/*.test.ts`（`normalize` / `searchNgrams` 近傍）

### TC-N01: コードポイント単位

- **操作**: 正規化済み文字列（例: 漢字・半角カナ）から 2-gram 列を生成
- **期待**: `[...str]` / `Array.from` 相当のコードポイント単位で切る（UTF-16 コードユニットではない）
- **期待**: 半角濁点を含むかな（例: `ｶﾞ`）でもコードポイント境界を壊さない

### TC-N02: 長さ未満は空

- **操作**: 正規化後長が `0` または `1` の入力
- **期待**: 2-gram 配列は空（1-gram は出さない）

### TC-N03: 連続 2-gram

- **操作**: 長さ 3 以上（例: `中央区` → 正規化後も 3 コードポイント）
- **期待**: 隣接ペアがすべて出る（例: `中央`, `央区`）

### TC-N04: 正規化との接続

- **操作**: ひらがな・全角カナを含む生文字列に `normalizeSearchText` してから 2-gram 化
- **期待**: 現行検索と同じ正規化結果に対する gram になる

## 4. バイナリ形式ケース（TC-B）

実装先の目安: `packages/jp-local-gov-id/src/binary/*.test.ts`  
レイアウトは JLPR/JLDT と同型: `magic(4)` → `version(u1)` → `as_of_len(u1)` → `as_of` → `record_count(u2)` → 固定長レコード配列 → NUL 終端 UTF-8 string table（offset は string table 先頭相対、同一文字列は offset 共有、endian little）。

### TC-B01: JLIX ラウンドトリップ

- **操作**: 既知の posting 配列 + `asOf` を encode → decode
- **期待**: `version === 1`、`asOf` 一致、各フィールド一致
- **期待**: `gram_type` は `0=name` / `1=kana`、`kind` は `0=pref` / `1=muni`

### TC-B02: レコードサイズ

- **期待**: posting レコード **13 bytes**（`u4+u1+u1+u4+u1+u1+u1`）
- **期待**: パディングなし
- **期待**: [`schema/local-government-code.ksy`](../schema/local-government-code.ksy) の `ngram_posting_record` と定数 `NGRAM_POSTING_RECORD_SIZE` が一致

### TC-B03: pref / muni 識別子の分離

- **前提**: 大阪府相当の posting（`kind=pref`）
- **期待**: `pref_code === 27` かつ `muni_code === 270008`（どちらも `27` に潰さない）

### TC-B04: string table の必須共有

- **前提**: 同一 `gram` 文字列が複数レコードで使われる入力
- **期待**: encode 後、当該 gram の `gram_offset` はすべて同一
- **期待**: string table 上の実体は 1 エントリ（NUL 終端 UTF-8）

### TC-B05: 決定的エンコード

- **操作**: 同一論理入力を 2 回 encode（入力順が異なっても、エンコーダがソートするならソート後同一）
- **期待**: 出力バイト列が完全一致
- **期待**: レコード並びは `gram` → `gramType` → `muniCode`（またはこれと同等の決定的順）

### TC-B06: record_count 上限

- **操作**: posting 数が `0xffff` を超える入力で encode
- **期待**: エラー（u2 超過）

### TC-B07: 不正 magic

- **操作**: 先頭 4 バイトを改変して decode
- **期待**: エラー（`JLIX` 期待と不一致）

### TC-B08: 非対応 version

- **操作**: `version !== 1` のバッファを decode
- **期待**: エラー

### TC-B09: バッファ不足

- **操作**: ヘッダ途中 / レコード途中 / string 途中で切ったバッファを decode
- **期待**: エラー

### TC-B10: 不正 string offset

- **操作**: offset が string table 外、または NUL 終端がバッファ末尾を超える値
- **期待**: エラー

### TC-B11: 末尾余剰バイト

- **操作**: 正当なペイロード末尾に余分なバイトを付与して decode
- **期待**: エラー（厳格）

### TC-B12: endian / ヘッダ順

- **期待**: little-endian。順序は TC-B 冒頭の共通レイアウトどおり
- **期待**: magic 文字列は `"JLIX"`

## 5. 生成・パッケージケース（TC-G）

実装先の目安: `npm run generate` 後の契約テスト、または scripts / data パッケージのスモーク

### TC-G01: 成果物パス

- **期待**: 存在すること
  - `packages/jp-local-gov-id-data/search-ngrams.csv`
  - `packages/jp-local-gov-id-data/search-ngrams.bin`
- **期待**: 既存の JLPR/JLDT 成果物（`prefectures.bin` 等）は引き続き存在し、#73 契約を壊さない

### TC-G02: `index.json` の paths

- **期待**: `schemaVersion === 1`（据え置き）
- **期待**: 既存 `paths.prefectures` / `paths.municipalitiesByPrefecture` は変更しない
- **期待**: `paths.searchNgrams === "search-ngrams.bin"`
- **期待**: `paths.searchNgrams` 欠落の index は API 側 `validateIndexFile` で **`LocalGovSchemaError`**（必須）

### TC-G03: CSV 列と粒度

- **ヘッダ**: `gram,gramType,kind,muniCode,prefCode,hasWard,isWard`
- **期待**: `(gram, gramType, muniCode)` で一意（重複行なし）
- **期待**: 行は決定的ソート（`gram` → `gramType` → `muniCode`）
- **期待**: `gramType` は `name` / `kana`、`kind` は `pref` / `muni`
- **期待**: 都道府県行の `muniCode` は 6 桁団体コード、`prefCode` は 2 桁（例: 大阪 `270008` / `27`）
- **期待**: 市区町村行の `hasWard` / `isWard` は県別 CSV と同じフラグ規則。県行はともに `0`

### TC-G04: 生成規則

- **操作**: 全都道府県・全市区町村の `name` / `nameKana` から posting を生成
- **期待**: 各フィールドは `normalizeSearchText` 後にコードポイント 2-gram 化
- **期待**: 正規化後長 `< 2` のフィールドからは gram を出さない
- **期待**: CSV データ行数 === JLIX `record_count`

### TC-G05: CSV と bin の対応

- **操作**: `search-ngrams.bin` を decode
- **期待**: 各レコードが CSV 行と 1:1 対応（ソート後順）
- **期待**: `asOf` は `prefectures.bin` と同じ生成世代

### TC-G06: npm 同梱範囲

- **期待**: `package.json` の `files` / `exports` に `search-ngrams.bin` がある
- **期待**: `search-ngrams.csv` は `files` / `exports` に **含まれない**（#73 の CSV 方針と同じ）

### TC-G07: dataset の生 JLIX

- **期待**: `@b4moss/jp-local-gov-id-data` の default export / named に `searchNgrams`（`Uint8Array`）がある
- **期待**: そのバイト列は `decodeSearchNgrams` でラウンドトリップ可能な JLIX である
- **期待**: Phase 1 時点ではクライアントが検索に使わなくても、型・export として存在すること

### TC-G08: 掃除

- **操作**: generate を再実行
- **期待**: 旧 `search-ngrams.csv` / `.bin` が掃除されたうえで再生成される（`cleanGeneratedArtifacts` 対象）

## 6. スキーマ・型ケース（TC-S）

実装先の目安: `packages/jp-local-gov-id/src/schema.ts` / `types.ts` / 既存 API テスト fixture

### TC-S01: index paths 必須化

- **操作**: `paths.searchNgrams` 無しの index で `validateIndexFile` / `createLocalGovClient`
- **期待**: `LocalGovSchemaError`

### TC-S02: 既存 fixture 更新

- **期待**: ユニットテスト内の最小 index fixture はすべて `searchNgrams` パスを持つ
- **期待**: 既存の公開 API テスト（検索はまだ線形）が Phase 1 でもグリーン

### TC-S03: LocalGovDataset

- **期待**: 型上 `searchNgrams?: ArrayBuffer | Uint8Array` を持てる
- **期待**: Phase 1 では未指定でも（検索未使用のため）クライアント作成は可能、ただし **生成 dataset は必ず含む**。url モードの index は paths 必須

> 補足: `paths.searchNgrams` 必須は「配信 index」契約。`{ data }` で手組み最小 fixture を使うテストは、index オブジェクトにパス文字列を足せばよい（生バイトは検索 Phase まで任意）。

## 7. Kaitai ケース（TC-K）

### TC-K01: JLIX 定義の存在

- **期待**: `schema/local-government-code.ksy` の `records` switch に `JLIX` → `ngram_posting_record` がある
- **期待**: `gram_type_enum` / `kind_enum` が Issue #63 の値と一致（name=0, kana=1, pref=0, muni=1）

### TC-K02: サイズ整合

- **期待**: ksy 上のレコードフィールド幅合計が 13 bytes
- **期待**: TC-B02 の定数と一致

## 8. 非対象の明示（回帰しないこと）

Phase 1 完了時点で、次を **変更しない / まだ満たさなくてよい**:

| ID | 内容 |
|----|------|
| OUT-01 | 全国 `searchByText` が未ロード県を 6 並列で取る現行挙動（索引未使用のまま） |
| OUT-02 | Brotli / `.br` 配信 |
| OUT-03 | JLIX の localStorage キャッシュ |
| OUT-04 | `matchField: "both"` の積集合アルゴリズム（クライアント Phase） |
| OUT-05 | クエリ 2 文字未満の空結果化（クライアント Phase。生成側は長 `< 2` のフィールドから gram を出さないことのみ） |

## 9. 合格基準

- TC-N / TC-B / TC-G / TC-S / TC-K の対象ケースが自動化または generate 後契約で確認できる
- `npm run generate` 成功後、`search-ngrams.csv` / `search-ngrams.bin` が存在し、decode 可能
- `@b4moss/jp-local-gov-id` の既存テストがグリーン（fixture 更新込み）
- npm `files` に CSV が混入していない
