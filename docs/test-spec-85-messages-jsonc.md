# テスト仕様書: エラー・警告メッセージの JSONC 外だし（#85）

対象マイルストーン: `v1.1.0`  
関連: Issue #85 / 作業ブランチ `cursor/issue-85-error-messages-jsonc-7a0c` / 統合先 `dev-v1.1.0`  
想定実装:

- 正本: `packages/jp-local-gov-id/src/messages.jsonc`
- 生成物: `packages/jp-local-gov-id/src/messages.generated.ts`
- コンパイル: `packages/jp-local-gov-id/scripts/compile-messages.mjs`
- 参照ヘルパ: `msg(key)` / `fmt(key, params)`（生成物同梱、または薄い `messages.ts`）

## 1. 目的

ライブラリ内に直書きされているエラー・警告文言を **JSONC カタログへ一元化し**、実行時の例外クラス・メッセージ意味・公開 API を壊さないことを固定する。

- 管理形式は **JSONC**（コメント可）
- **多言語対応は不要**（単一ロケール。現行どおり英語文言）
- 文言の意味・英語表現は **現行と同等**（既存テストの部分一致 regex を維持できること）
- メッセージカタログは **公開 API に含めない**（`src/index.ts` から re-export しない）
- Vite / TypeScript は JSONC を直接読めないため、ビルド・テスト前に TS モジュールへコンパイルする

## 2. 用語

| 用語 | 意味 |
|------|------|
| カタログ正本 | `messages.jsonc`。コメント付き。人が編集する唯一の文言ソース |
| 生成モジュール | `messages.generated.ts`。正本から機械生成。ランタイムが import する |
| メッセージキー | ドット区切り識別子（例: `schema.index.pathsObject`） |
| テンプレート | `{name}` 形式のプレースホルダを含む文字列 |
| `msg(key)` | 静的文言を返す。未知キーは失敗（例外） |
| `fmt(key, params)` | テンプレートへ `params` を埋め込む。未知キー / 必須プレースホルダ欠落は失敗 |
| 呼び出し置換 | throw / `console.warn` 箇所の直書きリテラルを `msg` / `fmt` 参照へ置き換えること |

対象パッケージの境界:

| 含む | 含まない |
|------|----------|
| `@b4moss/jp-local-gov-id` の src 内 throw / warn | `site/` の文言・i18n |
| `src/binary/*`（→ `jp-local-gov-id-data/decode.js` へ波及） | ドキュメント本文 |
| `scripts/generate.ts` が埋め込む `dataset.js` の `Unknown prefecture code` 1 件 | テスト専用のフィクスチャ throw |
| | generate CLI 自体の操作エラー（上記 1 件以外） |

## 3. カタログ契約（TC-M）

実装先の目安: `messages*.test.ts`、または compile スクリプトのユニットテスト。

### TC-M01: JSONC がパースできる

- **前提**: `messages.jsonc` が存在する
- **操作**: コメント除去後に JSON として parse
- **期待**: トップレベルはオブジェクト（配列・プリミティブではない）
- **期待**: 各値は非空の string

### TC-M02: キー命名

- **期待**: キーは `/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/`（少なくとも 1 つのドット区切り）
- **期待**: 名前空間の目安:
  - `schema.*`
  - `create.*` / `cache.*` / `brotli.*`
  - `search.*`
  - `binary.*`
  - `data.*`（data 生成テンプレ用）

### TC-M03: プレースホルダ形式

- **期待**: 補間は `{identifier}` のみ（identifier は `/^[a-zA-Z_][a-zA-Z0-9_]*$/`）
- **期待**: 現行の意味を保つ（例: `Unsupported version: {version}`）
- **期待**: リテラルの `{` / `}` を文言に含める必要が出た場合は本仕様を改訂してから実装する（現状の英語文言に該当なし）

### TC-M04: 必須キー集合（現行呼び出しをカバー）

少なくとも次のカテゴリの現行リテラルが、キーとしてカタログに存在する。

