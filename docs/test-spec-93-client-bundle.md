# テスト仕様書: クライアント JS バンドル減量（#93）

対象マイルストーン: `v1.2.0`  
関連: Issue #93 / [≤25KB follow-up 計画](./plan-93-followup-25kb.md) / [計測ログ](./client-bundle-93.md)  
作業ブランチ（follow-up）: `cursor/issue-93-client-25kb-12a3` / 統合先 `dev-v1.2.0`  
前提: Issue #85（メッセージ JSONC 外だし）済み。[test-spec-85-messages-jsonc.md](./test-spec-85-messages-jsonc.md)  
想定実装:

- runtime 正本: `packages/jp-local-gov-id/src/messages.jsonc`
- encode 正本: `packages/jp-local-gov-id/src/messages.encode.jsonc`
- search 正本（follow-up）: `packages/jp-local-gov-id/src/messages.search.jsonc`
- 生成物: `messages.generated.ts` / `messages.encode.generated.ts` / `messages.search.generated.ts`（follow-up）
- コンパイル: `packages/jp-local-gov-id/scripts/compile-messages.mjs`
- ランタイムヘルパ: `messages.ts`（および encode / search 用ヘルパ）
- 計測: `packages/jp-local-gov-id/scripts/measure-client-bundle.mjs`
- 計測手順ドキュメント: `docs/client-bundle-93.md`

本仕様は二段構えである。

| 段 | 範囲 | 25KB の扱い |
|------|------|-------------|
| **A. #93 本体**（§1〜§11、PR #128） | runtime / encode カタログ分割・計測基盤 | 目安。未達でも本体は受け入れ可 |
| **B. follow-up**（§12〜、本ブランチ） | 初期チャンク ≤25600（Search / cachian 遅延など） | **完了条件**（CI の fail ゲート化はしない） |

---

# A. #93 本体（PR #128）

## 1. 目的

`createLocalGovClient` 利用時にツリーシェイク後へ残るクライアント JS（minify 生サイズ）を削減する。本体の主施策は **メッセージカタログの runtime / encode 分割**である。

- #85 の単一 `MESSAGES` により、encode / generate 専用キーまで create グラフへ載っていた問題を解消する
- **`brotli-wasm` は残す**（Chromium 系は `DecompressionStream` の `"brotli"` 形式が未対応のため）
- schema 検証は残す
- パッケージ公開入口の分割（`exports["./search"]` 等）は行わない（follow-up の動的 import によるチャンク分離とは別）
- **本体時点では minify 生 25KB 以下は目安**（測って記録する）。必達は §12 の follow-up 完了条件とする

## 2. 用語

| 用語 | 意味 |
|------|------|
| create グラフ | `createLocalGovClient` をエントリとしたツリーシェイク後の依存モジュール集合 |
| minify 生サイズ | esbuild `platform: "browser"` + `minify: true` の出力バイト数（gzip 前） |
| runtime カタログ | create / decode / schema / cache / brotli、および（本体時点の）search が参照する文言正本 |
| encode カタログ | `encode*` および generate のみが参照する文言正本 |
| 計測スクリプト | create グラフの minify 生サイズを出力する Node スクリプト |

対象の境界（本体）:

| 含む | 含まない |
|------|----------|
| `@b4moss/jp-local-gov-id` の create グラフ減量 | Node 専用容量最適化を主目的にすること |
| メッセージカタログ分割と compile 配線 | `brotli-wasm` の削除 |
| 計測スクリプトと手順ドキュメント | 公開 `exports` への `/search` パッケージ分割 |
| binary assert 共通化など軽い整理 | schema 検証の削除・デコード任せ化 |
| | サイト（`site/`）・多言語化 |

## 3. カタログ分割契約（TC-S）

実装先の目安: `messages*.test.ts`、`compile-messages.mjs` の検証、静的検査。

### TC-S01: 正本が二つに分かれる

- **期待**: runtime 正本 `messages.jsonc` と encode 正本 `messages.encode.jsonc` が存在する
- **期待**: 同一キーが両カタログに重複して定義されない
- **期待**: 両カタログとも #85 のキー命名・プレースホルダ契約を満たす

> follow-up（§12）で search 正本を追加したあとは「正本が三つ」になる。重複禁止は全正本間に拡張する（TC-F-S01）。

### TC-S02: encode 専用キーの帰属

少なくとも次のキー（現行識別子）は **encode カタログのみ**に置く。

