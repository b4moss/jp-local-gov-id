#!/usr/bin/env node
/**
 * Measure the tree-shaken, minified createLocalGovClient browser graph (#93).
 * Primary metric: initial-load minify raw (entry + statically imported chunks).
 * Dynamically imported chunks (search / cache) are reported as reference values.
 * Does not fail on size thresholds.
 *
 * Usage:
 *   node ./scripts/measure-client-bundle.mjs
 *   node ./scripts/measure-client-bundle.mjs --meta
 */
import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { buildSync } = require("esbuild");

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(pkgRoot, "src", "create.ts");
const showMeta = process.argv.includes("--meta");

const common = {
  bundle: true,
  platform: "browser",
  format: "esm",
  minify: true,
  write: false,
  external: ["brotli-wasm", "node:zlib"],
  logLevel: "silent",
  metafile: true,
  splitting: true,
  outdir: "/tmp/jp-local-gov-id-measure-out",
};

/**
 * Collect output paths reachable from entry via static imports only.
 * Dynamic-import edges are treated as deferred chunk boundaries.
 */
function initialOutputPaths(metafile) {
  const outputs = metafile.outputs;
  const entryOut = Object.keys(outputs).find((k) => outputs[k].entryPoint);
  if (!entryOut) return new Set(Object.keys(outputs));

  const reachable = new Set();
  const queue = [entryOut];
  while (queue.length) {
    const cur = queue.pop();
    if (reachable.has(cur)) continue;
    reachable.add(cur);
    const info = outputs[cur];
    if (!info?.imports) continue;
    for (const imp of info.imports) {
      if (imp.kind === "dynamic-import") continue;
      if (imp.path && outputs[imp.path]) queue.push(imp.path);
    }
  }
  return reachable;
}

function classifyDeferred(filePath, text) {
  const lower = `${filePath}\n${text}`.toLowerCase();
  if (
    lower.includes("collectnationwideviaindex") ||
    lower.includes("createhybridsearchindexloader") ||
    lower.includes("createdatasetsearchindexloader") ||
    lower.includes("querysearchindex") ||
    lower.includes("messages.search")
  ) {
    return "search";
  }
  if (
    lower.includes("@b4moss/cachian") ||
    lower.includes("cachian") ||
    /createlocalgovcache|keyprefix|localstoragedriver/.test(lower)
  ) {
    return "cache";
  }
  return "other";
}

function findOutputFile(outputFiles, outPath) {
  const base = basename(outPath);
  return (
    outputFiles.find((f) => f.path.replace(/\\/g, "/").endsWith(outPath.replace(/\\/g, "/"))) ||
    outputFiles.find((f) => f.path.endsWith(base)) ||
    null
  );
}

function summarize(label, result) {
  const outputFiles = result.outputFiles ?? [];
  if (outputFiles.length === 0) {
    console.error(`[measure-client-bundle] No output for ${label}`);
    process.exit(1);
  }

  const metaOutputs = result.metafile.outputs;
  const initialPaths = initialOutputPaths(result.metafile);

  let initialRaw = 0;
  const initialFiles = [];
  for (const outPath of initialPaths) {
    const f = findOutputFile(outputFiles, outPath);
    if (!f) continue;
    initialRaw += f.contents.byteLength;
    initialFiles.push({ outPath, bytes: f.contents.byteLength, file: f });
  }

  // gzip of concatenated initial bytes (approx of multi-chunk transfer)
  const initialBuf = Buffer.concat(initialFiles.map((x) => Buffer.from(x.file.contents)));
  const initialGzip = gzipSync(initialBuf).byteLength;

  const deferred = { search: 0, cache: 0, other: 0 };
  for (const [outPath, info] of Object.entries(metaOutputs)) {
    if (initialPaths.has(outPath)) continue;
    const f = findOutputFile(outputFiles, outPath);
    if (!f) continue;
    const text = Buffer.from(f.contents).toString("utf8");
    const kind = classifyDeferred(outPath, text);
    deferred[kind] += f.contents.byteLength;
  }

  console.log(`\n=== ${label} ===`);
  console.log("initial load minify raw:", initialRaw);
  console.log("initial load minify gzip:", initialGzip);
  console.log("initial output files:", initialFiles.length);
  if (deferred.search > 0) console.log("search chunk(s) minify raw (ref):", deferred.search);
  if (deferred.cache > 0) console.log("cache chunk(s) minify raw (ref):", deferred.cache);
  if (deferred.other > 0) console.log("other deferred chunk(s) minify raw (ref):", deferred.other);
  console.log("total output files:", outputFiles.length);

  if (showMeta) {
    // Aggregate bytesInOutput across all initial output files' inputs
    const groups = new Map();
    for (const outPath of initialPaths) {
      const inputs = metaOutputs[outPath]?.inputs ?? {};
      for (const [path, info] of Object.entries(inputs)) {
        const n = info.bytesInOutput ?? 0;
        if (!n) continue;
        let key = path;
        if (path.includes("/src/")) key = "src/" + path.split("/src/")[1];
        else if (path.includes("node_modules/"))
          key = "nm:" + path.split("node_modules/").pop();
        groups.set(key, (groups.get(key) || 0) + n);
      }
    }
    console.log("--meta top modules in initial load (bytesInOutput):");
    [...groups.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .forEach(([k, v]) => console.log(`  ${String(v).padStart(6)}  ${k}`));
  }

  return { initialRaw, initialGzip, deferred };
}

const named = buildSync({
  ...common,
  stdin: {
    contents: `export { createLocalGovClient } from ${JSON.stringify("./src/create.ts")};`,
    resolveDir: pkgRoot,
    sourcefile: "measure-entry.ts",
  },
});
summarize("createLocalGovClient (named export entry)", named);

const full = buildSync({
  ...common,
  entryPoints: [entry],
});
summarize("create.ts full entry", full);
