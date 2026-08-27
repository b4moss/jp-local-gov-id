---
title: 住所入力
description: 都道府県・市区町村のセレクトによる住所入力サンプル
---

# 住所入力

都道府県を選ぶと、配下の市区町村がプルダウンに読み込まれます。`listPrefectures` と `listMunicipalitiesByPrefecture` を使っています。町名・番地と建物名は見た目用のフィールドです（API には渡しません）。

::example-pair

#demo
::address-input-demo
::

#html
```html
<label for="prefecture">都道府県</label>
<select id="prefecture">
  <option value="">選択してください</option>
  <!-- listPrefectures() の結果で option を埋める -->
</select>

<label for="municipality">市区町村</label>
<select id="municipality" disabled>
  <option value="">選択してください</option>
  <!-- 都道府県変更時に listMunicipalitiesByPrefecture() で option を埋める -->
</select>

<label for="town">町名・番地</label>
<input id="town" type="text" placeholder="例: 丸の内1-1-1" />

<label for="building">建物名</label>
<input id="building" type="text" placeholder="例: ○○ビル 3F" />
```

#ts
```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });

const prefSelect = document.querySelector("#prefecture");
const muniSelect = document.querySelector("#municipality");

for (const pref of client.listPrefectures()) {
  const option = document.createElement("option");
  option.value = pref.code;
  option.textContent = pref.name;
  prefSelect.append(option);
}

prefSelect.addEventListener("change", async () => {
  muniSelect.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "選択してください";
  muniSelect.append(placeholder);

  if (!prefSelect.value) {
    muniSelect.disabled = true;
    return;
  }

  const municipalities = await client.listMunicipalitiesByPrefecture(
    prefSelect.value,
  );
  for (const muni of municipalities) {
    const option = document.createElement("option");
    option.value = muni.code;
    option.textContent = muni.name;
    muniSelect.append(option);
  }
  muniSelect.disabled = false;
});
```

::
