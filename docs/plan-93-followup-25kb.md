# #93 follow-up: createLocalGovClient ≤25KB 計画

関連: [Issue #93](https://github.com/b4moss/jp-local-gov-id/issues/93) / [client-bundle-93.md](./client-bundle-93.md) / [PR #128](https://github.com/b4moss/jp-local-gov-id/pull/128)

## 前提

| 項目 | 値 |
| --- | --- |
| 現状（follow-up 起点） | minify 生 **35428** / gzip 10325（`@b4moss/cachian` 込み） |
| #128 直後（参考） | minify 生 **30767** / gzip 8846 |
| 目標 | minify 生 **≤ 25600**（ギャップ **≈9828 B**） |
| 測定 | `npm run measure:client-bundle -w @b4moss/jp-local-gov-id` |
| 条件 | esbuild browser + minify ESM、external: `brotli-wasm`, `node:zlib` |
| ベース | PR #128（runtime/encode カタログ分割）を前提に追従 |

### 採用 / 不採用

| # | レバー | 判定 |
| --- | --- | --- |
| 1 | Search lazy-load（create グラフから search 実装を切り離す） | **採用**（主レバー） |
| 1b | cachian / `cache.ts` の動的 import | **採用**（cachian 約 5KB） |
| 2 | Schema densification（検証は維持、表現を圧縮） | **採用** |
| 3 | Message 文言のさらなる短縮 | **採用** |
| 4 | Normalize 圧縮 | **採用** |
| 5 | Brotli 経路の間引き / wasm 二重試行の削除をサイズ目的で行う | **不採用**（`brotli-wasm` 維持） |
| 6 | カタログ再分割（search 用メッセージの遅延結合） | **採用**（1 と連動） |

## 目標内訳（見込み）

合計で ≈5.8KB 以上を狙う。数字は minify 生の概算。

| 順序 | レバー | 見込み削減 | 根拠・メモ |
| ---: | --- | ---: | --- |
| A | #1 Search lazy-load | **3800–5500** | loader+index+JLIX decode+ngrams ≈4.6KB。`api.searchByText` 経路を動的 import すると create 直後グラフから外せる |
| B | #6 Search メッセージ分離 | **300–800** | search 専用キーを runtime 本体から外し、search chunk 側に載せる。#1 と同時でないと効果が出にくい |
| C | #2 Schema densification | **800–1500** | `schema.ts` ソース ≈9KB。必須フィールド表駆動化・重複メッセージ削減。検証セマンティクスは維持 |
| D | #3 Message 短縮 | **400–900** | runtime 60 キーすべて参照済み。文言短縮と共通フレーズ化のみ。死キー削除だけでは効かない |
| E | #4 Normalize 圧縮 | **200–500** | `normalize.ts` ≈3.5KB。ルックアップ表・分岐の共有化 |

楽観合計 ≈5.5–9KB。**A が未達だと 25KB は厳しい**ので、まず A+B で測定し、足りない分を C→D→E で埋める。

## フェーズ計画

### Phase 0 — 測定基盤の強化（小さく）

- `measure-client-bundle.mjs` に metafile 上位モジュール一覧（bytesInOutput）を出すオプションを追加
- 各 Phase 終了時に `docs/client-bundle-93.md` へ行を追加
- ゲート案: Phase A+B 後に **≤ 27000**、最終 **≤ 25600**（未達なら差分内訳を Issue/PR に残し、追加レバーを検討）

### Phase A — Search lazy-load（#1）【主】

**狙い:** `createLocalGovClient` の初期グラフから、全国検索専用実装を切り離す。

**現状の結合点**

- `create.ts` → `searchIndexLoader`（常時）
- `api.ts` → `searchIndex` / `searchNgrams` / `normalizeSearchText`（`searchByText` 等）
- `store` が `ensureSearchIndexes` を保持

**方針**

1. クライアント公開 API のシグネチャは変えない（`searchByText` は同期/非同期の契約を既存テストに合わせる）。
2. create 時は **薄い stub / 遅延ローダ**だけを組み立てる。
   - 例: `ensureSearchIndexes` は初回 `searchByText`（または同等の検索エントリ）まで `import("./searchIndexLoader")` しない、または loader factory 自体を別チャンクに置く。
3. `api.ts` の検索本体を `api.search.ts`（仮）へ移し、`buildLocalGovClient` は動的 import または遅延束縛で接続する。
4. **都道府県・市区町村の通常 lookup / list は静的経路のまま**（検索未使用クライアントが search を引かないこと）。
5. dataset モードの `create.missingSearchNgramShards` は、検索を呼ぶまで投げない、または create 時は型だけ検証して実装は遅延、のどちらかを選ぶ（既存テストに合わせて後者優先）。

**リスク**

- 動的 `import()` は bundler によっては別チャンクになり、**単一 minify 生の「エントリ1ファイル」計測が下がる一方、合計転送は別**。Issue #93 の定義は「create グラフの minify 生」なので、測定スクリプトは **named export entry の初期チャンク**を主指標にし、search チャンクサイズは参考値として併記する。
- Tree-shaking と esbuild code-splitting の挙動差。測定条件をドキュメントに固定する。

**受け入れ**

- 既存 search テスト緑
- lookup/list のみのクライアント計測で search モジュールが metafile に出ない（または bytes が stub のみ）
- minify 生が Phase 0 比で **≥ 3.5KB 減**

### Phase B — Search カタログ分離（#6）【A 連動】

**狙い:** runtime `messages.jsonc` から search 専用キーを剥がし、search chunk だけが引く。

**手順**

1. `messages.jsonc` をキー使用箇所で分類（core / search）。compile を `messages.generated.ts` + `messages.search.generated.ts` に拡張。
2. `messages.search.ts` を search 実装側からのみ import。
3. core 側は `messages.ts` のみ。二重カタログの encode 分割（#128）は維持。

**受け入れ**

- `messages.generated.ts` のバイト減が測定に反映
- メッセージキーの網羅テストを core/search に分割更新

### Phase C — Schema densification（#2）

**狙い:** 検証ロジックは維持しつつ、フィールド定義・エラー組み立てを圧縮。

**方針**

1. 必須キー配列 + 共通 `requireKeys` / `assertType` ヘルパへ寄せる（`binary/assert.ts` パターンの再利用）。
2. 長い個別 `if (!x.foo)` 連鎖を表駆動化。
3. エラーメッセージはキー短文化（Phase D）と同時でも可。
4. **公開エラー型・エラーコード相当の文字列キーは互換を優先**（文言は短縮可、キー名変更は CHANGELOG 要）。

**受け入れ**

- `schema.test.ts` 全パス緑（不正ペイロードで従来どおり throw）
- schema の bytesInOutput が明確に減少

### Phase D — Message 短縮（#3）

**狙い:** 参照済み 60 キーの文言密度を上げる。

**方針**

1. 重複フレーズ（`Invalid …` / `expected …`）を短い共通語に統一。
2. ユーザー向けに意味が壊れない範囲で英文言を短縮（日本語メッセージが無い前提の現状に合わせる）。
3. `fmt` テンプレートのプレースホルダ名は短く（`{code}` 維持など、可読性とサイズのバランス）。
4. Phase B 後の core カタログを優先短縮（search は search chunk 側）。

**受け入れ**

- messages テスト・スナップショット相当の期待文字列を更新
- 破壊的に意味が変わる文言は避ける（「何がダメか」は残す）

### Phase E — Normalize 圧縮（#4）

**狙い:** 全クライアントが引く `normalize.ts` を薄くする。

**方針**

1. 全角→半角・かな正規化の表を共有ループにまとめる。
2. prefecture / municipality / lookup の共通桁・チェック処理を一本化。
3. search 専用 `normalizeSearchText` は Phase A 後、可能なら search chunk 側へ移し、core から外す（追加のサイズ効果）。

**受け入れ**

- normalize / api / search テスト緑
- コード正規化の入出力互換維持

## 明示的にやらないこと（#5）

- `brotli-wasm` の削除や「ネイティブ Brotli のみ」への縮小
- wasm / DecompressionStream 二重試行の削除を **バンドルサイズ目的**で行うこと
- Brotli 周りのリファクタは、可読性・バグ修正に限る（サイズ KPI に入れない）

## ブランチ / PR 運用

| 項目 | 推奨 |
| --- | --- |
| ベース | `dev-v1.2.0`（#128 マージ後）。未マージなら `cursor/issue-93-client-bundle-41e9` 上に積み、マージ後に rebase |
| 作業ブランチ | `cursor/issue-93-client-25kb-41e9`（新規） |
| PR 分割 | **推奨:** PR1 = Phase A+B、PR2 = C+D+E。巨大差分を避ける |
| 各 PR | 測定表更新 + test-spec 追記 + パッケージテスト緑 |

## テスト方針

- 既存: `packages/jp-local-gov-id` の unit（create / api / schema / search* / messages / normalize）
- 追加:
  - 「search を呼ばない create」で search 実装モジュールが初期チャンクに含まれないこと（metafile アサーション、または測定スクリプトの回帰チェック）
  - lazy 後も `searchByText` のヒット順・件数互換
- [x] `docs/test-spec-93-client-bundle.md` に Phase ゲートと「初期チャンク vs search/cache チャンク」の定義を追記（§12〜）

## 完了条件

1. 測定条件固定のまま、create 初期チャンク minify 生 **≤ 25600**
2. `brotli-wasm` は依存・ブラウザフォールバックとして残存
3. 公開 API 互換（メソッド名・主なエラー型）
4. `docs/client-bundle-93.md` に Phase ごとの実測が並ぶ
5. 未達の場合は、残ギャップと次候補（さらなる API 分割、型ガードの外出し等）を PR に明記（推測のまま閉じない）

## 実装順序（実行チェックリスト）

- [x] Phase 0: metafile 内訳出力
- [x] Phase A: search 実装の遅延ロード（+ cachian 遅延）
- [x] Phase B: messages.search 分割
- [x] 中間測定（A+B 後 ≈25402 ≤27000）
- [x] Phase C–E: binary 直 import・文言短縮・normalize 整理（schema 大規模表駆動は見送り：目標達成済み）
- [x] Phase D: 文言短縮
- [x] Phase E: normalize 桁抽出共通化
- [x] 最終測定 **24339** ≤25600 → ドキュメント更新