| キー | 主な発生元 |
|------|------------|
| `binary.jldt.encodeSizeMismatch` | `encodeMunicipalities` |
| `binary.jlpr.encodeSizeMismatch` | `encodePrefectures` |
| `binary.jlix.encodeSizeMismatch` | `encodeSearchNgrams` |
| encode 専用の範囲・バージョン系 | 各 `encode*` |
| generate 専用の data 系 | generate / dataset 埋め込み |

- **期待**: 上記キーが runtime 生成モジュール（`messages.generated.ts`）に現れない
- **判定基準**: decode 経路から一度も呼ばれないキーのみ encode へ移す。decode と共有する short\* / string table 系は runtime に残す

### TC-S03: runtime キーの帰属

- **期待（本体）**: `schema.*` / `create.*` / `cache.*` / `brotli.*` / `search.*` および decode 経路の `binary.*` は runtime カタログにある
- **期待**: create / decode 経路で使うキーは runtime に残す
- **期待**: create グラフ上の `msg` / `fmt` 呼び出しが参照するキーは、すべて runtime カタログで解決できる

> **follow-up 改訂（TC-F-S02）:** Phase B 以降、`search.*` および検索時専用の create キー（例: `create.missingSearchNgramShards`）は **search カタログ**へ移してよい。その場合、初期チャンク（core）の `msg` / `fmt` は core カタログのみで解決できればよい。

### TC-S04: import 境界

- **期待**: decode / schema / create / search / cache / brotli は、それぞれが属するカタログのヘルパのみを import する
- **期待**: `encode*` 内の throw は encode ヘルパを import する
- **期待**: runtime（core）モジュールが encode 生成モジュール / encode ヘルパを import しない
- **推奨**: 自動テストまたは静的検査で「core → encode」逆依存がないことを検出する

### TC-S05: compile がカタログを生成する

- **操作**: `compile-messages.mjs` を実行
- **期待**: 各正本に対応する `*.generated.ts` が更新される
- **期待**: 各生成物のキー集合が、対応する正本と一致する
- **期待**: 不正 JSONC / 非 string 値 / 不正キー名では非 0 終了し、壊れた生成物を黙って出荷しない

### TC-S06: build / test が compile を先行する

- **期待**: `packages/jp-local-gov-id` の `build` / `test` が、本体の前にカタログ compile を実行する
- **期待**: リポジトリには正本と生成物をコミットする

## 4. data / generate 連携ケース（TC-G）

### TC-G01: dataset の未知都道府県コードは encode カタログ由来

- **操作**: generate が encode カタログから文言を解決して埋め込む
- **期待**: 未知コードで `Error` となり、メッセージ意味は現行同等
- **期待**: generate が runtime カタログだけを読んで欠落エラーにならない

### TC-G02: decode.js は runtime のみを埋め込む

- **期待**: data パッケージの decode 埋め込みメッセージは runtime（core）キーのみ
- **期待**: encode 専用キーが decode 成果物に現れない
- **期待**: decode 経路のエラー意味は現行と同等

### TC-G03: data パッケージに追加の正本を置かない

- **期待**: 文言正本は `jp-local-gov-id` 側に置く
- **期待**: `jp-local-gov-id-data` 配下に別の messages カタログを新設しない

## 5. バンドル計測ケース（TC-B）

実装先の目安: `scripts/measure-client-bundle.mjs`、`docs/client-bundle-93.md`。

### TC-B01: 計測エントリと条件

- **操作**: `npm run measure:client-bundle -w @b4moss/jp-local-gov-id`
- **期待**: エントリは `createLocalGovClient`（`src/create.ts` を named export 経由）。`src/index.ts` の全 export をエントリにしない
- **期待**: esbuild 条件は少なくとも次を満たす:
  - `bundle: true`
  - `platform: "browser"`
  - `format: "esm"`
  - `minify: true`
  - `external: ["brotli-wasm", "node:zlib"]`（または同等）
- **期待**: 標準出力に minify 生バイト数が含まれる
- **推奨**: 参考値として gzip 後サイズも出してよい

### TC-B02: npm script から実行できる

- **期待**: `packages/jp-local-gov-id` に `measure:client-bundle` がある
- **期待**: 依存不足やエントリ解決失敗時は非 0 終了し、理由が分かる

### TC-B03: 分割後に encode 専用キーが create グラフへ載らない

