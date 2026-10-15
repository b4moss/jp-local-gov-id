# data

データパッケージの配信形式・生成契約・容量の正本。

| ファイル | 内容 |
|----------|------|
| [binary-size-73.md](./binary-size-73.md) | JSON → `.bin` 移行時の容量比較（#73） |

## 概要

- npm / CDN: Brotli（`.bin.br`）+ `index.json`
- リポジトリのみ: 中間 CSV・非圧縮 `.bin`
- 公開エンベロープ `schemaVersion`（現行 `2`）とバイナリヘッダ `version` は独立

## 関連

- テスト仕様: [../../tests/data/test-spec-73-csv-binary.md](../../tests/data/test-spec-73-csv-binary.md)
- 検索索引: [../search/](../search/)
- pillar: [../../README.md](../../README.md)

----

以上
