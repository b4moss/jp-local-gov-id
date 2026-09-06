import type {
  LocalGov,
  LocalGovIndexFile,
  LocalGovMunicipalitiesFile,
  LocalGovPrefecturesFile,
  Municipality,
  Prefecture,
  SearchNgramsPathSpec,
  SearchNgramsThreeGramSpec,
  SearchNgramsTwoGramSpec,
} from "./types";
import { fmt, msg } from "./messages";

/** Expected schemaVersion in data files. */
export const LOCAL_GOV_SCHEMA_VERSION = 2;

export class LocalGovSchemaError extends Error {
  override readonly name = "LocalGovSchemaError";

  constructor(message: string) {
    super(message);
  }
}

function isPrefectureRecord(value: unknown): value is Prefecture {
  if (value === null || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if ("prefectureCode" in o || "prefectureName" in o || "prefectureNameKana" in o) {
    return false;
  }
  return (
    typeof o.code === "string" &&
    /^\d{6}$/.test(o.code) &&
    typeof o.name === "string" &&
    typeof o.nameKana === "string"
  );
}

function isMunicipalityRecord(value: unknown): value is Municipality {
  if (value === null || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.code === "string" &&
    /^\d{6}$/.test(o.code) &&
    typeof o.name === "string" &&
    typeof o.nameKana === "string" &&
    typeof o.prefectureCode === "string" &&
    typeof o.prefectureName === "string" &&
    typeof o.prefectureNameKana === "string"
  );
}

export function isLocalGov(value: unknown): value is LocalGov {
  return isPrefectureRecord(value) || isMunicipalityRecord(value);
}

function assertSchemaVersion(value: unknown, label: string): number {
  if (typeof value !== "number") {
    throw new LocalGovSchemaError(
      fmt("schema.versionMustBeNumber", { label }),
    );
  }
  if (value !== LOCAL_GOV_SCHEMA_VERSION) {
    throw new LocalGovSchemaError(
      fmt("schema.unsupportedVersion", {
        expected: LOCAL_GOV_SCHEMA_VERSION,
        got: String(value),
      }),
    );
  }
  return value;
}

function asObject(data: unknown, label: string): Record<string, unknown> {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new LocalGovSchemaError(fmt("schema.mustBeObject", { label }));
  }
  return data as Record<string, unknown>;
}

function validateTwoGramSpec(raw: unknown): SearchNgramsTwoGramSpec {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new LocalGovSchemaError(msg("schema.twoGramMustBeObject"));
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.pattern !== "string" || !o.pattern.includes("{region}")) {
    throw new LocalGovSchemaError(msg("schema.twoGramPatternRegion"));
  }
  if (
    !Array.isArray(o.regions) ||
    o.regions.length === 0 ||
    !o.regions.every((r) => typeof r === "string" && r.length > 0)
  ) {
    throw new LocalGovSchemaError(msg("schema.twoGramRegions"));
  }
  return { pattern: o.pattern, regions: o.regions as string[] };
}

function validateThreeGramSpec(raw: unknown): SearchNgramsThreeGramSpec {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new LocalGovSchemaError(msg("schema.threeGramMustBeObject"));
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.pattern !== "string" || !o.pattern.includes("{shard}")) {
    throw new LocalGovSchemaError(msg("schema.threeGramPatternShard"));
  }
  if (
    typeof o.shardCount !== "number" ||
    !Number.isInteger(o.shardCount) ||
    o.shardCount < 1
  ) {
    throw new LocalGovSchemaError(msg("schema.threeGramShardCount"));
  }
  return { pattern: o.pattern, shardCount: o.shardCount };
}

function validateSearchNgramsPath(raw: unknown): SearchNgramsPathSpec {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new LocalGovSchemaError(msg("schema.searchNgramsObject"));
  }
  const o = raw as Record<string, unknown>;
  return {
    twoGram: validateTwoGramSpec(o.twoGram),
    threeGram: validateThreeGramSpec(o.threeGram),
  };
}