- **前提**: カタログ分割後
- **操作**: 計測（または同等の esbuild metafile / 出力検査）
- **期待**: 出力 JS に encode 専用メッセージ文字列が含まれない
- **期待**: runtime で必要な代表文言は、該当経路がバンドルに含まれる場合に解決できる

### TC-B04: 計測結果をドキュメントに残す

- **期待**: `docs/client-bundle-93.md` に次を記録する:
  - 測定コマンド
  - 測定条件（エントリ・platform・minify・external）
  - 時点ごとの minify 生サイズ
  - 測定日 / コミットまたはブランチ
- **期待（本体）**: 25KB 未満かどうかは記載してよいが、未達でも #93 本体の失敗条件にはしない

### TC-B05: 計測スクリプトはサイズ未達で fail しない

- **操作**: create グラフが 25KB を超える状態で計測スクリプトを実行
- **期待**: サイズ超過のみを理由に非 0 終了しない（レポート用途）。follow-up 完了判定は人間 / PR チェックリストで行う

## 6. Brotli / 互換ケース（TC-Z）

### TC-Z01: brotli-wasm フォールバックを残す

- **期待**: ブラウザ経路で `DecompressionStream("brotli")`（および実装が試す同等形式）が使えない場合、`brotli-wasm` へフォールバックする実装が残る
- **期待**: `brotli-wasm` が `package.json` 依存およびビルド external から意図せず消えない

### TC-Z02: 現代ブラウザ / Node 経路

- **期待**: `DecompressionStream` 利用時に `.bin.br` が従来どおり展開できる
- **期待**: Node では `node:zlib` 経路が従来どおり動く

### TC-Z03: ドキュメントの前提

- **期待**: installation / README で、Brotli 展開が `DecompressionStream` または `brotli-wasm`（および Node zlib）に依存することが分かる
- **期待**: wasm 削除を前提にした「DS のみ」記述へ誤って置き換えない

## 7. 回帰・公開 API ケース（TC-R）

### TC-R01: 公開 API・schema 検証

- **期待**: 既存の公開 API テストがパスする
- **期待**: schema 検証を削除・迂回しない
- **期待**: 例外クラスを意図せず変えない

### TC-R02: encode API のメッセージ

- **期待**: `encode*` の既存エラーケースがパスする
- **期待**: メッセージは encode カタログ由来でも、意味・部分一致期待を維持する

### TC-R03: create / fetch / cache / search / binary decode

- **期待**: #85 以降の既存回帰（create / cache / brotli / search / binary decode）がパスする
- **期待**: 文言を短縮する場合も、既存テストの部分一致 regex を更新したうえで意味を保つ

### TC-R04: 公開 exports にメッセージを載せない

- **期待**: カタログも `msg` / `fmt` も、パッケージ公開 `exports` / `src/index.ts` から出さない

## 8. 付随整理ケース（TC-L）— 実施する場合

### TC-L01: binary assert 共通化

- **期待**: 三重定義されていた assert 系ヘルパを共有モジュールへ寄せても、binary テストがパスする
- **期待**: エラー意味を壊さない

### TC-L02: minify 向けの軽い寄せ

- **期待**: encode 専用モジュールを decode / create グラフから外す変更を入れた場合、decode / create テストがパスする
- **期待**: 公開 encode API の行為は維持する

## 9. 非対象（#93 本体および follow-up 共通）

次はテストケースに含めない / 採用しない。

- `brotli-wasm` の削除、および DS のみ前提への切り替え
- Brotli 経路の間引きを **バンドルサイズ目的**で行うこと
- 公開 `package.json` exports への `/search` や codec 入口追加による減量
- Node 向けバンドルサイズの最適化を主目的にした変更
- schema 検証の削除
- **25KB 必達を CI で fail させるゲート化**（完了条件としての判定は PR / チェックリストで行う）
- サイト（`site/`）のバンドルサイズ
- メッセージの多言語化・エラーコード（数値 / symbol）化

> 公開入口の分割は非対象だが、**アプリ側 Vite/esbuild がツリーシェイクしやすいよう、実装内部の動的 `import()` によるチャンク分離は follow-up の対象**である。

## 10. 受け入れ条件（#93 本体）

1. TC-S01〜S06 を満たし、runtime / encode カタログが分離されている
2. TC-G01〜G03 を満たす
3. TC-B01〜B05 を満たし、計測手段と比較結果が docs に残っている
4. TC-Z01〜Z03 を満たし、`brotli-wasm` フォールバックが維持されている
5. TC-R01〜R04 の回帰・公開 API 制約を満たす
6. minify 生 25KB 以下は望ましいが、**未達でも 1〜5 を満たせば #93 本体は受け入れ可**とする（必達は §12）
7. TC-L を実施した場合は、対応ケースもパスする

