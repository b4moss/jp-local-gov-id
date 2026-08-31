export type SiteSoftwareMeta = {
  name: string;
  codeRepository: string;
  license: string;
  programmingLanguage: string[];
};

export type SiteMeta = {
  siteName: string;
  siteUrl: string;
  siteVersion: string;
  description: string;
  githubUrl: string;
  footerText: string;
  software: SiteSoftwareMeta;
  /** Authored Organization properties; null disables the entity entirely. */
  organization: Record<string, unknown> | null;
  /** Raw JSON-LD entities appended to every page. */
  jsonLdExtra: Record<string, unknown>[];
};

export const defaultSiteMeta: SiteMeta = {
  siteName: "jp-local-gov-id",
  siteUrl: "https://jplocalgov.oss.b4m.jp",
  siteVersion: "",
  description: "Documentation for the jp-local-gov-id library",
  githubUrl: "https://github.com/b4moss/jp-local-gov-id",
  footerText: "MIT License · 2026 Bicycle for Mind LLC.",
  software: {
    name: "jp-local-gov-id",
    codeRepository: "https://github.com/b4moss/jp-local-gov-id",
    license: "MIT",
    programmingLanguage: ["TypeScript"],
  },
  organization: null,
  jsonLdExtra: [],
};

type RawSiteMeta = Partial<Omit<SiteMeta, "software">> & {
  software?: Partial<SiteSoftwareMeta>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeSiteMeta(raw: RawSiteMeta | null | undefined): SiteMeta {
  const base = { ...defaultSiteMeta, ...(raw || {}) };
  const siteName = String(base.siteName || defaultSiteMeta.siteName);
  const githubUrl = String(base.githubUrl || defaultSiteMeta.githubUrl);
  const softwareRaw = raw?.software || {};

  return {
    siteName,
    siteUrl: String(base.siteUrl || defaultSiteMeta.siteUrl).replace(/\/$/, ""),
    siteVersion: String(base.siteVersion ?? ""),
    description: String(base.description ?? ""),
    githubUrl,
    footerText: String(base.footerText || defaultSiteMeta.footerText),
    software: {
      name: String(softwareRaw.name || siteName),
      codeRepository: String(softwareRaw.codeRepository || githubUrl),
      license: String(softwareRaw.license || defaultSiteMeta.software.license),
      programmingLanguage: Array.isArray(softwareRaw.programmingLanguage)
        ? softwareRaw.programmingLanguage.map(String)
        : [],
    },
    organization: isPlainObject(raw?.organization)
      ? (raw.organization as Record<string, unknown>)
      : null,
    jsonLdExtra: Array.isArray(raw?.jsonLdExtra)
      ? (raw.jsonLdExtra as Record<string, unknown>[])
      : [],
  };
}
