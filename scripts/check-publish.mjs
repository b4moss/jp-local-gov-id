#!/usr/bin/env node
/**
 * Local preflight for npm publish + provenance.
 * Cannot fully simulate Sigstore/OIDC, but catches empty/mismatched repository.url
 * and verifies the packed tarball still contains the expected field.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const require = createRequire(import.meta.url);

const EXPECTED_REPO_URL = "https://github.com/b4moss/jp-local-gov-id";

const packages = [
  {
    name: "@b4moss/jp-local-gov-id-data",
    dir: "packages/jp-local-gov-id-data",
    directory: "packages/jp-local-gov-id-data",
  },
  {
    name: "@b4moss/jp-local-gov-id",
    dir: "packages/jp-local-gov-id",
    directory: "packages/jp-local-gov-id",
  },
];

function fail(message) {
  console.error(`✖ ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`✔ ${message}`);
}

function checkPackageJson(pkg) {
  const path = join(root, pkg.dir, "package.json");
  const json = require(path);
  const url = json.repository?.url ?? "";
  const directory = json.repository?.directory ?? "";

  if (url !== EXPECTED_REPO_URL) {
    fail(
      `${pkg.name}: repository.url must be exactly "${EXPECTED_REPO_URL}" (got "${url}")`,
    );
    return;
  }
  if (directory !== pkg.directory) {
    fail(
      `${pkg.name}: repository.directory must be "${pkg.directory}" (got "${directory}")`,
    );
    return;
  }
  ok(`${pkg.name}: package.json repository looks good`);
}

function checkPackedTarball(pkg) {
  const cwd = join(root, pkg.dir);
  const out = execFileSync("npm", ["pack", "--json", "--dry-run"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  // npm pack --json --dry-run prints notices to stderr and JSON to stdout;
  // some npm versions mix them. Prefer parsing last JSON array.
  const start = out.indexOf("[");
  const end = out.lastIndexOf("]");
  if (start < 0 || end < 0) {
    fail(`${pkg.name}: could not parse npm pack --json output`);
    return;
  }

  const meta = JSON.parse(out.slice(start, end + 1));
  const entry = meta[0];
  if (!entry?.filename) {
    fail(`${pkg.name}: npm pack --json missing filename`);
    return;
  }

  // Actually create a real pack to inspect package.json inside the tarball
  const tmp = mkdtempSync(join(tmpdir(), "jp-local-gov-pack-"));
  try {
    const packOut = execFileSync("npm", ["pack", "--pack-destination", tmp], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const tgzName = packOut.trim().split("\n").at(-1)?.trim();
    if (!tgzName) {
      fail(`${pkg.name}: npm pack produced no tarball name`);
      return;
    }
    const tgzPath = join(tmp, tgzName);
    execFileSync("tar", ["-xzf", tgzPath, "-C", tmp], { stdio: "ignore" });
    const packed = JSON.parse(
      readFileSync(join(tmp, "package", "package.json"), "utf8"),
    );
    const url = packed.repository?.url ?? "";
    if (url !== EXPECTED_REPO_URL) {
      fail(
        `${pkg.name}: packed package.json repository.url is "${url}" (expected "${EXPECTED_REPO_URL}")`,
      );
      return;
    }
    ok(`${pkg.name}: packed tarball repository.url is correct`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(`Expected repository.url: ${EXPECTED_REPO_URL}\n`);

for (const pkg of packages) {
  checkPackageJson(pkg);
  if (process.exitCode) continue;
  checkPackedTarball(pkg);
}

if (process.exitCode) {
  console.error("\nPublish preflight failed.");
  process.exit(process.exitCode);
}

console.log(`
Publish preflight passed.

Notes:
- This does NOT fully simulate GitHub OIDC / Sigstore provenance.
- For a dry-run publish (no upload): 
    npm publish --dry-run --access public
  inside each package directory.
- Real provenance checks only happen on npm registry during CI publish.
`);
