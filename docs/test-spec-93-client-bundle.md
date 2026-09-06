# テスト仕様書: クライアント JS バンドル減量（#93）

対象マイルストーン: `v1.2.0`  
関連: Issue #93 / 作業ブランチ `cursor/issue-93-client-bundle-41e9` / 統合先 `dev-v1.2.0`  
前提: Issue #85（メッセージ JSONC 外だし）済み。[test-spec-85-messages-jsonc.md](./test-spec-85-messages-jsonc.md)  
想定実装:

- runtime 正本: `packages/jp-local-gov-id/src/messages.jsonc`
- encode 正本: `packages/jp-local-gov-id/src/messages.encode.jsonc`（新規）
- 生成物: `messages.generated.ts`（runtime）/ `messages.encode.generated.ts`（encode）
- コンパイル: `packages/jp-local-gov-id/scripts/compile-messages.mjs`（両カタログ対応）
- ランタイムヘルパ: `messages.ts`（runtime の `msg` / `fmt`）および encode 用ヘルパ（例: `messages.encode.ts`）
- 計測: `packages/jp-local-gov-id/scripts/measure-client-bundle.mjs`（新規）
- 計測手順ドキュメント: `docs/client-bundle-93.md`（新規）

## 1. 目的

`createLocalGovClient` 利用時にツリーシェイク後へ残るクライアント JS（minify 生サイズ）を削減する。主施策は **メッセージカタログの runtime / encode 分割**である。

- #85 の単一 `MESSAGES` により、encode / generate 専用キーまで create グラフへ載っていた問題を解消する
- **`brotli-wasm` は残す**（Chromium 系は `DecompressionStream` の `"brotli"` 形式が未対応のため）
- schema 検証は残す。パッケージ／入口の分割（`/search` 等）はこの Issue では行わない
- **minify 生 25KB 以下は目安であり、必達ゲートにしない**（測って記録する）

## 2. 用語

| 用語 | 意味 |
|------|------|
| create グラフ | `createLocalGovClient` をエントリとしたツリーシェイク後の依存モジュール集合 |
| minify 生サイズ | esbuild `platform: "browser"` + `minify: true` の出力バイト数（gzip 前） |
| runtime カタログ | create / decode / schema / search / cache / brotli が参照する文言正本 |
| encode カタログ | `encode*` および `scripts/generate.ts` のみが参照する文言正本 |
| 計測スクリプト | create グラフの minify 生サイズを出力する Node スクリプト |

対象の境界:

| 含む | 含まない |
|------|----------|
| `@b4moss/jp-local-gov-id` の create グラフ減量 | Node 専用容量最適化を主目的にすること |
| メッセージカタログ分割と compile 配線 | `brotli-wasm` の削除 |
| 計測スクリプトと手順ドキュメント | `/search` や codec へのパッケージ分割 |
| binary assert 共通化など軽い整理 | schema 検証の削除・デコード任せ化 |
| | サイト（`site/`）・多言語化 |

## 3. カタログ分割契約（TC-S）

実装先の目安: `messages*.test.ts`、`compile-messages.mjs` の検証、静的検査。

### TC-S01: 正本が二つに分かれる

- **期待**: runtime 正本 `messages.jsonc` と encode 正本 `messages.encode.jsonc` が存在する
- **期待**: 同一キーが両カタログに重複して定義されない
- **期待**: 両カタログとも #85 のキー命名・プレースホルダ契約（TC-M02 / TC-M03）を満たす

### TC-S02: encode 専用キーの帰属

少なくとも次のキー（現行 `messages.jsonc` 上の識別子）は **encode カタログのみ**に置く。

| キー | 主な発生元 |
|------|------------|
| `binary.jldt.encodeSizeMismatch` | `encodeMunicipalities` |
| `binary.jlpr.encodeSizeMismatch` | `encodePrefectures` |
| `binary.jlix.encodeSizeMismatch` | `encodeSearchNgrams` |
| `binary.asOfExceedsU1` | 各 `encode*` |
| `binary.recordCountExceedsU2` | 各 `encode*` |
| `binary.versionOutOfU1` | `encodeMunicipalities`（encode 経路のみなら） |
| `data.unknownPrefectureCode` | `scripts/generate.ts` → `dataset.js` |

- **期待**: 上記キーが runtime 生成モジュール（`messages.generated.ts`）に現れない
- **判定基準**: decode 経路から一度も呼ばれないキーのみ encode へ移す。decode と共有する `binary.fieldOutOfU1` / `binary.fieldOutOfU4` / `binary.fieldMustBe0Or1` / `binary.unsupportedVersion` / `binary.*.shortVersionAsOfLen` 等の short\* / string table 系は runtime に残す

### TC-S03: runtime キーの帰属