## 11. #85 仕様との関係

- 本 Issue は #85 の単一カタログ前提を、**双カタログ**（follow-up では search を含め最大三カタログ）へ拡張する
- #85 の意図（意味維持・公開 API 非公開・直書き禁止）は維持する

---

# B. follow-up: createLocalGovClient 初期チャンク ≤25KB

関連計画: [plan-93-followup-25kb.md](./plan-93-followup-25kb.md)  
作業ブランチ: `cursor/issue-93-client-25kb-12a3`

## 12. follow-up の目的と指標

### 12.1 目的

消費側（Vite / esbuild 等）が `createLocalGovClient` だけを取り込んだときの **初期チャンク** minify 生を **≤ 25600** にする。CDN 向けフル IIFE（`iife.min.js`）の削減は本 follow-up の主指標ではない。

### 12.2 用語（follow-up 追加）

| 用語 | 意味 |
|------|------|
| 初期チャンク | 計測エントリ（named export `createLocalGovClient`）を esbuild したとき、動的 `import()` 先を除いた主出力の minify 生バイト数 |
| search チャンク | `searchByText` / `getLocalGovCodeByName` 等の初回実行で載る動的 import 先（参考値） |
| cache チャンク | URL + cache 経路で載る `@b4moss/cachian` / `cache` 実装の動的 import 先（参考値） |
| core カタログ | 初期チャンクが参照する runtime 文言（`messages.jsonc`） |
| search カタログ | search チャンクのみが参照する文言（`messages.search.jsonc`） |

### 12.3 測定条件（固定）

TC-B01 に加え、follow-up では次を満たす。

| 項目 | 値 |
|------|------|
| 主指標 | **初期チャンク** minify 生 |
| 参考指標 | search チャンク / cache チャンクの minify 生、および初期チャンク gzip |
| metafile | Phase 0 以降、上位モジュール（bytesInOutput）を出せること |
| external | `brotli-wasm`, `node:zlib`（変更しない） |

### 12.4 ベースラインとゲート

| 時点 | 初期チャンク minify 生 | 備考 |
|------|----------------------:|------|
| #128 直後 | 30767 | cachian 前 |
| follow-up 起点（dev-v1.1.0 取り込み後） | **35428** | `@b4moss/cachian` 込み |
| 中間ゲート（Phase A+B 後） | **≤ 27000** | PR1 |
| 最終ゲート（Phase C–E 後） | **≤ 25600** | PR2 / follow-up 完了 |

未達の場合は残ギャップと次候補を PR に残し、推測だけで閉じない。

## 13. チャンク分離ケース（TC-F）

### TC-F01: 初期チャンクに search 実装が載らない

- **前提**: Phase A1 以降
- **操作**: search を呼ばない `createLocalGovClient` の初期チャンクを metafile / 計測で検査
- **期待**: 少なくとも次が初期チャンクに実質含まれない（stub / 動的 import 文字列のみは可）
  - `searchIndexLoader`
  - `searchIndex`（クエリ実装）
  - `binary` 配下の JLIX / search-ngrams **decode 実装が search 専用として分離された部分**
- **期待**: 都道府県・市区町村の通常 lookup / list は静的経路のまま動作する

### TC-F02: 初期チャンクに cachian が載らない

- **前提**: Phase A2 以降
- **操作**: 初期チャンクを metafile / 出力検査
- **期待**: `@b4moss/cachian` およびその drivers/methods が初期チャンクに含まれない
- **期待**: URL + cache 有効経路では、初回の cache 読み書きまたは `purgeCache` 実行時に cache チャンクが載り、既存 cache / purge テストがパスする
- **期待**: dataset モード（URL なし）の create が cache 実装なしで完了できる

### TC-F03: 公開 API 契約は維持

- **期待**: `LocalGovClient.searchByText(...): Promise<...>` および `getLocalGovCodeByName(...): Promise<...>` のシグネチャを壊さない
- **期待**: `purgeCache` の公開シグネチャを壊さない
- **期待**: dataset で search ngram shards 欠落時、**create 時点では投げず**、検索実行時に既存どおりエラーになる（キー例: `create.missingSearchNgramShards`）
- **期待**: 都道府県スコープ検索など、JLIX を使わない経路の意味を維持する

### TC-F04: lazy 後の search 互換

