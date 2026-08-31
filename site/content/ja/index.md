---
title: ホーム
description: 日本の全国地方公共団体コードを扱う npm パッケージ
schemaRole: TechArticle
---

# 全国地方公共団体コードヘルパ

日本の全国地方公共団体コードを、JavaScript から扱えるようにする API です。

データは **JSON 一括配布ではなく**、Brotli 圧縮バイナリ（`.bin.br`）を県単位・検索索引単位に分割して配信します。必要なファイルだけ遅延ロードできます。

## できることの例

- 都道府県を指定すると、その都道府県に所在する市区町村を出力する
- 都道府県の情報を一覧で取得する
- 都道府県ごとの市区町村件数を取得する（同期・県別データ不要）
- 地方自治体のコードを取得する（住所の正規化などに利用）
- 全国文字列検索（ハイブリッド n-gram 索引で候補を絞り込み）

## インストール

```bash
npm install @b4moss/jp-local-gov-id @b4moss/jp-local-gov-id-data
```

詳しくは [インストール](./installation.md) を参照してください。

## 簡単なコード例

```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });
await client.getByCode("131016"); // 千代田区
```

詳しくは [使い方](./usage.md) を参照してください。

## 試してみる

ブラウザ上でコード解決と文字列検索を試せます。自由にコードを書く場合は [Playground](/ja/playground) へ。

### コード解決

::code-lookup-demo
::

### 文字列検索

::search-demo
::

## パッケージ内容

| パッケージ | 説明 |
|------------|------|
| `@b4moss/jp-local-gov-id` | JS API（データ非同梱） |
| `@b4moss/jp-local-gov-id-data` | `index.json` + Brotli バイナリ（`.bin.br`）＋検索索引 |

## 質問・要望など

[GitHub の Issues](https://github.com/b4moss/jp-local-gov-id/issues) からお願いします。（GitHub アカウントが必要です。）