- **期待**: `schema.*` / `create.*` / `cache.*` / `brotli.*` / `search.*` および decode 経路の `binary.*` は runtime カタログにある
- **期待**: `create.unknownPrefectureDecode` のように create / decode 経路で使うキーは runtime に残す（`data.unknownPrefectureCode` と混同しない）
- **期待**: create グラフ上の `msg` / `fmt` 呼び出しが参照するキーは、すべて runtime カタログで解決できる

### TC-S04: import 境界

- **期待**: decode / schema / create / search / cache / brotli は runtime ヘルパ（`messages.ts` の `msg` / `fmt`）のみを import する
- **期待**: `encodePrefectures` / `encodeMunicipalities` / `encodeSearchNgrams` 内の throw は encode ヘルパを import する
- **期待**: runtime モジュールが encode 生成モジュール / encode ヘルパを import しない
- **推奨**: 自動テストまたは静的検査で「runtime → encode」逆依存がないことを検出する

### TC-S05: compile が両カタログを生成する

- **操作**: `compile-messages.mjs` を実行
- **期待**: `messages.generated.ts` と `messages.encode.generated.ts` が更新される
- **期待**: 各生成物のキー集合が、対応する正本と一致する
- **期待**: 不正 JSONC / 非 string 値 / 不正キー名では非 0 終了し、壊れた生成物を黙って出荷しない（#85 TC-C04 相当を両正本に適用）

### TC-S06: build / test が両 compile を先行する

- **期待**: `packages/jp-local-gov-id` の `build` / `test` が、本体の前に両カタログの compile を実行する
- **期待**: リポジトリには両正本と両生成物をコミットする

## 4. data / generate 連携ケース（TC-G）

### TC-G01: dataset の未知都道府県コードは encode カタログ由来

- **前提**: `data.unknownPrefectureCode` は encode カタログにある
- **操作**: `scripts/generate.ts` が encode カタログから文言を解決して `dataset.js` に埋め込む
- **期待**: 未知コードで `Error` となり、メッセージ意味は現行同等（部分一致 `/Unknown prefecture code/`）
- **期待**: generate が runtime カタログだけを読んで欠落エラーにならない

### TC-G02: decode.js は runtime のみを埋め込む

- **操作**: 既存の decode 再生成（generate）を実行
- **期待**: `packages/jp-local-gov-id-data/decode.js` に埋め込まれるメッセージは runtime キーのみ
- **期待**: encode 専用キー（`*.encodeSizeMismatch` / `data.unknownPrefectureCode` 等）が `decode.js` に現れない
- **期待**: decode 経路のエラー意味は現行と同等（既存 binary / data テスト）

### TC-G03: data パッケージに追加の正本を置かない

- **期待**: 文言正本は `jp-local-gov-id` 側の runtime / encode の二つだけ
- **期待**: `jp-local-gov-id-data` 配下に別の messages カタログを新設しない（#85 TC-D03 の延長）

## 5. バンドル計測ケース（TC-B）

実装先の目安: `scripts/measure-client-bundle.mjs`、`docs/client-bundle-93.md`。

### TC-B01: 計測エントリと条件

- **操作**: 計測スクリプトを実行
- **期待**: エントリは `createLocalGovClient`（`src/create.ts` 経由）。`src/index.ts` の全 export をエントリにしない
- **期待**: esbuild 条件は少なくとも次を満たす:
  - `bundle: true`
  - `platform: "browser"`
  - `format: "esm"`
  - `minify: true`
  - `external: ["brotli-wasm", "node:zlib"]`（または同等）
- **期待**: 標準出力（または成果ファイル）に minify 生バイト数が含まれる
- **推奨**: 参考値として gzip 後サイズも出してよい

### TC-B02: npm script から実行できる

- **期待**: `packages/jp-local-gov-id` に `measure:client-bundle`（名称同等可）がある
- **期待**: 依存不足やエントリ解決失敗時は非 0 終了し、理由が分かる

### TC-B03: 分割後に encode 専用キーが create グラフへ載らない

- **前提**: カタログ分割後
- **操作**: 計測（または同等の esbuild metafile / 出力検査）
- **期待**: 出力 JS に encode 専用メッセージ文字列（例: `Internal encode size mismatch (JLDT)` / `(JLPR)` / `(JLIX)`、`Unknown prefecture code`）が含まれない
- **期待**: runtime で必要な代表文言（schema / create / decode の short\* 等）は、該当経路がバンドルに含まれる場合に解決できる

### TC-B04: 計測結果をドキュメントに残す

- **期待**: `docs/client-bundle-93.md`（または同等）に次を記録する:
  - 測定コマンド
  - 測定条件（エントリ・platform・minify・external）
  - 分割前（可能なら）と分割後の minify 生サイズ
  - 測定日 / コミットまたはブランチ
- **期待**: 25KB 未満かどうかは記載してよいが、未達でも本 Issue の失敗条件にはしない

