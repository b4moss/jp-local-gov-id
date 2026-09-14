import {
  index,
  municipalitiesByCode,
  prefectures,
  searchNgramShardArrays,
} from "./generatedDataset";
import {
  API_ENTRY_FILE,
  rewriteChunkRelativeImports,
} from "./chunkImports";

export {
  API_ENTRY_FILE,
  PLAYGROUND_CHUNK_PREFIX,
  rewriteChunkRelativeImports,
} from "./chunkImports";

/** Vite/Rollup ESM outputs under packages/jp-local-gov-id/dist (excludes IIFE). */
const rawDistModules = import.meta.glob(
  "../../../../packages/jp-local-gov-id/dist/*.js",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

function collectApiModules(): Record<string, string> {
  const modules: Record<string, string> = {};
  for (const [path, source] of Object.entries(rawDistModules)) {
    const fileName = path.slice(path.lastIndexOf("/") + 1);
    if (!fileName.endsWith(".js") || fileName.includes(".iife.")) continue;
    modules[fileName] = rewriteChunkRelativeImports(source);
  }
  if (!(API_ENTRY_FILE in modules)) {
    throw new Error(
      `Playground API entry missing: ${API_ENTRY_FILE} (build @b4moss/jp-local-gov-id first)`,
    );
  }
  return modules;
}

export function buildPackageSources(): {
  apiEntryFile: string;
  apiModules: Record<string, string>;
  data: string;
} {
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
    apiEntryFile: API_ENTRY_FILE,
    apiModules: collectApiModules(),
    data: dataSource,
  };
}
