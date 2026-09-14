import assert from "node:assert/strict";
import test from "node:test";
import {
  PLAYGROUND_CHUNK_PREFIX,
  rewriteChunkRelativeImports,
} from "./chunkImports.ts";

test("rewriteChunkRelativeImports rewrites static and dynamic relative chunk imports", () => {
  const input = `
import { a } from "./normalize-DYIGFfYl.js";
export { b } from "./searchNgrams-DfpP9yGT.js";
const m = await import("./api.search-C2LL0x3T.js");
import "brotli-wasm";
import { x } from "@b4moss/cachian";
`;
  const out = rewriteChunkRelativeImports(input);
  assert.match(
    out,
    new RegExp(`from "${PLAYGROUND_CHUNK_PREFIX}normalize-DYIGFfYl\\.js"`),
  );
  assert.match(
    out,
    new RegExp(`from "${PLAYGROUND_CHUNK_PREFIX}searchNgrams-DfpP9yGT\\.js"`),
  );
  assert.match(
    out,
    new RegExp(
      `import\\("${PLAYGROUND_CHUNK_PREFIX}api\\.search-C2LL0x3T\\.js"\\)`,
    ),
  );
  assert.match(out, /import "brotli-wasm"/);
  assert.match(out, /from "@b4moss\/cachian"/);
  assert.doesNotMatch(out, /from "\.\/normalize/);
});