| カテゴリ | 代表（現行文言の部分一致でよい） | 主な発生元 |
|----------|----------------------------------|------------|
| schema | `schemaVersion must be a number` / `Unsupported schemaVersion` / `paths object` / `searchNgrams` | `schema.ts` |
| create | `data` / `url` / `Failed to fetch` / `Failed to parse` / `cacheTtlSeconds` | `create.ts` |
| cache | `cacheTtlSeconds` | `cache.ts` |
| brotli | `DecompressionStream` / `brotli-wasm` | `brotli.ts` |
| search | `JLIX asOf` / `2-gram` / `3-gram` / `n must be a positive integer` | `searchIndex*.ts` / `searchNgrams.ts` |
| binary | `Unsupported version` / `buffer too short` / `out of u` / `Internal encode size mismatch` | `src/binary/*` |
| data | `Unknown prefecture code` | `generate.ts` → `dataset.js` |

- **期待**: ライブラリ src に残るユーザー向け throw/warn リテラルが、カタログ未登録の直書き英語として残っていない（ヘルパ経由のみ）
- **期待**: 例外クラス名（`LocalGovSchemaError` 等）や制御フローは変更しない

### TC-M05: コメント

- **期待**: JSONC に、主要キーまたは名前空間単位で「どの例外 / どの状況か」を示すコメントを付けてよい
- **期待**: コメント除去後の JSON にコメント文字列が残らない

## 4. コンパイル／配線ケース（TC-C）

### TC-C01: 生成モジュールの出力

- **操作**: `compile-messages.mjs` を実行
- **期待**: `messages.generated.ts` が更新される
- **期待**: カタログ全キーが生成モジュールから参照可能（Record / const オブジェクト）
- **期待**: TypeScript として import 可能（Vite / Vitest 追加プラグイン不要）

### TC-C02: build / test の先頭で compile する

- **期待**: `packages/jp-local-gov-id` の `build` / `test` スクリプトが、本体の前に compile を実行する
- **期待**: 正本だけ更新して test を走らせると、生成物が追従する（または追従失敗時に明示エラー）

### TC-C03: 正本と生成物の同期

- **前提**: `messages.jsonc` を意図的に変更（キー追加または文言変更）
- **操作**: compile 実行
- **期待**: 生成モジュールの内容が正本と一致する
- **期待**: リポジトリには正本と生成物の両方をコミットする（IDE / CI が prep なしで参照できること）

### TC-C04: 不正 JSONC で失敗する

- **前提**: 構文エラー、または値が string でないエントリ
- **操作**: compile 実行
- **期待**: 非 0 終了。壊れた `messages.generated.ts` を黙って出荷しない

### TC-C05: 公開 exports にメッセージを載せない

- **期待**: `package.json` の `exports` および `src/index.ts` がメッセージカタログ / `msg` / `fmt` を公開しない
- **期待**: 既存の公開シンボル一覧を意図せず増やさない

## 5. ランタイムヘルパケース（TC-H）

実装先の目安: `messages.test.ts`（パッケージ内 Vitest）

### TC-H01: `msg` が静的文言を返す

- **操作**: プレースホルダなしキーで `msg(key)`
- **期待**: カタログの文字列と完全一致

### TC-H02: `fmt` がプレースホルダを置換する

- **前提**: 例として `Unsupported version: {version}`
- **操作**: `fmt(key, { version: 9 })`
- **期待**: `"Unsupported version: 9"`
- **期待**: 未使用の params があってもよい（無視してよい）

### TC-H03: 未知キーは失敗する

- **操作**: 存在しないキーで `msg` / `fmt`
- **期待**: 例外（`Error` 系）。`undefined` を返して握りつぶさない

### TC-H04: 必須プレースホルダ欠落は失敗する

- **前提**: テンプレートに `{version}` がある
- **操作**: `fmt(key, {})`
- **期待**: 例外。`{version}` が文言に残ったまま返らない

### TC-H05: 値の文字列化

- **操作**: `fmt` に number / boolean を渡す
- **期待**: 現行テンプレートリテラルと同等の文字列化（`String(value)` 相当）
- **期待**: `null` / `undefined` を渡した場合の扱いは実装で例外にする（黙って `"null"` 化しないことを推奨し、テストで固定する）

## 6. 呼び出し置換・回帰ケース（TC-R）

既存テストを主とし、文言外だし後も通ることを受け入れとする。新規で代表ケースを足してもよい。

### TC-R01: schema 検証メッセージ

