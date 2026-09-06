#!/usr/bin/env node
/**
 * Measure the tree-shaken, minified createLocalGovClient browser graph (#93).
 * Reports raw minify bytes (and gzip). Does not fail on size thresholds.
 */
import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { buildSync } = require("esbuild");

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(pkgRoot, "src", "create.ts");

const result = buildSync({
  entryPoints: [entry],
  bundle: true,
  platform: "browser",
  format: "esm",
  minify: true,
  write: false,
  // Keep createLocalGovClient; drop other create.ts locals that are unused.
  mainFields: ["module", "main"],
  conditions: ["import", "module", "browser", "default"],
  external: ["brotli-wasm", "node:zlib"],
  logLevel: "silent",
  metafile: true,
});

const out = result.outputFiles[0];
if (!out) {
  console.error("[measure-client-bundle] No output from esbuild");
  process.exit(1);
}

const raw = out.contents.byteLength;
const gzip = gzipSync(out.contents).byteLength;

// Prefer named export surface: rewrite entry to only export createLocalGovClient
// when measuring the public create graph (tree-shake siblings in create.ts).
const named = buildSync({
  stdin: {
    contents: `export { createLocalGovClient } from ${JSON.stringify(entry)};`,
    resolveDir: pkgRoot,
    sourcefile: "measure-entry.ts",
  },
  bundle: true,
  platform: "browser",
  format: "esm",
  minify: true,
  write: false,
  external: ["brotli-wasm", "node:zlib"],
  logLevel: "silent",
});

const namedOut = named.outputFiles[0];
const namedRaw = namedOut?.contents.byteLength ?? raw;
const namedGzip = namedOut ? gzipSync(namedOut.contents).byteLength : gzip;

console.log("createLocalGovClient minify raw (named export entry):", namedRaw);
console.log("createLocalGovClient minify gzip (named export entry):", namedGzip);
console.log("create.ts full entry minify raw:", raw);
console.log("create.ts full entry minify gzip:", gzip);
