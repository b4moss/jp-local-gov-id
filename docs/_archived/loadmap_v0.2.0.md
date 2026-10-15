# jp-local-gov-id 開発ロードマップ

仕様書（[README.md](../README.md)（旧 `main.md`））に基づく開発ステップ。

## 現状

- [x] 仕様の骨子を固める（`docs/README.md`（旧 `main.md`））
- [x] ディレクトリの枠を用意（`src/` / `resources/` / `scripts/`）

## Step 1. プロジェクト基盤

- [x] Vite（ライブラリモード）+ TypeScript の初期設定
- [x] `package.json`（ESM、`exports`、型定義の出口）を整える
- [x] ビルド成果物の出力先（例: `dist/`）と、`files` / `.npmignore` で `resources/`・`scripts/` を配布対象外にする
- [x] 最低限の lint / format（任意） — Step 1 では見送り（`.editorconfig` のみ）

## Step 2. データソースの確定と配置

- [x] 利用する公的 Excel を特定する（`resources/000925835.xlsx` / R6.1.1）
- [x] `resources/` に配置する
- [x] データの版・取得元を README または docs に短く残す（取得元 URL は当面未記載）

## Step 3. パーススクリプト

- [x] `scripts/` に Excel → JSON 変換スクリプトを実装する
- [x] 現行データのみを出力する（廃止・合併済みは含めない）
- [x] 政令市は市本体と区の両方を含める（区名は元データどおり、カナも格納）
- [x] 生成 JSON を `src/` 配下（例: `src/data/`）へ出力する
- [x] npm script から実行できるようにする（例: `npm run generate`）

## Step 4. コア API の実装（`src/`）

- [x] 型（`LocalGov` / `SearchTarget`）を定義する
- [x] コード正規化（都道府県: 0 埋め有無の吸収、市区町村: 6 桁）
- [x] `listPrefectures`
- [x] `getPrefectureCode`
- [x] `getMunicipalitiesByPrefecture`
- [x] `getByCode`
- [x] `search`（`target`: `all` | `prefectures` | `cities`）
- [x] `getCodeByName`
- [x] 公開エントリ（`src/index.ts`）から export する

## Step 5. 未検討事項の決定と反映

- [x] エラー時の振る舞い（`null` / 空配列。throw しない）
- [x] 文字の正規化方針（当面はなし。将来検討）
- [x] 政令市区の `name`（元データどおり）・カナ含有を決定し `docs/README.md`（旧 `main.md`） に反映

## Step 6. テスト

- [x] 代表ケースの単体テスト（都道府県 / 市区町村 / 政令市の市と区）
- [x] 部分一致・`target` 絞り込み・0 埋めなしコードの入力
- [x] 一意取得と複数ヒット時の挙動

## Step 7. パッケージとして仕上げる

- [x] ビルドが通ること、型定義が出力されることを確認する
- [x] README（使い方・コード形式・バージョン方針）を書く
- [x] 初回バージョン（例: `0.1.0`）で npm 公開準備

## Step 8. 運用

- [ ] 合併等でデータ更新 → `resources/` 更新 → `scripts/` 再実行 → データパッケージを **minor** リリース
- [ ] バグ修正は **patch**
- [ ] API 破壊的変更: ver 0.x は **minor**、ver 1.x 以降は **major**

## Step 9. API / データの二系統化

- [x] モノレポ化（npm workspaces / `packages/jp-local-gov-id` / `packages/jp-local-gov-id-data`）
- [x] データ JSON を API バンドルから外し、データ専用パッケージとして独立配布する
- [x] `createLocalGov({ data } | { url })` による async 初期化に切り替える
- [x] API 側でスキーマ検証する
- [x] `url` 取得時は版付き URL をキーに localStorage キャッシュ（有効期限 1 年）
- [x] README / 公開 API を新仕様に合わせて更新する

## Step 10. データ分割と遅延ロード

- [x] `index.json` / `prefectures.json` / `prefectures/{code}.json` を generate で出力する
- [x] 単一 `local-govs.json`（全市区町村まとめ）を廃止する
- [x] 初期化は index + 都道府県のみ。県別は遅延ロード
- [x] 全国文字列検索時、未ロード県を同時 6 件で並列 fetch
- [x] 市区町村系 API を async に合わせ、テスト・README を更新する

## 推奨する進め方

1 → 2 → 3 を先に進め、実データがある状態で 4 を実装する。  
5 は 4 の途中でも決められるが、テスト（6）の前までに固める。  
モノレポ化と二系統のランタイム分離（Step 9）は完了。  
データ分割（Step 10）は実装済み。

----

以上