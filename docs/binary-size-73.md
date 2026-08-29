# データパッケージ容量比較（#73: JSON → `.bin`）

測定日: 2026-08-29  
比較対象:

| | Before | After |
| --- | --- | --- |
| 参照 | `main`（`@b4moss/jp-local-gov-id-data@1.0.0-rc.3`、分割 JSON） | `feat/73-generate-data`（`1.0.0-rc.10`、分割 `.bin`） |
| 方法 | `npm pack` / `package.json` の `files` 相当を集計 | 同左（CSV は npm 非同梱のため除外） |

関連: [Issue #73](https://github.com/b4moss/jp-local-gov-id/issues/73) / [test-spec-73-csv-binary.md](./test-spec-73-csv-binary.md) / [main.md](./main.md)

## 結論

- **展開サイズ（unpacked）は大幅減**: データ本体は約 **436 KiB → 88 KiB（約 20%）**
- **npm の `.tgz`（gzip 後）は微増**: 約 **41.9 KB → 47.8 KB**
  - JSON は gzip が効きやすい一方、`.bin` はすでに密で圧縮余地が小さい
  - 加えて `decode.js`（約 14 KiB）と肥大化した `dataset.js` が tarball に載る

CDN で `.bin` を個別配信する用途では、展開サイズに近い削減が効きやすい。npm インストールの tarball だけを見る場合は、現状のオーバーヘッドに注意。

転送の追加圧縮（Brotli 等）は **#74** のスコープ。

## 展開サイズ（unpacked）

| 項目 | Before (JSON) | After (`.bin`) | After / Before |
| --- | ---: | ---: | ---: |
| npm 公開ファイル合計 | 458,801 B（448.0 KiB） | 126,948 B（124.0 KiB） | **27.7%** |
| データ本体のみ（都道府県 + 県別） | 446,469 B（436.0 KiB） | 90,094 B（88.0 KiB） | **20.2%** |
| `npm pack` の `unpackedSize` | 459,895 B（449.1 KiB） | 128,104 B（125.1 KiB） | **27.9%** |

### 代表ファイル

| ファイル | Before | After |
| --- | ---: | ---: |
| `prefectures.json` → `prefectures.bin` | 14,805 B | 2,117 B |
| `prefectures/01`（北海道） | 44,416 B（`.json`） | 9,191 B（`.bin`） |
| `prefectures/27`（大阪府） | （県別 JSON） | 3,856 B（`.bin`） |

## npm pack（`.tgz` / gzip 後）

| | Before | After |
| --- | ---: | ---: |
| package size（`npm pack`） | **41.9 KB** | **47.8 KB** |
| entryCount | 55 | 56 |

## After 側の内訳メモ

| 項目 | サイズ | 備考 |
| --- | ---: | --- |
| `dataset.js` | 14,356 B | Before は 4,221 B。`.bin` を同期読込してデコードする生成物 |
| `decode.js` | 14,380 B | 新規（codec の ESM バンドル） |
| CSV 合計 | 約 85 KiB | **リポジトリのみ**。npm の `files` には含めない |

## 再測定手順（参考）

```bash
# Before
git archive origin/main packages/jp-local-gov-id-data | tar -x -C /tmp/before-data
# After
git archive origin/feat/73-generate-data packages/jp-local-gov-id-data | tar -x -C /tmp/after-data

cd /tmp/before-data/packages/jp-local-gov-id-data && npm pack
cd /tmp/after-data/packages/jp-local-gov-id-data && npm pack
```
