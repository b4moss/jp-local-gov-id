---
title: Address input
description: Address form sample with prefecture and municipality selects
---

# Address input

Select a prefecture to load its municipalities into a dropdown. Uses `listPrefectures` and `listMunicipalitiesByPrefecture`. Town/street and building fields are decorative only (not passed to the API).

::example-pair

#demo
::address-input-demo
::

#html
```html
<label for="prefecture">Prefecture</label>
<select id="prefecture">
  <option value="">Select a prefecture</option>
  <!-- Fill options with listPrefectures() -->
</select>

<label for="municipality">Municipality</label>
<select id="municipality" disabled>
  <option value="">Select a municipality</option>
  <!-- On prefecture change, fill with listMunicipalitiesByPrefecture() -->
</select>

<label for="town">Town / street address</label>
<input id="town" type="text" placeholder="e.g. Marunouchi 1-1-1" />

<label for="building">Building name</label>
<input id="building" type="text" placeholder="e.g. Foo Building 3F" />
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
  placeholder.textContent = "Select a municipality";
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
