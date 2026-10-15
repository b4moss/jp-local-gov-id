# cache

`url` 経路の localStorage キャッシュと `purgeCache`。

## 概要

- 実装は `@b4moss/cachian`（`localStorageDriver` + get / set / purge）
- 物理キー prefix: `jp-local-gov-id:`
- 全国検索で取得した県別データと JLIX はメモリのみ（localStorage 非書き込み）
- `LocalGovClient.purgeCache` で明示削除

## 関連

- テスト仕様: [../../tests/cache/test-spec-94-cachian-purge.md](../../tests/cache/test-spec-94-cachian-purge.md)
- API 共通: [../api/logics.md](../api/logics.md)
- pillar: [../../README.md](../../README.md)

----

以上
