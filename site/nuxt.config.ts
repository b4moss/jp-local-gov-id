import { copyFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gt, valid } from "semver";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function readPackageVersion(relativePath: string) {
  const pkg = JSON.parse(
    readFileSync(join(rootDir, relativePath), "utf8"),
  ) as { version: string };
  return pkg.version;
}

/** Prefer the newer of npm `latest` and `rc` (RC-inclusive latest). */
function pickLatestIncludingRc(versions: Array<string | undefined>): string | null {
  let best: string | null = null;
  for (const raw of versions) {
    if (!raw || !valid(raw)) continue;
    if (!best || gt(raw, best)) best = raw;
  }
  return best;
}

async function resolveNpmLatestIncludingRc(
  packageName: string,
  fallback: string,
): Promise<string> {
  try {
    const res = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
    );
    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      "dist-tags"?: Record<string, string>;
    };
    const tags = data["dist-tags"] ?? {};
    return pickLatestIncludingRc([tags.latest, tags.rc]) ?? fallback;
  } catch {
    return fallback;
  }
}

const packageAppVersion = readPackageVersion(
  "packages/jp-local-gov-id/package.json",
);
const packageDataVersion = readPackageVersion(
  "packages/jp-local-gov-id-data/package.json",
);

const appVersion = await resolveNpmLatestIncludingRc(
  "@b4moss/jp-local-gov-id",
  packageAppVersion,
);
const dataVersion = await resolveNpmLatestIncludingRc(
  "@b4moss/jp-local-gov-id-data",
  packageDataVersion,
);

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    "@nuxt/content",
    "@nuxtjs/i18n",
    "@nuxtjs/color-mode",
    "@nuxt/scripts",
  ],
  devtools: { enabled: true },
  compatibilityDate: "2024-04-03",
  css: ["~/assets/css/main.css"],
  runtimeConfig: {
    public: {
      appVersion,
      dataVersion,
    },
  },
  // GTM: set NUXT_PUBLIC_SCRIPTS_GOOGLE_TAG_MANAGER_ID=GTM-XXXXXXX (build-time for SSG).
  // Empty / unset → tagging stays disabled (see plugins/google-tag-manager.client.ts).
  // bundle: false → always load live gtm.js from Google (Tag Assistant / publish 即反映).
  scripts: {
    registry: {
      googleTagManager: {
        bundle: false,
      },
    },
  },
  colorMode: {
    preference: "system",
    fallback: "light",
    classSuffix: "",
  },
  content: {
    // Avoid better-sqlite3 native bindings on Netlify CI (Node 22+)
    experimental: { sqliteConnector: "native" },
    build: {
      markdown: {
        highlight: {
          theme: {
            default: "github-light",
            dark: "github-dark",
          },
        },
      },
    },
  },
  app: {
    head: {
      link: [
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
        },
      ],
    },
  },
  i18n: {
    locales: [
      { code: "ja", name: "日本語", language: "ja-JP", file: "ja.json" },
      { code: "en", name: "English", language: "en-US", file: "en.json" },
    ],
    defaultLocale: "ja",
    strategy: "prefix",
    lazy: true,
    langDir: "locales",
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "i18n_redirected",
      redirectOn: "root",
      fallbackLocale: "ja",
    },
    bundle: {
      optimizeTranslationDirective: false,
    },
  },
  // public/index.html would shadow `/` in `nuxt dev` and block Nitro middleware.
  // Copy the static locale redirect page into the generate output instead.
  hooks: {
    "nitro:build:public-assets"(nitro) {
      copyFileSync(
        join(nitro.options.rootDir, "locale-root.html"),
        join(nitro.options.output.publicDir, "index.html"),
      );
    },
  },
  nitro: {
    preset: "static",
    prerender: {
      crawlLinks: true,
      routes: [
        "/ja",
        "/en",
        "/ja/playground",
        "/en/playground",
        "/ja/installation",
        "/en/installation",
        "/ja/usage",
        "/en/usage",
        "/ja/examples",
        "/en/examples",
        "/ja/examples/address-input",
        "/en/examples/address-input",
        "/ja/examples/municipality-validation",
        "/en/examples/municipality-validation",
        "/ja/examples/nationwide-municipalities",
        "/en/examples/nationwide-municipalities",
        "/ja/contribute",
        "/en/contribute",
      ],
    },
  },
})
