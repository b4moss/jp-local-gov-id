# クライアントバンドル計測（#93）

関連: [Issue #93](https://github.com/b4moss/jp-local-gov-id/issues/93) / [test-spec-93-client-bundle.md](./test-spec-93-client-bundle.md)

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

サイズ超過だけではスクリプトは失敗しない（レポート用途）。

## 結果

| 時点 | ブランチ / コミット | minify 生 | gzip | メモ |
| --- | --- | ---: | ---: | --- |
| 分割前ベースライン（#85 後） | `cursor/issue-93-client-bundle-41e9` | 31620 | 8920 | 単一 `MESSAGES` |