### TC-B05: 計測スクリプトはサイズ未達で fail しない

- **操作**: create グラフが 25KB を超える状態で計測スクリプトを実行
- **期待**: サイズ超過のみを理由に非 0 終了しない（レポート用途）

## 6. Brotli / 互換ケース（TC-Z）

### TC-Z01: brotli-wasm フォールバックを残す

- **期待**: ブラウザ経路で `DecompressionStream("brotli")`（および実装が試す `"br"`）が使えない場合、`brotli-wasm` へフォールバックする実装が残る
- **期待**: `brotli-wasm` が `package.json` 依存およびビルド external から意図せず消えない
- **実装先**: `brotli.test.ts` の既存フォールバックケースを維持

### TC-Z02: 現代ブラウザ / Node 経路

- **期待**: `DecompressionStream` 利用時に `.bin.br` が従来どおり展開できる
- **期待**: Node では `node:zlib` 経路が従来どおり動く（Node 容量削減を目的化しない）

### TC-Z03: ドキュメントの前提

- **期待**: installation / README で、Brotli 展開が `DecompressionStream` または `brotli-wasm`（および Node zlib）に依存することが分かる
- **期待**: wasm 削除を前提にした「DS のみ」記述へ誤って置き換えない

## 7. 回帰・公開 API ケース（TC-R）

既存テストを主たる受け入れとする。

### TC-R01: 公開 API・schema 検証

- **期待**: 既存の公開 API テストがパスする
- **期待**: schema 検証を削除・迂回しない（デコード成功だけに任せない）
- **期待**: 例外クラス（`LocalGovSchemaError` / `LocalGovBinaryError` 等）を意図せず変えない

### TC-R02: encode API のメッセージ

- **期待**: `encodePrefectures` / `encodeMunicipalities` / `encodeSearchNgrams` の既存エラーケースがパスする
- **期待**: メッセージは encode カタログ由来でも、意味・部分一致期待を維持する

### TC-R03: create / fetch / cache / search / binary decode

- **期待**: #85 以降の既存回帰（create / cache / brotli / search / binary decode）がパスする
- **期待**: 文言を短縮する場合も、既存テストの部分一致 regex を更新したうえで意味を保つ

### TC-R04: 公開 exports にメッセージを載せない

- **期待**: runtime / encode いずれのカタログも `msg` / `fmt` も、パッケージ公開 `exports` / `src/index.ts` から出さない（#85 TC-C05 の延長）

## 8. 付随整理ケース（TC-L）— 実施する場合

分割後の任意作業。実施するなら次を満たす。

### TC-L01: binary assert 共通化

- **期待**: `prefectures.ts` / `municipalities.ts` / `searchNgrams.ts` に三重定義されていた assert 系ヘルパを共有モジュールへ寄せても、binary テストがパスする
- **期待**: エラー意味（ラベル・範囲・trailing bytes）を壊さない

### TC-L02: minify 向けの軽い寄せ

- **期待**: encode 専用のモジュールローカル（例: magic 定数・encoder）を decode グラフから外す変更を入れた場合、decode / create テストがパスする
- **期待**: 公開 encode API の行為は維持する

## 9. 非対象（明示）

次は本仕様書のテストケースに含めない。

- `brotli-wasm` の削除、および DS のみ前提への切り替え
- `/search` や codec 入口への分割による減量（必要ならフォローアップ Issue）
- Node 向けバンドルサイズの最適化を主目的にした変更
- schema 検証の削除
- 25KB 必達を CI ゲート化すること
- サイト（`site/`）のバンドルサイズ
- メッセージの多言語化・エラーコード（数値 / symbol）化

## 10. 受け入れ条件

1. TC-S01〜S06 を満たし、runtime / encode カタログが分離されている
2. TC-G01〜G03 を満たし、`dataset.js` / `decode.js` が正しいカタログに追従する
3. TC-B01〜B05 を満たし、計測手段と比較結果が docs に残っている
4. TC-Z01〜Z03 を満たし、`brotli-wasm` フォールバックが維持されている
5. TC-R01〜R04 の回帰・公開 API 制約を満たす
6. minify 生 25KB 以下は望ましいが、**未達でも 1〜5 を満たせば本 Issue は受け入れ可**とする
7. TC-L を実施した場合は、対応ケースもパスする

## 11. #85 仕様との関係

- 本 Issue は #85 の単一カタログ前提を、**双カタログ**へ拡張する
- #85 の TC-M / TC-C / TC-H / TC-R / TC-D の意図（意味維持・公開 API 非公開・直書き禁止）は維持する
- 実装時は [test-spec-85-messages-jsonc.md](./test-spec-85-messages-jsonc.md) に「正本が runtime / encode の二つ」である旨を追記してよい（本仕様が詳細の正とする）
