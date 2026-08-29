/**
 * 総務省 Excel の SHA-256 をローカル `resources/` と比較し、ステータス JSON を出す（#66）。
 * リモート HTTP は依存注入可能（テストではモック）。
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_SOURCE_URL =
  "https://www.soumu.go.jp/main_content/000925835.xlsx";

export const DEFAULT_LOCAL_PATH = "resources/000925835.xlsx";

export type SourceMonitorStatus = "ok" | "fetch_failed" | "hash_mismatch";

export type SourceMonitorResult = {
  sourceUrl: string;
  localPath: string;
  checkedAt: string;
  expectedSha256: string;
  remoteSha256: string | null;
  status: SourceMonitorStatus;
  error?: string;
};

export type FetchLike = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

export type CheckSourceHashOptions = {
  /** Absolute or repo-relative path to local Excel. */
  localFilePath?: string;
  /** Repo-relative path written into JSON (`localPath` field). */
  localPathLabel?: string;
  sourceUrl?: string;
  fetchImpl?: FetchLike;
  now?: () => Date;
  /** Repository root (for resolving relative local paths). Default: monorepo root. */
  rootDir?: string;
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRootDir = resolve(scriptDir, "..");

export function sha256Hex(data: Uint8Array | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function checkSourceHash(
  options: CheckSourceHashOptions = {},
): Promise<SourceMonitorResult> {
  const sourceUrl = options.sourceUrl ?? DEFAULT_SOURCE_URL;
  const localPathLabel = options.localPathLabel ?? DEFAULT_LOCAL_PATH;
  const rootDir = options.rootDir ?? defaultRootDir;
  const localFilePath =
    options.localFilePath ?? resolve(rootDir, localPathLabel);
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const checkedAt = now().toISOString();

  let localBytes: Buffer;
  try {
    localBytes = await readFile(localFilePath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Local source missing or unreadable: ${localFilePath} (${message})`);
  }

  const expectedSha256 = sha256Hex(localBytes);

  try {
    const res = await fetchImpl(sourceUrl);
    if (!res.ok) {
      return {
        sourceUrl,
        localPath: localPathLabel,
        checkedAt,
        expectedSha256,
        remoteSha256: null,
        status: "fetch_failed",
        error: `HTTP ${res.status}`,
      };
    }
    const remoteBytes = new Uint8Array(await res.arrayBuffer());
    const remoteSha256 = sha256Hex(remoteBytes);
    const status: SourceMonitorStatus =
      remoteSha256 === expectedSha256 ? "ok" : "hash_mismatch";
    return {
      sourceUrl,
      localPath: localPathLabel,
      checkedAt,
      expectedSha256,
      remoteSha256,
      status,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      sourceUrl,
      localPath: localPathLabel,
      checkedAt,
      expectedSha256,
      remoteSha256: null,
      status: "fetch_failed",
      error: message,
    };
  }
}

export function parseArgs(argv: string[]): { outPath: string | null } {
  let outPath: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("--out requires a path argument");
      }
      outPath = next;
      i++;
    } else if (arg.startsWith("--out=")) {
      outPath = arg.slice("--out=".length);
      if (!outPath) throw new Error("--out requires a path argument");
    } else if (arg === "--help" || arg === "-h") {
      // handled by caller via thrown help if needed — ignore here
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { outPath };
}

export async function writeStatusJson(
  result: SourceMonitorResult,
  outPath: string,
  rootDir: string = defaultRootDir,
): Promise<void> {
  // Spec TC-CLI03: do not mkdir; fail if parent missing (ENOENT from writeFile)
  const abs = resolve(rootDir, outPath);
  await writeFile(abs, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

export function exitCodeFor(result: SourceMonitorResult): number {
  return result.status === "ok" ? 0 : 1;
}

async function main(argv: string[]): Promise<number> {
  const { outPath } = parseArgs(argv);
  const result = await checkSourceHash();
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (outPath) {
    await writeStatusJson(result, outPath);
  } else {
    process.stdout.write(json);
  }
  return exitCodeFor(result);
}

const isDirectRun =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
