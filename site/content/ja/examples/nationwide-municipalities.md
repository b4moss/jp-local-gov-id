---
title: 全国市区町村一覧
description: 都道府県別に全市区町村をチェックボックスで絞り込むサンプル
---

# 全国市区町村一覧

不動産サイトのエリア絞り込みのように、北海道から沖縄まで都道府県コード順に並べ、各県の市区町村を地方自治体コード順のチェックボックスで表示します。選択内容は上部プレビューに反映されます。`listPrefectures` と `listMunicipalitiesByPrefecture` を使っています。

::example-pair

#demo
::nationwide-municipality-filter-demo
::

#html
```html
<aside class="area-filter">
  <header>
    <h2>エリアから探す</h2>
    <p><span id="selected-count">0</span> 件選択中</p>
    <button type="button" id="clear">クリア</button>
  </header>

  <input
    id="area-combo"
    type="text"
    role="combobox"
    placeholder="市区町村名・コードで検索…"
    autocomplete="off"
  />
  <ul id="area-combo-list" role="listbox" hidden></ul>

  <div id="preview">
    <span>選択中</span>
    <div id="preview-list"><!-- 選択チップ --></div>
  </div>

  <div id="pref-list">
    <!-- 都道府県ごとに section を動的生成 -->
    <!--
    <section data-pref="01">
      <label>
        <input type="checkbox" class="pref-all" />
        北海道
      </label>
      <button type="button" class="pref-toggle">開く</button>
      <div class="muni-grid">
        <label><input type="checkbox" value="011002" /> 札幌市</label>
        ...
      </div>
    </section>
    -->
  </div>
</aside>
```

#ts
```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });
const selected = new Set<string>();
const prefList = document.querySelector("#pref-list");
const previewList = document.querySelector("#preview-list");
const countEl = document.querySelector("#selected-count");

function renderPreview() {
  previewList.replaceChildren();
  // selected のコードから都道府県ごとにチップを描画する
  countEl.textContent = String(selected.size);
}

const prefectures = [...client.listPrefectures()].sort((a, b) =>
  a.code.localeCompare(b.code),
);

for (const pref of prefectures) {
  const municipalities = [
    ...(await client.listMunicipalitiesByPrefecture(pref.code)),
  ].sort((a, b) => a.code.localeCompare(b.code));

  const section = document.createElement("section");
  section.dataset.pref = pref.code;

  const title = document.createElement("label");
  title.innerHTML = `<input type="checkbox" class="pref-all" /> ${pref.name}`;
  section.append(title);

  const grid = document.createElement("div");
  grid.className = "muni-grid";
  for (const muni of municipalities) {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${muni.code}" /> ${muni.name}`;
    grid.append(label);
  }
  section.append(grid);
  prefList.append(section);
}

prefList.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== "checkbox") return;

  if (input.classList.contains("pref-all")) {
    const section = input.closest("section");
    section?.querySelectorAll(".muni-grid input").forEach((el) => {
      const box = el as HTMLInputElement;
      box.checked = input.checked;
      if (input.checked) selected.add(box.value);
      else selected.delete(box.value);
    });
  } else if (input.value) {
    if (input.checked) selected.add(input.value);
    else selected.delete(input.value);
  }

  countEl.textContent = String(selected.size);
  renderPreview();
});

document.querySelector("#clear").addEventListener("click", () => {
  selected.clear();
  prefList.querySelectorAll('input[type="checkbox"]').forEach((el) => {
    (el as HTMLInputElement).checked = false;
  });
  renderPreview();
});
```

::
