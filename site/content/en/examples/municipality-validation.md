---
title: Municipality validation
description: Sample that validates an exact municipality name
---

# Municipality validation

With a prefecture selected, enter a municipality name. Validation runs when the field loses focus. Names that do not match an exact official name show an error (`getLocalGovCodeByName`). Town/street and building fields are decorative only.

::example-pair

#demo
::municipality-validation-demo
::

#html
```html
<label for="prefecture">Prefecture</label>
<select id="prefecture">
  <option value="">Select a prefecture</option>
  <!-- Fill options with listPrefectures() -->
</select>

<label for="municipality-name">Municipality name</label>
<input id="municipality-name" type="text" placeholder="千代田区" />

<label for="town">Town / street address</label>
<input id="town" type="text" placeholder="e.g. Marunouchi 1-1-1" />

<label for="building">Building name</label>
<input id="building" type="text" placeholder="e.g. Foo Building 3F" />

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
    message.textContent = "This municipality name does not exist";
  } else {
    message.textContent = `Valid (code: ${code})`;
  }
});
```

::
