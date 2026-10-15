# search

全国文字列検索（ハイブリッド JLIX / n-gram）の現行契約。

## 概要

- ホット団体 → 2-gram（地域分割）、コールド団体 → 3-gram（3 シャード）
- 全国検索は索引で候補を絞り、該当県の `.bin.br` のみ遅延ロード
- 詳細な受け入れ条件はテスト仕様を正とする

## 関連

- テスト仕様: [../../tests/search/test-spec-63-search-ngrams.md](../../tests/search/test-spec-63-search-ngrams.md)
- pillar: [../../README.md](../../README.md)
- API 共通ルール: [../api/logics.md](../api/logics.md)

----

以上
