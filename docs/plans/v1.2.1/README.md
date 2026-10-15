# plans / v1.2.1

対象マイルストーン: [`v1.2.1`](https://github.com/b4moss/jp-local-gov-id/milestone/15)  
リリース予定タグ: `app-v1.2.1`（`release` ブランチから打つ）

## 目的

- 未マージ Dependabot PR の取り込み
- Dependabot / GitHub 上の vulnerability alerts の解消
- app パッケージを `1.2.1` にバンプ

## 作業ブランチ

- 統合先: `dev-v1.2.1`
- 実装: `cursor/app-v1.2.1-security-deps-4631`

## リリース手順（憲章 / specs/ops/ci-cd）

1. 本計画の PR を `dev-v1.2.1` へマージ
2. `dev-v1.2.1` → `develop` → `main` → `release` の順で取り込む
3. `release` 上で `app-v1.2.1` タグを作成（`release-on-tag.yml` が GitHub Release を自動作成）
4. Publish workflow で npm 公開
