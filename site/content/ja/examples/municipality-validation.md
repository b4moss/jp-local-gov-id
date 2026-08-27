---
title: 市区町村バリデーション
description: 市区町村名の実在チェックサンプル
---

# 市区町村バリデーション

都道府県を選んだうえで市区町村名を入力し、フォーカスが外れたタイミングで実在するか検証します。正式名称に一致しない場合はエラーになります（`getLocalGovCodeByName`）。町名・番地と建物名は見た目用です。

::example-pair

#demo
::municipality-validation-demo
::

#html
```html
<label for="prefecture">都道府県</label>
<select id="prefecture">
  <option value="">選択してください</option>
  <!-- listPrefectures() の結果で option を埋める -->
</select>

<label for="municipality-name">市区町村名</label>
<input id="municipality-name" type="text" placeholder="千代田区" />

<label for="town">町名・番地</label>
<input id="town" type="text" placeholder="例: 丸の内1-1-1" />

<label for="building">建物名</label>
<input id="building" type="text" placeholder="例: ○○ビル 3F" />

<p id="message" hidden></p>
```

#ts
```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });

const prefSelect = document.querySelector("#prefecture");
const nameInput = document.querySelector("#municipality-name");
const message = document.querySelector("#message");

for (const pref of client.listPrefectures()) {
  const option = document.createElement("option");
  option.value = pref.code;
  option.textContent = pref.name;
  prefSelect.append(option);
}

nameInput.addEventListener("blur", async () => {
  const name = nameInput.value.trim();
  if (!name) {
    message.hidden = true;
    return;
  }

  const code = await client.getLocalGovCodeByName(name, {
    prefecture: prefSelect.value,
    target: "cities",
  });

  message.hidden = false;
  if (code === null) {
    message.textContent = "存在しない市区町村名です";
  } else {
    message.textContent = `有効です（コード: ${code}）`;
  }
});
```

::
