import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import ExcelJS from "exceljs";
import {
  designatedCityBodyNameFromWard,
  filterByDesignatedCity,
  isDesignatedCityWard,
} from "../packages/jp-local-gov-id/src/designatedCity.ts";
import {
  encodeMunicipalities,
  encodePrefectures,
  encodeSearchNgrams,
  GRAM_TYPE_KANA,
  GRAM_TYPE_NAME,
  KIND_MUNI,
  KIND_PREF,
  type MunicipalityBinRecord,
  type PrefectureBinRecord,
  type SearchNgramPostingRecord,
} from "../packages/jp-local-gov-id/src/binary/index.ts";
import { normalizeSearchText } from "../packages/jp-local-gov-id/src/normalize.ts";
import { codePointBigrams } from "../packages/jp-local-gov-id/src/searchNgrams.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const sourcePath = resolve(root, "resources/000925835.xlsx");
const dataDir = resolve(root, "packages/jp-local-gov-id-data");
const prefecturesDir = resolve(dataDir, "prefectures");
const binaryEntry = resolve(
  root,
  "packages/jp-local-gov-id/src/binary/index.ts",
);

type LocalGov = {
  code: string;
  name: string;
  nameKana: string;
  prefectureCode: string;
  prefectureName: string;
  prefectureNameKana: string;
};

type PrefectureRow = LocalGov & { muniCode: string };

type RawRow = {
  code6: string;
  prefectureName: string;
  municipalityName: string | null;
  prefectureNameKana: string;
  municipalityNameKana: string | null;
};

function cell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object" && value !== null && "text" in value) {
    return String((value as { text: unknown }).text).replace(/\r\n/g, "\n").trim();
  }
  if (typeof value === "object" && value !== null && "result" in value) {
    return cell((value as { result: unknown }).result);
  }
  return String(value).replace(/\r\n/g, "\n").trim();
}

function toPrefectureCode(code6: string): string {
  return code6.slice(0, 2);
}

function sheetToRows(sheet: ExcelJS.Worksheet): RawRow[] {
  const result: RawRow[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const code6 = cell(row.getCell(1).value);
    if (!/^\d{6}$/.test(code6)) return;

    const prefectureName = cell(row.getCell(2).value);
    const municipalityName = cell(row.getCell(3).value) || null;
    const prefectureNameKana = cell(row.getCell(4).value);
    const municipalityNameKana = cell(row.getCell(5).value) || null;

    if (!prefectureName) return;

    result.push({
      code6,
      prefectureName,
      municipalityName,
      prefectureNameKana,
      municipalityNameKana,
    });
  });

  return result;
}

function toPrefecture(row: RawRow): PrefectureRow {
  const prefectureCode = toPrefectureCode(row.code6);
  return {
    code: prefectureCode,
    name: row.prefectureName,
    nameKana: row.prefectureNameKana,
    prefectureCode,
    prefectureName: row.prefectureName,
    prefectureNameKana: row.prefectureNameKana,
    muniCode: row.code6,
  };
}

