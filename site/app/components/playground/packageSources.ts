import apiSource from "../../../../packages/jp-local-gov-id/dist/jp-local-gov-id.js?raw";
import {
  index,
  municipalitiesByCode,
  prefectures,
  searchNgramShardArrays,
} from "./generatedDataset";

export function buildPackageSources(): { api: string; data: string } {
  const dataSource = `const index = ${JSON.stringify(index)};
const prefectures = ${JSON.stringify(prefectures)};
const municipalitiesByCode = ${JSON.stringify(municipalitiesByCode)};
const searchNgramShards = Object.fromEntries(
  Object.entries(${JSON.stringify(searchNgramShardArrays)}).map(([k, arr]) => [k, new Uint8Array(arr)])
);
export { index, prefectures, municipalitiesByCode, searchNgramShards };
export function loadMunicipalities(code) {
  const padded = String(code).padStart(2, "0");
  const file = municipalitiesByCode[padded];
  if (!file) {
    return Promise.reject(new Error("Unknown prefecture code: " + padded));
  }
  return Promise.resolve(file);
}
const dataset = { index, prefectures, municipalitiesByCode, loadMunicipalities, searchNgramShards };
export default dataset;
`;

  return {
    api: apiSource,
    data: dataSource,
  };
}
