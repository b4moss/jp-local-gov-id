# client

`createLocalGovClient` 初期バンドルサイズの契約と計測。

| ファイル | 内容 |
|----------|------|
| [client-bundle-93.md](./client-bundle-93.md) | 計測手順・実測ログ（#93） |

## 概要

- 初期 minify 目標 ≤25600（実測 ≈24339、v1.2.0）
- 検索実装・`@b4moss/cachian` は動的 import で初期グラフから切り離す

## 関連

- テスト仕様: [../../tests/client/test-spec-93-client-bundle.md](../../tests/client/test-spec-93-client-bundle.md)
- 完了計画の履歴: [../../_archived/history/plans/plan-93-followup-25kb.md](../../_archived/history/plans/plan-93-followup-25kb.md)

----

以上
