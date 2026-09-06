# クライアントバンドル計測（#93）

関連: [Issue #93](https://github.com/b4moss/jp-local-gov-id/issues/93) / [test-spec-93-client-bundle.md](./test-spec-93-client-bundle.md) / [≤25KB follow-up 計画](./plan-93-followup-25kb.md)

## 測定コマンド

```bash
npm run measure:client-bundle -w @b4moss/jp-local-gov-id
npm run measure:client-bundle -w @b4moss/jp-local-gov-id -- --meta
```

## 測定条件

| 項目 | 値 |
| --- | --- |
| エントリ | `createLocalGovClient`（`src/create.ts` を named export 経由） |
| bundler | esbuild |
| platform | `browser` |
| format | `esm` |
| minify | `true` |
| external | `brotli-wasm`, `node:zlib` |

サイズ超過だけではスクリプトは失敗しない（レポート用途）。#93 本体では 25KB は目安だったが、[follow-up テスト仕様 §12](./test-spec-93-client-bundle.md) では初期チャンク ≤25600 を完了条件とする（CI fail ゲート化はしない）。

## 結果

| 時点 | ブランチ / メモ | minify 生 | gzip |
| --- | --- | ---: | ---: |
| 分割前ベースライン（#85 後） | 単一 `MESSAGES` | 31620 | 8920 |
| 分割後（#128） | runtime / encode カタログ分割 + encode ファイル分離 + assert 共通化 | 30767 | 8846 |
| follow-up 起点 | `dev-v1.2.0` + `dev-v1.1.0`（`@b4moss/cachian` 取り込み後） | 35428 | 10325 |
| Phase 0 | metafile / 初期ロード定義を測定スクリプトに追加 | 35428 | 10325 |
| Phase A1+A2 | Search + cachian 動的 import | 25911 | 7476 |
| Phase B | search メッセージ分離 | 25402 | 7339 |
| Phase C–E | binary 直接 import・文言短縮・normalize 整理 | **24339** | **7212** |

差分: minify 生 **−853 B**（約 −2.7%）。encode 専用キーは create グラフおよび `decode.js` から除外済み。

## 実施内容（要約）

- `messages.jsonc`（runtime）と `messages.encode.jsonc`（encode / generate）へ分割
- `encode*` を `*.encode.ts` へ分離し、decode 経路が encode カタログを引かないようにした
- `decode.js` は `binary/decodeEntry.ts` から生成（runtime のみ）
- `brotli-wasm` は維持
- `binary/assert.ts` で共通 assert を整理

## follow-up 実施内容（≤25KB）

- Phase A1: `api.search.ts` へ全国検索を分離し、`searchByText` / `getLocalGovCodeByName` から動的 import
- Phase A1: `searchIndexLoader` を create 時は薄いラッパ、初回 `ensureSearchIndexes` で動的 import
- Phase A2: URL モードの `cache` / `@b4moss/cachian` を `import("./cache")` で遅延
- Phase B: `messages.search.jsonc` を追加し search 実装のみが参照
- Phase C–E: create の binary import を decode ファイル直指定、runtime 文言短縮、normalize の桁抽出共通化
- `brotli-wasm` は維持。公開 API 互換を維持

最終: 初期ロード minify 生 **24339**（目標 ≤25600）
