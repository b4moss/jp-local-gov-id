---
title: Nationwide municipalities
description: Checkbox filter listing every municipality by prefecture
---

# Nationwide municipalities

Like a real-estate area filter: prefectures from Hokkaido to Okinawa (by prefecture code), with municipality checkboxes sorted by local government code. Uses `listPrefectures` and `listMunicipalitiesByPrefecture`.

::example-pair

#demo
::nationwide-municipality-filter-demo
::

#html
```html
<aside class="area-filter">
  <header>
    <h2>Search by area</h2>
    <p><span id="selected-count">0</span> selected</p>
    <button type="button" id="clear">Clear</button>
  </header>

  <input
    id="area-combo"
    type="text"
    role="combobox"
    placeholder="Search by name or code…"
    autocomplete="off"
  />
  <ul id="area-combo-list" role="listbox" hidden></ul>

  <div id="preview">
    <span>Selected</span>
    <div id="preview-list"><!-- Selected chips --></div>
  </div>

  <div id="pref-list">
    <!-- Dynamically render one section per prefecture -->
    <!--
    <section data-pref="01">
      <label>
        <input type="checkbox" class="pref-all" />
        Hokkaido
      </label>
      <button type="button" class="pref-toggle">Expand</button>
      <div class="muni-grid">
        <label><input type="checkbox" value="011002" /> Sapporo</label>
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
  // Build chips grouped by prefecture from `selected`
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
