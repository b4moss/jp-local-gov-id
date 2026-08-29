import type { LocalGovClient } from "@b4moss/jp-local-gov-id";
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";

let clientPromise: Promise<LocalGovClient> | null = null;

/**
 * Browser demos use `url` mode against static `.bin.br` under /jp-local-gov-id-data/
 * (prepared by `site/scripts/prepare-data.mjs`). Avoids bundling Node-only dataset.js.
 * Pass an absolute URL so sibling `.bin.br` paths resolve (URL constructor needs a base).
 */
export function useLocalGovClient() {
  if (!clientPromise) {
    const indexPath = "/jp-local-gov-id-data/index.json";
    const url =
      typeof window !== "undefined"
        ? new URL(indexPath, window.location.origin).href
        : indexPath;
    clientPromise = createLocalGovClient({
      url,
      cache: false,
    });
  }
  return clientPromise;
}