function toMunicipality(row: RawRow): LocalGov {
  if (!row.municipalityName) {
    throw new Error(`Municipality name missing for code ${row.code6}`);
  }
  return {
    code: row.code6,
    name: row.municipalityName,
    nameKana: row.municipalityNameKana ?? "",
    prefectureCode: toPrefectureCode(row.code6),
    prefectureName: row.prefectureName,
    prefectureNameKana: row.prefectureNameKana,
  };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function writeCsv(path: string, headers: string[], rows: Array<Array<string | number>>): void {
  const lines = [
    headers.join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
    "",
  ];
  writeFileSync(path, lines.join("\n"), "utf8");
}

function cleanGeneratedArtifacts(): void {
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(prefecturesDir, { recursive: true });

  for (const name of readdirSync(prefecturesDir)) {
    if (
      name.endsWith(".json") ||
      name.endsWith(".csv") ||
      name.endsWith(".bin")
    ) {
      rmSync(resolve(prefecturesDir, name));
    }
  }

  for (const name of [
    "local-govs.json",
    "prefectures.json",
    "prefectures.csv",
    "prefectures.bin",
    "search-ngrams.csv",
    "search-ngrams.bin",
  ]) {
    try {
      rmSync(resolve(dataDir, name));
    } catch {
      // ignore if missing
    }
  }
}

function appendNgrams(
  out: Map<string, SearchNgramPostingRecord>,
  field: "name" | "nameKana",
  raw: string,
  base: Omit<SearchNgramPostingRecord, "gram" | "gramType">,
): void {
  const gramType = field === "name" ? GRAM_TYPE_NAME : GRAM_TYPE_KANA;
  for (const gram of codePointBigrams(normalizeSearchText(raw))) {
    const key = `${gram}\0${gramType}\0${base.muniCode}`;
    if (out.has(key)) continue;
    out.set(key, { ...base, gram, gramType });
  }
}

function buildSearchNgramPostings(
  prefectures: PrefectureRow[],
  byPrefecture: Map<string, LocalGov[]>,
): SearchNgramPostingRecord[] {
  const map = new Map<string, SearchNgramPostingRecord>();

  for (const pref of prefectures) {
    const base = {
      kind: KIND_PREF as const,
      muniCode: Number(pref.muniCode),
      prefCode: Number(pref.code),
      hasWard: 0 as const,
      isWard: 0 as const,
    };
    appendNgrams(map, "name", pref.name, base);
    appendNgrams(map, "nameKana", pref.nameKana, base);
  }

  for (const [prefCode, list] of byPrefecture) {
    const flags = wardFlagsForPrefecture(list);
    for (const m of list) {
      const f = flags.get(m.code) ?? { hasWard: 0 as const, isWard: 0 as const };
      const base = {
        kind: KIND_MUNI as const,
        muniCode: Number(m.code),
        prefCode: Number(prefCode),
        hasWard: f.hasWard,
        isWard: f.isWard,
      };
      appendNgrams(map, "name", m.name, base);
      appendNgrams(map, "nameKana", m.nameKana, base);
    }
  }

  return [...map.values()];
}


function wardFlagsForPrefecture(list: LocalGov[]): Map<string, { hasWard: 0 | 1; isWard: 0 | 1 }> {
  const bodyNames = new Set<string>();
  for (const item of list) {
    const body = designatedCityBodyNameFromWard(item.name);
    if (body) bodyNames.add(body);
  }
  const flags = new Map<string, { hasWard: 0 | 1; isWard: 0 | 1 }>();
  for (const item of list) {
    const isWard = isDesignatedCityWard(item.name) ? 1 : 0;
    const hasWard = bodyNames.has(item.name) ? 1 : 0;
    flags.set(item.code, { hasWard, isWard });
  }
  return flags;
}

function emitDecodeJs(): void {
  buildSync({
    entryPoints: [binaryEntry],
    outfile: resolve(dataDir, "decode.js"),
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: ["es2022"],
    logLevel: "warning",
  });
}

function writeDatasetJs(prefectureCodes: string[]): void {
  const lines = [
    "/** Auto-generated by scripts/generate.ts — do not edit. */",
    'import { readFileSync } from "node:fs";',
    'import { dirname, join } from "node:path";',
    'import { fileURLToPath } from "node:url";',
    'import index from "./index.json" with { type: "json" };',
    "import {",
    "  decodeMunicipalitiesFile,",
    "  decodePrefecturesFile,",
    '} from "./decode.js";',
    "",
    "const __dirname = dirname(fileURLToPath(import.meta.url));",
    "",
    "function readBin(relativePath) {",
    "  const bytes = readFileSync(join(__dirname, relativePath));",
    "  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);",
    "}",
    "",
    'const prefectures = decodePrefecturesFile(readBin("prefectures.bin"));',
    "",
    "const municipalitiesByCode = {",
    ...prefectureCodes.map((code) => {
      const pref = `prefectures.prefectures.find((p) => p.code === "${code}")`;
      return [
        `  "${code}": decodeMunicipalitiesFile(readBin("prefectures/${code}.bin"), {`,
        `    prefectureCode: "${code}",`,
        `    prefectureName: (${pref})?.name ?? "",`,
        `    prefectureNameKana: (${pref})?.nameKana ?? "",`,
        `  }),`,
      ].join("\n");
    }),
    "};",
    "",
    'const searchNgrams = new Uint8Array(readBin("search-ngrams.bin"));',
    "",
    "export { index, prefectures, municipalitiesByCode, searchNgrams };",
    "",
    "export function loadMunicipalities(code) {",
    '  const padded = String(code).padStart(2, "0");',
    "  const file = municipalitiesByCode[padded];",
    "  if (!file) {",
    "    return Promise.reject(new Error(`Unknown prefecture code: ${padded}`));",
    "  }",
    "  return Promise.resolve(file);",
    "}",
    "",
    "const dataset = { index, prefectures, municipalitiesByCode, loadMunicipalities, searchNgrams };",
    "export default dataset;",
    "",
  ];
  writeFileSync(resolve(dataDir, "dataset.js"), lines.join("\n"), "utf8");
}

async function main(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sourcePath);

  const [currentSheet, designatedSheet] = workbook.worksheets;
  if (!currentSheet || !designatedSheet) {
    throw new Error("Expected at least 2 sheets in the source workbook");
  }

  const currentRows = sheetToRows(currentSheet);
  const designatedRows = sheetToRows(designatedSheet);

  const prefectures: PrefectureRow[] = [];
  const municipalitiesByCode = new Map<string, LocalGov>();

  for (const row of currentRows) {
    if (!row.municipalityName) {
      prefectures.push(toPrefecture(row));
      continue;
    }
    municipalitiesByCode.set(row.code6, toMunicipality(row));
  }

  let addedWards = 0;
  for (const row of designatedRows) {
    if (!row.municipalityName) continue;
    if (municipalitiesByCode.has(row.code6)) continue;
    municipalitiesByCode.set(row.code6, toMunicipality(row));
    addedWards += 1;
  }

  const municipalities = [...municipalitiesByCode.values()].sort((a, b) =>
    a.code.localeCompare(b.code),
  );
  prefectures.sort((a, b) => a.code.localeCompare(b.code));

  const byPrefecture = new Map<string, LocalGov[]>();
  for (const m of municipalities) {
    const list = byPrefecture.get(m.prefectureCode);
    if (list) {
      list.push(m);
    } else {
      byPrefecture.set(m.prefectureCode, [m]);
    }
  }

  const asOf = "R6.1.1";
  const schemaVersion = 1;
  const generatedAt = new Date().toISOString();
  const prefectureCodes = prefectures.map((p) => p.code);

  cleanGeneratedArtifacts();
  emitDecodeJs();

  const prefecturesWithCounts = prefectures.map((p) => {
    const list = byPrefecture.get(p.code) ?? [];
    return {
      ...p,
      municipalityCounts: {
        both: filterByDesignatedCity(list, "both").length,
        city: filterByDesignatedCity(list, "city").length,
        ward: filterByDesignatedCity(list, "ward").length,
      },
    };
  });

  writeJson(resolve(dataDir, "index.json"), {
    schemaVersion,
    source: "000925835.xlsx",
    asOf,
    generatedAt,
    counts: {
      prefectures: prefectures.length,
      municipalities: municipalities.length,
      designatedCityWardsAdded: addedWards,
    },
    paths: {
      prefectures: "prefectures.bin",
      municipalitiesByPrefecture: "prefectures/{code}.bin",
      searchNgrams: "search-ngrams.bin",
    },
    prefectureCodes,
  });

  writeCsv(
    resolve(dataDir, "prefectures.csv"),
    [
      "prefCode",
      "name",
      "nameKana",
      "muniCode",
      "muniCountBoth",
      "muniCountCity",
      "muniCountWard",
    ],
    prefecturesWithCounts.map((p) => [
      Number(p.code),
      p.name,
      p.nameKana,
      Number(p.muniCode),
      p.municipalityCounts.both,
      p.municipalityCounts.city,
      p.municipalityCounts.ward,
    ]),
  );

  const prefBinRecords: PrefectureBinRecord[] = prefecturesWithCounts.map(
    (p) => ({
      prefCode: Number(p.code),
      name: p.name,
      nameKana: p.nameKana,
      muniCode: Number(p.muniCode),
      muniCountBoth: p.municipalityCounts.both,
      muniCountCity: p.municipalityCounts.city,
      muniCountWard: p.municipalityCounts.ward,
    }),
  );
  writeFileSync(
    resolve(dataDir, "prefectures.bin"),
    Buffer.from(encodePrefectures(prefBinRecords, { asOf })),
  );

  for (const code of prefectureCodes) {
    const list = byPrefecture.get(code) ?? [];
    const flags = wardFlagsForPrefecture(list);

    writeCsv(
      resolve(prefecturesDir, `${code}.csv`),
      ["code", "name", "nameKana", "hasWard", "isWard"],
      list.map((m) => {
        const f = flags.get(m.code) ?? { hasWard: 0, isWard: 0 };
        return [Number(m.code), m.name, m.nameKana, f.hasWard, f.isWard];
      }),
    );

    const muniBinRecords: MunicipalityBinRecord[] = list.map((m) => {
      const f = flags.get(m.code) ?? { hasWard: 0 as const, isWard: 0 as const };
      return {
        code: Number(m.code),
        name: m.name,
        nameKana: m.nameKana,
        hasWard: f.hasWard,
        isWard: f.isWard,
      };
    });
    writeFileSync(
      resolve(prefecturesDir, `${code}.bin`),
      Buffer.from(encodeMunicipalities(muniBinRecords, { asOf })),
    );
  }

  const ngramPostings = buildSearchNgramPostings(
    prefecturesWithCounts,
    byPrefecture,
  );
  writeCsv(
    resolve(dataDir, "search-ngrams.csv"),
    ["gram", "gramType", "kind", "muniCode", "prefCode", "hasWard", "isWard"],
    [...ngramPostings]
      .sort((a, b) =>
        a.gram !== b.gram
          ? a.gram < b.gram
            ? -1
            : 1
          : a.gramType !== b.gramType
            ? a.gramType - b.gramType
            : a.muniCode - b.muniCode,
      )
      .map((r) => [
        r.gram,
        r.gramType === GRAM_TYPE_NAME ? "name" : "kana",
        r.kind === KIND_PREF ? "pref" : "muni",
        r.muniCode,
        r.prefCode,
        r.hasWard,
        r.isWard,
      ]),
  );
  writeFileSync(
    resolve(dataDir, "search-ngrams.bin"),
    Buffer.from(encodeSearchNgrams(ngramPostings, { asOf })),
  );

  writeDatasetJs(prefectureCodes);

  // Sanity: dataset decode path works
  const prefBytes = readFileSync(resolve(dataDir, "prefectures.bin"));
  void prefBytes;

  console.log(`Wrote CSV + bin data under ${dataDir}`);
  console.log(
    `prefectures=${prefectures.length}, municipalities=${municipalities.length}, wardsAdded=${addedWards}, searchNgrams=${ngramPostings.length}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
