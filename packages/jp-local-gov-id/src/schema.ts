import type {
  LocalGov,
  LocalGovIndexFile,
  LocalGovMunicipalitiesFile,
  LocalGovPrefecturesFile,
  Municipality,
  Prefecture,
} from "./types";

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
    typeof paths.municipalitiesByPrefecture !== "string"
  ) {
    throw new LocalGovSchemaError(
      "Index paths must include string prefectures and municipalitiesByPrefecture",
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
    },
    prefectureCodes: obj.prefectureCodes as string[],
  };
}

/** Validates `prefectures.json`. */
export function validatePrefecturesFile(
  data: unknown,
): LocalGovPrefecturesFile {
  const obj = asObject(data, "Prefectures file");
  const schemaVersion = assertSchemaVersion(obj.schemaVersion, "Prefectures file");

  if (
    !Array.isArray(obj.prefectures) ||
    !obj.prefectures.every(isPrefectureRecord)
  ) {
    throw new LocalGovSchemaError(
      "Prefectures file must include a prefectures array of Prefecture objects",
    );
  }

  return {
    schemaVersion,
    asOf: typeof obj.asOf === "string" ? obj.asOf : undefined,
    prefectures: obj.prefectures,
  };
}

/** Validates `prefectures/{code}.json`. */
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
    !obj.municipalities.every(isMunicipalityRecord)
  ) {
    throw new LocalGovSchemaError(
      "Municipalities file must include a municipalities array of Municipality objects",
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
} {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new LocalGovSchemaError(
      "Dataset must be a non-null object with index and prefectures",
    );
  }

  const obj = data as Record<string, unknown>;

  // Namespace / default export shape: { index, prefectures, ... }
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
          ? (obj.loadMunicipalities as (code: string) => unknown | Promise<unknown>)
          : undefined,
    };
  }

  // Bare index.json shape is not enough without prefectures
  throw new LocalGovSchemaError(
    "Dataset must include index and prefectures (and optionally municipalitiesByCode / loadMunicipalities)",
  );
}
