# クライアントバンドル計測（#93）

関連: [Issue #93](https://github.com/b4moss/jp-local-gov-id/issues/93) / [test-spec-93-client-bundle.md](./test-spec-93-client-bundle.md) / [≤25KB follow-up 計画](./plan-93-followup-25kb.md)

## 測定コマンド

```bash
npm run measure:client-bundle -w @b4moss/jp-local-gov-id
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

サイズ超過だけではスクリプトは失敗しない（レポート用途）。25KB は目安であり必達ゲートではない。

## 結果

| 時点 | ブランチ / メモ | minify 生 | gzip |
| --- | --- | ---: | ---: |
| 分割前ベースライン（#85 後） | 単一 `MESSAGES` | 31620 | 8920 |
| 分割後 | runtime / encode カタログ分割 + encode ファイル分離 + assert 共通化 | 30767 | 8846 |

差分: minify 生 **−853 B**（約 −2.7%）。encode 専用キーは create グラフおよび `decode.js` から除外済み。

## 実施内容（要約）

- `messages.jsonc`（runtime）と `messages.encode.jsonc`（encode / generate）へ分割
- `encode*` を `*.encode.ts` へ分離し、decode 経路が encode カタログを引かないようにした
- `decode.js` は `binary/decodeEntry.ts` から生成（runtime のみ）
- `brotli-wasm` は維持
- `binary/assert.ts` で共通 assert を整理