- **実装先**: `schema.test.ts`
- **期待**: 無効 index / prefectures / municipalities / dataset で `LocalGovSchemaError`
- **期待**: 現行と同様の部分一致（例: `/schemaVersion must be a number/`、`/Unsupported schemaVersion/`、`/\{region\}/` 等）

### TC-R02: create / fetch / cache / brotli

- **実装先**: `create.test.ts` / `api.test.ts` / `cache.test.ts` / `brotli.test.ts`
- **期待**: `TypeError` / `LocalGovSchemaError` / fetch 失敗メッセージの部分一致が維持される
- **期待**: `data` と `url` の排他・必須チェック文言が維持される

### TC-R03: search / JLIX

- **実装先**: `searchIndexLoader.test.ts` / `searchIndex.test.ts` / `searchNgrams*.test.ts`
- **期待**: 欠落 2-gram / 3-gram / 不正 path で `LocalGovSchemaError`
- **期待**: asOf 不一致時に `console.warn` が呼ばれる（メッセージはカタログ由来。部分一致または spy 引数検証）

### TC-R04: binary codec

- **実装先**: `binary/*.test.ts`
- **期待**: `LocalGovBinaryError` の代表パターン（unsupported version、buffer too short、range、trailing bytes 等）が維持される
- **期待**: `jp-local-gov-id-data/decode.js` 再生成後も、decode 経路のエラー意味が同等

### TC-R05: src に直書きユーザー文言が残らない

- **操作**: `packages/jp-local-gov-id/src/**/*.ts` を検査（`*.test.ts` と `messages*.ts` / 生成物を除く）
- **期待**: `throw new …("…")` / `console.warn("…")` のユーザー向け英語リテラルが、カタログ未経由で残っていない
- **許容**: テストファイル内の期待文字列、コメント、非ユーザー向け内部断言

検査の実装手段は次のいずれかでよい（仕様として結果を固定する）:

- 静的 grep ベースのテスト
- レビューチェックリスト + 代表ファイルの目視（その場合は PR 説明に明記）

本仕様では **自動テストでの検出を推奨**する。

## 7. data パッケージ連携ケース（TC-D）

### TC-D01: dataset の未知都道府県コード

- **前提**: カタログに `data.unknownPrefectureCode`（または同等キー）があり、テンプレートは現行意味（`Unknown prefecture code: {code}`）
- **操作**: `scripts/generate.ts` の `writeDatasetJs` がカタログから文言を解決して `dataset.js` に埋め込む
- **期待**: 生成された `dataset.js` が未知コードで `Error` を reject し、メッセージが現行部分一致 `/Unknown prefecture code/` を満たす

### TC-D02: decode.js は binary ソースに追従

- **操作**: binary メッセージをカタログ経由にしたうえで `emitDecodeJs`（既存 generate）を実行
- **期待**: `packages/jp-local-gov-id-data/decode.js` に、直書き旧リテラルの二重管理が残らない（バンドル結果が lib binary と一致）

### TC-D03: data パッケージに第 2 カタログを置かない

- **期待**: `messages.jsonc` の正本は `jp-local-gov-id` 側のみ
- **期待**: `jp-local-gov-id-data` 配下に別の messages カタログを新設しない

## 8. 非対象（明示）

次は本仕様書のテストケースに含めない。

- サイト（`site/`）の警告・i18n・Playground エラー表示
- ドキュメントサイト文言、README の文言統一
- メッセージの多言語化・ロケール切替 API
- バンドルサイズ目標（Issue #93 / v1.2.0）
- 例外クラスの統合・エラーコード（数値 / symbol）化
- 文言の日本語化やトーン変更（現行英語の意味維持が前提）

## 9. 受け入れ条件

1. TC-M01〜M05、TC-C01〜C05、TC-H01〜H05 を自動テスト（または compile 検証 + ヘルパテスト）でカバーする
2. TC-R01〜R04 の既存回帰がパスする（文言意味の破壊なし）
3. TC-R05 により、対象 src からの直書きユーザー文言が排除されている（推奨: 自動検出）
4. TC-D01〜D03 を満たし、data 生成物が単一カタログに追従する
5. メッセージカタログがパッケージの公開 `exports` / `index.ts` に現れない
6. 多言語機構を追加しない
