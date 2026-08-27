export type PlaygroundTemplateId =
  | "getByCode"
  | "searchByText"
  | "listPrefectures";

export interface PlaygroundTemplate {
  id: PlaygroundTemplateId;
  /** i18n key under playground.templates.* */
  labelKey: string;
  code: string;
}

export const PLAYGROUND_TEMPLATES: PlaygroundTemplate[] = [
  {
    id: "getByCode",
    labelKey: "getByCode",
    code: `import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });
const result = await client.getByCode("131016");
console.log(result);
`,
  },
  {
    id: "searchByText",
    labelKey: "searchByText",
    code: `import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });
const results = await client.searchByText("中央", {
  prefecture: "13",
  target: "cities",
});
console.log(results);
`,
  },
  {
    id: "listPrefectures",
    labelKey: "listPrefectures",
    code: `import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });
const prefectures = client.listPrefectures();
console.log("prefectures", prefectures.length, prefectures.slice(0, 3));

const municipalities = await client.listMunicipalitiesByPrefecture("01", {
  designatedCity: "city",
});
console.log("municipalities in 01 (city)", municipalities.length, municipalities.slice(0, 3));
`,
  },
];

export function getTemplateById(
  id: PlaygroundTemplateId,
): PlaygroundTemplate {
  const found = PLAYGROUND_TEMPLATES.find((t) => t.id === id);
  if (!found) {
    throw new Error(`Unknown playground template: ${id}`);
  }
  return found;
}
