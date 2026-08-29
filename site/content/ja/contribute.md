---
title: 開発に参加する
description: コントリビューションの概要
---

# 開発に参加する

Issue・Pull Request は歓迎です。[GitHub リポジトリ](https://github.com/b4moss/jp-local-gov-id) からご参加ください。

## リポジトリ構成

npm workspaces のモノレポです。

| パス | 内容 |
|------|------|
| `packages/jp-local-gov-id` | JS API |
| `packages/jp-local-gov-id-data` | `index.json` + `.bin.br`（都道府県・県別・JLIX）。中間 CSV / 非圧縮 `.bin` はリポジトリのみ |
| `scripts/` | Excel からのデータ生成など |
| `site/` | このドキュメントサイト |
| `docs/` | 内部仕様書 |

## はじめ方

```bash
npm install
npm test
npm run build
```

### PR 前の必須ゲート

`develop` / `dev-*` 向けの PR を出す前に、ローカルで CI 相当を通してください。

```bash
npm run ci:local            # 推奨（nektos/act + Docker）
npm run ci:local:fallback   # Docker が無い環境のみ
```

発火条件・CD はリポジトリの [docs/ci-cd.ja.md](https://github.com/b4moss/jp-local-gov-id/blob/main/docs/ci-cd.ja.md) を参照してください。

データの再生成（総務省の Excel → CSV / `.bin`（リポジトリ）→ `.bin.br` + ハイブリッド JLIX（npm））:

```bash
npm run generate
```

ドキュメントサイトのローカル起動:

```bash
npm run dev:site
```

## 方針の目安

- バグ修正・ドキュメント改善・テスト追加は歓迎です
- API の破壊的変更やデータ形式の変更は、Issue で先に相談してください
- 詳細な仕様はリポジトリ内の `docs/`（特に `logics.md` / `main.md` / `test-spec-63-search-ngrams.md`）を参照してください

ライセンスは MIT です。
