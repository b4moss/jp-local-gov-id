import type {
  LocalGov,
  LocalGovIndexFile,
  LocalGovMunicipalitiesFile,
  LocalGovPrefecturesFile,
  SearchNgramsPathSpec,
  SearchNgramsThreeGramSpec,
  SearchNgramsTwoGramSpec,
} from "./types";

/** Expected schemaVersion in data files. */
export const LOCAL_GOV_SCHEMA_VERSION = 1;

export class LocalGovSchemaError extends Error {
  override readonly name = "LocalGovSchemaError";

  constructor(message: string) {
    super(message);
  }
}

function isLocalGov(value: unknown): value is LocalGov {
  if (value === null || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.code === "string" &&
    typeof o.name === "string" &&
    typeof o.nameKana === "string" &&
    typeof o.prefectureCode === "string" &&
    typeof o.prefectureName === "string" &&
    typeof o.prefectureNameKana === "string"
  );
}

function assertSchemaVersion(value: unknown, label: string): number {
  if (typeof value !== "number") {
    throw new LocalGovSchemaError(
      `${label}: schemaVersion must be a number`,
    );
  }
  if (value !== LOCAL_GOV_SCHEMA_VERSION) {
    throw new LocalGovSchemaError(
      `Unsupported schemaVersion: expected ${LOCAL_GOV_SCHEMA_VERSION}, got ${String(value)}`,
    );
  }
  return value;
}

function asObject(data: unknown, label: string): Record<string, unknown> {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new LocalGovSchemaError(`${label} must be a non-null object`);
  }
  return data as Record<string, unknown>;
}

function validateTwoGramSpec(raw: unknown): SearchNgramsTwoGramSpec {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new LocalGovSchemaError(
      "Index paths.searchNgrams.twoGram must be an object",
    );
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.pattern !== "string" || !o.pattern.includes("{region}")) {
    throw new LocalGovSchemaError(
      "Index paths.searchNgrams.twoGram.pattern must contain {region}",
    );
  }
  if (
    !Array.isArray(o.regions) ||
    o.regions.length === 0 ||
    !o.regions.every((r) => typeof r === "string" && r.length > 0)
  ) {
    throw new LocalGovSchemaError(
      "Index paths.searchNgrams.twoGram.regions must be a non-empty string array",
    );
  }
  return { pattern: o.pattern, regions: o.regions as string[] };
}

function validateThreeGramSpec(raw: unknown): SearchNgramsThreeGramSpec {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new LocalGovSchemaError(
      "Index paths.searchNgrams.threeGram must be an object",
    );
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.pattern !== "string" || !o.pattern.includes("{shard}")) {
    throw new LocalGovSchemaError(
      "Index paths.searchNgrams.threeGram.pattern must contain {shard}",
    );
  }
  if (
    typeof o.shardCount !== "number" ||
    !Number.isInteger(o.shardCount) ||
    o.shardCount < 1
  ) {
    throw new LocalGovSchemaError(
      "Index paths.searchNgrams.threeGram.shardCount must be a positive integer",
    );
  }
  return { pattern: o.pattern, shardCount: o.shardCount };
}

function validateSearchNgramsPath(raw: unknown): SearchNgramsPathSpec {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new LocalGovSchemaError(
      "Index paths.searchNgrams must be an object with twoGram and threeGram",
    );
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
    throw new LocalGovSchemaError("Index must include a paths object");
  }
  const paths = obj.paths as Record<string, unknown>;
  if (
    typeof paths.prefectures !== "string" ||
    typeof paths.municipalitiesByPrefecture !== "string"
  ) {
    throw new LocalGovSchemaError(
      "Index paths must include string prefectures and municipalitiesByPrefecture",
    );
  }
  const searchNgrams = validateSearchNgramsPath(paths.searchNgrams);
  if (
    !Array.isArray(obj.prefectureCodes) ||
    !obj.prefectureCodes.every((c) => typeof c === "string")
  ) {
    throw new LocalGovSchemaError(
      "Index must include prefectureCodes as a string array",
    );
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

  if (!Array.isArray(obj.prefectures) || !obj.prefectures.every(isLocalGov)) {
    throw new LocalGovSchemaError(
      "Prefectures file must include a prefectures array of LocalGov objects",
    );
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
    throw new LocalGovSchemaError(
      "Municipalities file must include string prefectureCode",
    );
  }
  if (
    !Array.isArray(obj.municipalities) ||
    !obj.municipalities.every(isLocalGov)
  ) {
    throw new LocalGovSchemaError(
      "Municipalities file must include a municipalities array of LocalGov objects",
    );
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
    throw new LocalGovSchemaError(
      "Dataset must be a non-null object with index and prefectures",
    );
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

  throw new LocalGovSchemaError(
    "Dataset must include index and prefectures (and optionally municipalitiesByCode / loadMunicipalities)",
  );
}

function normalizeSearchNgramShards(
  raw: unknown,
): Record<string, ArrayBuffer | Uint8Array> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new LocalGovSchemaError(
      "Dataset searchNgramShards must be a Record of ArrayBuffer or Uint8Array",
    );
  }
  const out: Record<string, ArrayBuffer | Uint8Array> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(value instanceof ArrayBuffer || value instanceof Uint8Array)) {
      throw new LocalGovSchemaError(
        `Dataset searchNgramShards[${key}] must be ArrayBuffer or Uint8Array`,
      );
    }
    out[key] = value;
  }
  return out;
}
