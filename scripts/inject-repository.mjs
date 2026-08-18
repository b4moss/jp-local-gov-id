#!/usr/bin/env node
/**
 * Force-write repository metadata before npm pack/publish.
 * Provenance requires repository.url to match the GitHub OIDC repo URL.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED_REPO_URL = "https://github.com/b4moss/jp-local-gov-id";

const targetDir = process.argv[2];
if (!targetDir) {
  console.error("Usage: node scripts/inject-repository.mjs <package-dir>");
  process.exit(1);
}

const packageJsonPath = resolve(targetDir, "package.json");
const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));

const directory = targetDir.replace(/^\.\//, "").replace(/\\/g, "/");

pkg.repository = {
  type: "git",
  url: EXPECTED_REPO_URL,
  directory,
};

writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`Wrote repository to ${packageJsonPath}`);
console.log(JSON.stringify(pkg.repository, null, 2));
