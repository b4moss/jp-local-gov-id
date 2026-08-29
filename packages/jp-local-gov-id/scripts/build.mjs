#!/usr/bin/env node
/**
 * Multi-format library build for @b4moss/jp-local-gov-id (#65 / #67).
 * 1) ESM + CJS (+ d.ts) via vite.config.ts
 * 2) IIFE (CDN) via vite.cdn.config.ts
 * 3) IIFE minify (CDN) via vite.cdn.config.ts --mode minify
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const pkg = join(root, "..");

function run(args) {
  const result = spawnSync("npx", ["vite", ...args], {
    cwd: pkg,
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(["build"]);
run(["build", "--config", "vite.cdn.config.ts"]);
run(["build", "--config", "vite.cdn.config.ts", "--mode", "minify"]);