/** Validates `index.json`. */
export function validateIndexFile(data: unknown): LocalGovIndexFile {
  const obj = asObject(data, "Index");
  const schemaVersion = assertSchemaVersion(obj.schemaVersion, "Index");

  if (
    obj.paths === null ||
    typeof obj.paths !== "object" ||
    Array.isArray(obj.paths)
  ) {
    throw new LocalGovSchemaError(msg("schema.indexPathsObject"));
  }
  const paths = obj.paths as Record<string, unknown>;
  if (
    typeof paths.prefectures !== "string" ||
    typeof paths.municipalitiesByPrefecture !== "string"
  ) {
    throw new LocalGovSchemaError(msg("schema.indexPathsPrefectures"));
  }
  const searchNgrams = validateSearchNgramsPath(paths.searchNgrams);
  if (
    !Array.isArray(obj.prefectureCodes) ||
    !obj.prefectureCodes.every((c) => typeof c === "string")
  ) {
    throw new LocalGovSchemaError(msg("schema.indexPrefectureCodes"));
  }

  return {
    schemaVersion,
    source: typeof obj.source === "string" ? obj.source : undefined,
    asOf: typeof obj.asOf === "string" ? obj.asOf : undefined,
    generatedAt:
      typeof obj.generatedAt === "string" ? obj.generatedAt : undefined,
    counts:
      obj.counts !== undefined &&
      obj.counts !== null &&
      typeof obj.counts === "object" &&
      !Array.isArray(obj.counts)
        ? (obj.counts as LocalGovIndexFile["counts"])
        : undefined,
    paths: {
      prefectures: paths.prefectures,
      municipalitiesByPrefecture: paths.municipalitiesByPrefecture,
      searchNgrams,
    },
    prefectureCodes: obj.prefectureCodes as string[],
  };
}

/** Validates the prefectures envelope (decoded from `prefectures.bin` in `url` mode). */
export function validatePrefecturesFile(
  data: unknown,
): LocalGovPrefecturesFile {
  const obj = asObject(data, "Prefectures file");
  const schemaVersion = assertSchemaVersion(obj.schemaVersion, "Prefectures file");

  if (
    !Array.isArray(obj.prefectures) ||
    !obj.prefectures.every(isPrefectureRecord)
  ) {
    throw new LocalGovSchemaError(msg("schema.prefecturesArray"));
  }

  return {
    schemaVersion,
    asOf: typeof obj.asOf === "string" ? obj.asOf : undefined,
    prefectures: obj.prefectures,
  };
}

/** Validates the per-prefecture municipalities envelope (decoded from `prefectures/{code}.bin` in `url` mode). */
export function validateMunicipalitiesFile(
  data: unknown,
): LocalGovMunicipalitiesFile {
  const obj = asObject(data, "Municipalities file");
  const schemaVersion = assertSchemaVersion(
    obj.schemaVersion,
    "Municipalities file",
  );

  if (typeof obj.prefectureCode !== "string") {
    throw new LocalGovSchemaError(msg("schema.municipalitiesPrefectureCode"));
  }
  if (
    !Array.isArray(obj.municipalities) ||
    !obj.municipalities.every(isMunicipalityRecord)
  ) {
    throw new LocalGovSchemaError(msg("schema.municipalitiesArray"));
  }

  return {
    schemaVersion,
    asOf: typeof obj.asOf === "string" ? obj.asOf : undefined,
    prefectureCode: obj.prefectureCode,
    municipalities: obj.municipalities,
  };
}

/**
 * Normalize `createLocalGovClient({ data })` input into index + prefectures + loader pieces.
 */
export function normalizeDatasetInput(data: unknown): {
  index: unknown;
  prefectures: unknown;
  municipalitiesByCode?: Record<string, unknown>;
  loadMunicipalities?: (code: string) => unknown | Promise<unknown>;
  searchNgramShards?: Record<string, ArrayBuffer | Uint8Array>;
} {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new LocalGovSchemaError(msg("schema.datasetObject"));
  }

  const obj = data as Record<string, unknown>;

  if ("index" in obj && "prefectures" in obj) {
    return {
      index: obj.index,
      prefectures: obj.prefectures,
      municipalitiesByCode:
        obj.municipalitiesByCode !== undefined &&
        obj.municipalitiesByCode !== null &&
        typeof obj.municipalitiesByCode === "object" &&
        !Array.isArray(obj.municipalitiesByCode)
          ? (obj.municipalitiesByCode as Record<string, unknown>)
          : undefined,
      loadMunicipalities:
        typeof obj.loadMunicipalities === "function"
          ? (obj.loadMunicipalities as (
              code: string,
            ) => unknown | Promise<unknown>)
          : undefined,
      searchNgramShards: normalizeSearchNgramShards(obj.searchNgramShards),
    };
  }

  throw new LocalGovSchemaError(msg("schema.datasetIndexPrefectures"));
}

function normalizeSearchNgramShards(
  raw: unknown,
): Record<string, ArrayBuffer | Uint8Array> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new LocalGovSchemaError(msg("schema.searchNgramShardsRecord"));
  }
  const out: Record<string, ArrayBuffer | Uint8Array> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(value instanceof ArrayBuffer || value instanceof Uint8Array)) {
      throw new LocalGovSchemaError(
        fmt("schema.searchNgramShardsEntry", { key }),
      );
    }
    out[key] = value;
  }
  return out;
}
