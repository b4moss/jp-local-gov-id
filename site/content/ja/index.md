---
title: ホーム
description: 日本の全国地方公共団体コードを扱う npm パッケージ
---

# jp-local-gov-id

日本の全国地方公共団体コードを、JavaScriptから扱えるようにするAPIです。

## できることの例

- 都道府県を指定すると、その都道府県に所在する市区町村を出力する。
- 都道府県の情報を一覧で取得する。
- 都道府県ごとの市区町村件数を取得する（同期・県別 JSON 不要）。
- 地方自治体のコードを取得する。ユニークなコードなので、住所の正規化に用いることができる。

## インストール

```bash
npm install @b4moss/jp-local-gov-id @b4moss/jp-local-gov-id-data
```

詳しくは[インストール](./installation.md)を参照してください。

## 簡単なコード例

```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });
await client.getByCode("131016"); // 千代田区
```

詳しくは[使い方](./usage.md)を参照してください。

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
| `@b4moss/jp-local-gov-id-data` | 分割データ JSON |

## 質問・要望など

[GitHub の Issues](https://github.com/b4m-oss/jp-local-gov-id/issues)からお願いします。（GitHubアカウントが必要です。）