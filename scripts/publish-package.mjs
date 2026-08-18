#!/usr/bin/env node
/**
 * Prepare a clean publish directory and optionally publish.
 *
 * Usage:
 *   node scripts/publish-package.mjs <package-dir> [--dry-run]
 *
 * Always rewrites repository.url to the canonical GitHub URL before packing,
 * then refuses to publish if the packed manifest does not contain it.
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const EXPECTED_REPO_URL = "https://github.com/b4moss/jp-local-gov-id";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const packageDirArg = args.find((a) => !a.startsWith("--"));

if (!packageDirArg) {
  console.error(
    "Usage: node scripts/publish-package.mjs <package-dir> [--dry-run]",
  );
  process.exit(1);
}

const packageDir = resolve(packageDirArg);
const sourcePkg = JSON.parse(
  readFileSync(join(packageDir, "package.json"), "utf8"),
);

const directory = packageDirArg.replace(/^\.\//, "").replace(/\\/g, "/");
const pkg = {
  ...sourcePkg,
  repository: {
    type: "git",
    url: EXPECTED_REPO_URL,
    directory,
  },
};

const staging = mkdtempSync(join(tmpdir(), `publish-${basename(packageDir)}-`));

try {
  cpSync(packageDir, staging, {
    recursive: true,
    filter: (src) => {
      const name = basename(src);
      return name !== "node_modules" && !name.endsWith(".tgz");
    },
  });

  writeFileSync(join(staging, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);

  console.log("=== staged package.json repository ===");
  console.log(JSON.stringify(pkg.repository, null, 2));

  const packOut = execFileSync("npm", ["pack", "--pack-destination", staging], {
    cwd: staging,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const tgzName = packOut.trim().split("\n").at(-1)?.trim();
  if (!tgzName) {
    throw new Error("npm pack did not print a tarball name");
  }
  const tgzPath = join(staging, tgzName);
  console.log(`packed=${tgzPath}`);

  execFileSync("tar", ["-xzf", tgzPath, "-C", staging], { stdio: "ignore" });
  const packedPkg = JSON.parse(
    readFileSync(join(staging, "package", "package.json"), "utf8"),
  );
  const packedUrl = packedPkg.repository?.url ?? "";
  console.log(`packed repository.url=${packedUrl}`);

  if (packedUrl !== EXPECTED_REPO_URL) {
    throw new Error(
      `Packed repository.url must be "${EXPECTED_REPO_URL}" (got "${packedUrl}")`,
    );
  }

  if (dryRun) {
    console.log("dry-run: skipping npm publish");
    process.exit(0);
  }

  execFileSync(
    "npm",
    ["publish", tgzPath, "--access", "public", "--provenance"],
    {
      cwd: staging,
      stdio: "inherit",
      env: process.env,
    },
  );
} finally {
  rmSync(staging, { recursive: true, force: true });
}
