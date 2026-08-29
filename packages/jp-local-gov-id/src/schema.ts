import type {
  LocalGov,
  LocalGovIndexFile,
  LocalGovMunicipalitiesFile,
  LocalGovPrefecturesFile,
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
    typeof paths.municipalitiesByPrefecture !== "string" ||
    typeof paths.searchNgrams !== "string"
  ) {
    throw new LocalGovSchemaError(
      "Index paths must include string prefectures, municipalitiesByPrefecture, and searchNgrams",
    );
  }
  if (!Array.isArray(obj.prefectureCodes) || !obj.prefectureCodes.every((c) => typeof c === "string")) {
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
      searchNgrams: paths.searchNgrams,
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
  searchNgrams?: ArrayBuffer | Uint8Array;
} {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new LocalGovSchemaError(
      "Dataset must be a non-null object with index and prefectures",
    );
  }

  const obj = data as Record<string, unknown>;

  // Namespace / default export shape: { index, prefectures, ... }
  if ("index" in obj && "prefectures" in obj) {
    const rawNgrams = obj.searchNgrams;
    let searchNgrams: ArrayBuffer | Uint8Array | undefined;
    if (rawNgrams instanceof ArrayBuffer || rawNgrams instanceof Uint8Array) {
      searchNgrams = rawNgrams;
    } else if (rawNgrams !== undefined && rawNgrams !== null) {
      throw new LocalGovSchemaError(
        "Dataset searchNgrams must be ArrayBuffer or Uint8Array when provided",
      );
    }

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
          ? (obj.loadMunicipalities as (code: string) => unknown | Promise<unknown>)
          : undefined,
      searchNgrams,
    };
  }

  // Bare index.json shape is not enough without prefectures
  throw new LocalGovSchemaError(
    "Dataset must include index and prefectures (and optionally municipalitiesByCode / loadMunicipalities)",
  );
}
