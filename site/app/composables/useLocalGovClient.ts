import type { LocalGovClient } from "@b4moss/jp-local-gov-id";
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";

let clientPromise: Promise<LocalGovClient> | null = null;

/**
 * Browser demos use `url` mode against static `.bin.br` under /jp-local-gov-id-data/
 * (prepared by `site/scripts/prepare-data.mjs`). Avoids bundling Node-only dataset.js.
 */
export function useLocalGovClient() {
  if (!clientPromise) {
    clientPromise = createLocalGovClient({
      url: "/jp-local-gov-id-data/index.json",
      cache: false,
    });
  }
  return clientPromise;
}