- **操作**: 既存 search 回帰（ヒット順・件数・asOf 不一致など）
- **期待**: 動的 import 導入後もパスする
- **期待**: 初回 `searchByText` で search チャンク読み込み後、2 回目以降も結果互換

### TC-F05: 計測が初期チャンクと遅延チャンクを区別する

- **期待**: `measure-client-bundle.mjs` が初期チャンクサイズを主出力する
- **期待**: 動的 import がある場合、search / cache チャンクサイズを参考値として併記できる（Phase 0）
- **期待**: `--meta`（または同等）で bytesInOutput 上位を提示できる

## 14. search カタログ分離ケース（TC-F-S）

### TC-F-S01: search 正本の追加

- **前提**: Phase B 以降
- **期待**: `messages.search.jsonc` と `messages.search.generated.ts` が存在する
- **期待**: 同一キーが core / encode / search のどの正本間でも重複しない

### TC-F-S02: search キーの帰属

- **期待**: 少なくとも `search.*` は search カタログにある
- **期待**: 検索実行時専用の create キー（例: `create.missingSearchNgramShards`）は search カタログへ移してよい
- **期待**: 初期チャンクから参照される `msg` / `fmt` キーは core カタログで解決できる
- **期待**: search チャンク側のみが search カタログを import する

### TC-F-S03: compile / テスト分割

- **期待**: `compile-messages.mjs` が search 正本を生成する
- **期待**: メッセージ網羅テストが core / search（および encode）に更新されている

## 15. 密度圧縮ケース（TC-F-D）— Phase C–E

### TC-F-D01: schema densification

- **期待**: 検証セマンティクス（不正ペイロードで throw）を維持したまま、表駆動化等で初期チャンクが減る
- **期待**: `schema` 関連テストがパスする
- **期待**: 公開エラーの意味が壊れない（文言短縮は可、キー改名は CHANGELOG 要）

### TC-F-D02: message 短縮

- **期待**: core カタログの文言短縮後も、エラーの「何がダメか」が分かる
- **期待**: 部分一致を使う既存テストを更新したうえでパスする

### TC-F-D03: normalize 圧縮

- **期待**: 正規化の入出力互換を維持する
- **期待**: search 専用正規化を search チャンクへ移した場合、初期チャンク metafile から消える（または stub のみ）

## 16. Phase ゲート（チェックリスト）

| Phase | 内容 | ゲート |
|------|------|--------|
| 0 | metafile / チャンク併記 | TC-F05。`client-bundle-93.md` に起点行（35428）がある |
| A1 | Search lazy-load | TC-F01 / F03 / F04。起点比で初期チャンク **≥ 3.5KB 減**を目安 |
| A2 | cachian 遅延 | TC-F02。初期チャンクから cachian 消失 |
| B | search メッセージ分離 | TC-F-S01〜S03。A+B 後 **≤ 27000** |
| C–E | schema / 文言 / normalize | TC-F-D01〜D03。最終 **≤ 25600** |

PR 分割の目安: PR1 = Phase 0+A1+A2+B、PR2 = C–E。

## 17. 受け入れ条件（follow-up）

1. §12 の測定条件で、初期チャンク minify 生 **≤ 25600**
2. TC-F01〜F05 および TC-F-S（Phase B 実施後）を満たす
3. Phase C–E を実施した場合は TC-F-D を満たす
4. `brotli-wasm` は依存・ブラウザフォールバックとして残存（TC-Z）
5. 公開 API 互換（TC-F03 / TC-R）
6. `docs/client-bundle-93.md` に Phase ごとの実測が並ぶ
7. 計測スクリプトはサイズ未達だけで非 0 終了しない（TC-B05）。完了判定は本節の条件で行う
8. 未達時は残ギャップと次候補を PR に明記する

## 18. 実装時の参照ファイル（目安）

| 領域 | ファイル |
|------|----------|
| create / 遅延配線 | `src/create.ts`, `src/store.ts` |
| search 分離 | `src/api.ts`, `src/api.search.ts`（新規）, `src/searchIndexLoader.ts` |
| cache 遅延 | `src/cache.ts`, create の URL 経路 |
| カタログ | `messages.jsonc`, `messages.search.jsonc`（新規）, `scripts/compile-messages.mjs` |
| 計測 | `scripts/measure-client-bundle.mjs`, `docs/client-bundle-93.md` |
| 密度 | `src/schema.ts`, `src/normalize.ts`, messages 正本 |
