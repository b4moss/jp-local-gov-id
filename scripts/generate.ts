import {
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { filterByDesignatedCity } from "../packages/jp-local-gov-id/src/designatedCity.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const sourcePath = resolve(root, "resources/000925835.xlsx");
const dataDir = resolve(root, "packages/jp-local-gov-id-data");
const prefecturesDir = resolve(dataDir, "prefectures");

type LocalGov = {
  code: string;
  name: string;
  nameKana: string;
  prefectureCode: string;
  prefectureName: string;
  prefectureNameKana: string;
};

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

function toPrefecture(row: RawRow): LocalGov {
  const prefectureCode = toPrefectureCode(row.code6);
  return {
    code: prefectureCode,
    name: row.prefectureName,
    nameKana: row.prefectureNameKana,
    prefectureCode,
    prefectureName: row.prefectureName,
    prefectureNameKana: row.prefectureNameKana,
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

async function main(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sourcePath);

  const [currentSheet, designatedSheet] = workbook.worksheets;
  if (!currentSheet || !designatedSheet) {
    throw new Error("Expected at least 2 sheets in the source workbook");
  }

  const currentRows = sheetToRows(currentSheet);
  const designatedRows = sheetToRows(designatedSheet);

  const prefectures: LocalGov[] = [];
  const municipalitiesByCode = new Map<string, LocalGov>();

  for (const row of currentRows) {
    if (!row.municipalityName) {
      prefectures.push(toPrefecture(row));
      continue;
    }
    municipalitiesByCode.set(row.code6, toMunicipality(row));
  }

  // 政令市の区のみ追加（市本体はシート1と重複するためスキップ）
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

  mkdirSync(dataDir, { recursive: true });
  mkdirSync(prefecturesDir, { recursive: true });

  for (const name of readdirSync(prefecturesDir)) {
    if (name.endsWith(".json")) {
      rmSync(resolve(prefecturesDir, name));
    }
  }
  try {
    rmSync(resolve(dataDir, "local-govs.json"));
  } catch {
    // ignore if missing
  }

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
      prefectures: "prefectures.json",
      municipalitiesByPrefecture: "prefectures/{code}.json",
    },
    prefectureCodes,
  });

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

  writeJson(resolve(dataDir, "prefectures.json"), {
    schemaVersion,
    asOf,
    prefectures: prefecturesWithCounts,
  });

  for (const code of prefectureCodes) {
    writeJson(resolve(prefecturesDir, `${code}.json`), {
      schemaVersion,
      asOf,
      prefectureCode: code,
      municipalities: byPrefecture.get(code) ?? [],
    });
  }

  const loaderLines = [
    "/** Auto-generated by scripts/generate.ts — do not edit. */",
    ...prefectureCodes.map(
      (code) =>
        `import m${code} from "./prefectures/${code}.json" with { type: "json" };`,
    ),
    "",
    'import index from "./index.json" with { type: "json" };',
    'import prefectures from "./prefectures.json" with { type: "json" };',
    "",
    "const municipalitiesByCode = {",
    ...prefectureCodes.map((code) => `  "${code}": m${code},`),
    "};",
    "",
    "export { index, prefectures, municipalitiesByCode };",
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
    "const dataset = { index, prefectures, municipalitiesByCode, loadMunicipalities };",
    "export default dataset;",
    "",
  ];
  writeFileSync(resolve(dataDir, "dataset.js"), loaderLines.join("\n"), "utf8");

  console.log(`Wrote split data under ${dataDir}`);
  console.log(
    `prefectures=${prefectures.length}, municipalities=${municipalities.length}, wardsAdded=${addedWards}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
