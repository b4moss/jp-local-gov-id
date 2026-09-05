---
title: はじめに
description: 全国地方公共団体コードヘルパの概要と次のステップ
schemaRole: TechArticle
---

# はじめに

全国地方公共団体コードヘルパは、日本の全国地方公共団体コードを JavaScript から扱うための npm パッケージです。

パッケージは 2 種類に分かれています。

- `@b4moss/jp-local-gov-id`: アプリケーション（API）
- `@b4moss/jp-local-gov-id-data`: 地方自治体データ（`index.json` + `.bin.br` + 検索索引）

旧来の JSON 一括データ配布ではありません。Brotli 圧縮バイナリを分割配信し、全国検索はハイブリッド n-gram 索引で候補を絞ります。

詳しくは [使い方](./usage.md) を参照してください。

## 次のステップ

1. [インストール](/ja/installation) — パッケージを入れる
2. [使い方](/ja/usage) — クライアントを初期化して呼び出す
3. [API](/ja/api) — 公開メソッドの詳細
4. [Playground](/ja/playground) — ブラウザ上で試す

サンプルコードの置き場は [サンプル](/ja/examples) を参照してください。
