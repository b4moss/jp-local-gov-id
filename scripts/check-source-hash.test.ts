import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

import {
  DEFAULT_LOCAL_PATH,
  DEFAULT_SOURCE_URL,
  checkSourceHash,
  exitCodeFor,
  parseArgs,
  sha256Hex,
  writeStatusJson,
  type FetchLike,
} from "./check-source-hash.ts";

const EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function hexOf(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function mockFetchOk(body: Uint8Array | string): FetchLike {
  const bytes = typeof body === "string" ? Buffer.from(body) : body;
  return async () =>
    new Response(bytes, {
      status: 200,
      headers: { "Content-Type": "application/octet-stream" },
    });
}

function mockFetchStatus(status: number): FetchLike {
  return async () => new Response("nope", { status });
}

function mockFetchReject(message: string): FetchLike {
  return async () => {
    throw new Error(message);
  };
}

describe("checkSourceHash (TC-C)", () => {
  const dirs: string[] = [];

  after(async () => {
    await Promise.all(
      dirs.map((d) => rm(d, { recursive: true, force: true })),
    );
  });

  async function fixtureDir(contents: Record<string, string | Buffer>) {
    const dir = await mkdtemp(join(tmpdir(), "source-hash-"));
    dirs.push(dir);
    for (const [name, data] of Object.entries(contents)) {
      await writeFile(join(dir, name), data);
    }
    return dir;
  }

  it("TC-C01: match → ok", async () => {
    const dir = await fixtureDir({ "local.xlsx": "same-bytes" });
    const localFilePath = join(dir, "local.xlsx");
    const result = await checkSourceHash({
      localFilePath,
      localPathLabel: DEFAULT_LOCAL_PATH,
      fetchImpl: mockFetchOk("same-bytes"),
      now: () => new Date("2026-08-29T12:00:00.000Z"),
    });
    assert.equal(result.status, "ok");
    assert.equal(result.expectedSha256, hexOf("same-bytes"));
    assert.equal(result.remoteSha256, hexOf("same-bytes"));
    assert.equal(result.sourceUrl, DEFAULT_SOURCE_URL);
    assert.equal(result.localPath, DEFAULT_LOCAL_PATH);
    assert.equal(exitCodeFor(result), 0);
  });

  it("TC-C02: mismatch → hash_mismatch", async () => {
    const dir = await fixtureDir({ "local.xlsx": "AAA" });
    const result = await checkSourceHash({
      localFilePath: join(dir, "local.xlsx"),
      fetchImpl: mockFetchOk("BBB"),
    });
    assert.equal(result.status, "hash_mismatch");
    assert.equal(result.expectedSha256, hexOf("AAA"));
    assert.equal(result.remoteSha256, hexOf("BBB"));
    assert.notEqual(result.expectedSha256, result.remoteSha256);
    assert.equal(exitCodeFor(result), 1);
  });

  it("TC-C03: HTTP error → fetch_failed", async () => {
    const dir = await fixtureDir({ "local.xlsx": "AAA" });
    const result = await checkSourceHash({
      localFilePath: join(dir, "local.xlsx"),
      fetchImpl: mockFetchStatus(404),
    });
    assert.equal(result.status, "fetch_failed");
    assert.equal(result.remoteSha256, null);
    assert.equal(result.expectedSha256, hexOf("AAA"));
    assert.match(result.error ?? "", /HTTP 404/);
    assert.equal(exitCodeFor(result), 1);
  });

  it("TC-C04: network failure → fetch_failed", async () => {
    const dir = await fixtureDir({ "local.xlsx": "AAA" });
    const result = await checkSourceHash({
      localFilePath: join(dir, "local.xlsx"),
      fetchImpl: mockFetchReject("getaddrinfo ENOTFOUND"),
    });
    assert.equal(result.status, "fetch_failed");
    assert.equal(result.remoteSha256, null);
    assert.match(result.error ?? "", /ENOTFOUND/);
    assert.equal(exitCodeFor(result), 1);
  });

  it("TC-C05: empty body ok", async () => {
    const dir = await fixtureDir({ "local.xlsx": Buffer.alloc(0) });
    const result = await checkSourceHash({
      localFilePath: join(dir, "local.xlsx"),
      fetchImpl: mockFetchOk(new Uint8Array()),
    });
    assert.equal(result.status, "ok");
    assert.equal(result.expectedSha256, EMPTY_SHA256);
    assert.equal(result.remoteSha256, EMPTY_SHA256);
  });

  it("TC-C06: lowercase hex 64", async () => {
    const dir = await fixtureDir({ "local.xlsx": "x" });
    const result = await checkSourceHash({
      localFilePath: join(dir, "local.xlsx"),
      fetchImpl: mockFetchOk("x"),
    });
    assert.match(result.expectedSha256, /^[0-9a-f]{64}$/);
    assert.match(result.remoteSha256!, /^[0-9a-f]{64}$/);
  });

  it("TC-C07: checkedAt from injected now", async () => {
    const dir = await fixtureDir({ "local.xlsx": "x" });
    const result = await checkSourceHash({
      localFilePath: join(dir, "local.xlsx"),
      fetchImpl: mockFetchOk("x"),
      now: () => new Date("2026-08-29T12:00:00.000Z"),
    });
    assert.equal(result.checkedAt, "2026-08-29T12:00:00.000Z");
  });

  it("TC-C08: default URL used for fetch", async () => {
    const dir = await fixtureDir({ "local.xlsx": "x" });
    let requested: string | undefined;
    const fetchImpl: FetchLike = async (url) => {
      requested = String(url);
      return mockFetchOk("x")(url);
    };
    const result = await checkSourceHash({
      localFilePath: join(dir, "local.xlsx"),
      fetchImpl,
    });
    assert.equal(requested, DEFAULT_SOURCE_URL);
    assert.equal(result.sourceUrl, DEFAULT_SOURCE_URL);
  });

  it("TC-C09: missing local file fails (not ok)", async () => {
    await assert.rejects(
      () =>
        checkSourceHash({
          localFilePath: join(tmpdir(), "no-such-source-hash-fixture.xlsx"),
          fetchImpl: mockFetchOk("x"),
        }),
      /Local source missing/,
    );
  });

  it("TC-C10: does not rewrite local file", async () => {
    const dir = await fixtureDir({ "local.xlsx": "original" });
    const localFilePath = join(dir, "local.xlsx");
    const before = await readFile(localFilePath);
    await checkSourceHash({
      localFilePath,
      fetchImpl: mockFetchOk("other"),
    });
    await checkSourceHash({
      localFilePath,
      fetchImpl: mockFetchStatus(500),
    });
    await checkSourceHash({
      localFilePath,
      fetchImpl: mockFetchOk("original"),
    });
    const after = await readFile(localFilePath);
    assert.deepEqual(after, before);
  });

  it("sha256Hex helper", () => {
    assert.equal(sha256Hex(Buffer.from("")), EMPTY_SHA256);
  });
});

describe("CLI helpers (TC-CLI)", () => {
  const dirs: string[] = [];

  after(async () => {
    await Promise.all(
      dirs.map((d) => rm(d, { recursive: true, force: true })),
    );
  });

  it("TC-CLI02: --out writes JSON", async () => {
    const dir = await mkdtemp(join(tmpdir(), "source-hash-out-"));
    dirs.push(dir);
    const outPath = join(dir, "source-monitor.json");
    const result = {
      sourceUrl: DEFAULT_SOURCE_URL,
      localPath: DEFAULT_LOCAL_PATH,
      checkedAt: "2026-08-29T12:00:00.000Z",
      expectedSha256: hexOf("a"),
      remoteSha256: hexOf("a"),
      status: "ok" as const,
    };
    await writeStatusJson(result, outPath, "/");
    const parsed = JSON.parse(await readFile(outPath, "utf8"));
    assert.equal(parsed.status, "ok");
    assert.equal(parsed.sourceUrl, DEFAULT_SOURCE_URL);
  });

  it("TC-CLI03: --out parent missing → error", async () => {
    const dir = await mkdtemp(join(tmpdir(), "source-hash-out-"));
    dirs.push(dir);
    const outPath = join(dir, "missing-parent", "source-monitor.json");
    await assert.rejects(
      () =>
        writeStatusJson(
          {
            sourceUrl: DEFAULT_SOURCE_URL,
            localPath: DEFAULT_LOCAL_PATH,
            checkedAt: "2026-08-29T12:00:00.000Z",
            expectedSha256: hexOf("a"),
            remoteSha256: hexOf("a"),
            status: "ok",
          },
          outPath,
          "/",
        ),
      /ENOENT/,
    );
  });

  it("parseArgs --out", () => {
    assert.deepEqual(parseArgs(["--out", "site/public/source-monitor.json"]), {
      outPath: "site/public/source-monitor.json",
    });
    assert.deepEqual(parseArgs(["--out=foo.json"]), { outPath: "foo.json" });
    assert.deepEqual(parseArgs([]), { outPath: null });
  });

  it("TC-CLI05: exit codes", () => {
    const base = {
      sourceUrl: DEFAULT_SOURCE_URL,
      localPath: DEFAULT_LOCAL_PATH,
      checkedAt: "2026-08-29T12:00:00.000Z",
      expectedSha256: "a".repeat(64),
    };
    assert.equal(exitCodeFor({ ...base, remoteSha256: base.expectedSha256, status: "ok" }), 0);
    assert.equal(
      exitCodeFor({ ...base, remoteSha256: "b".repeat(64), status: "hash_mismatch" }),
      1,
    );
    assert.equal(
      exitCodeFor({ ...base, remoteSha256: null, status: "fetch_failed" }),
      1,
    );
  });

  it("writes when parent directory exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "source-hash-nested-"));
    dirs.push(dir);
    await mkdir(join(dir, "sub"), { recursive: true });
    await writeStatusJson(
      {
        sourceUrl: DEFAULT_SOURCE_URL,
        localPath: DEFAULT_LOCAL_PATH,
        checkedAt: "2026-08-29T12:00:00.000Z",
        expectedSha256: hexOf("a"),
        remoteSha256: hexOf("a"),
        status: "ok",
      },
      join(dir, "sub", "out.json"),
    );
    const parsed = JSON.parse(
      await readFile(join(dir, "sub", "out.json"), "utf8"),
    );
    assert.equal(parsed.status, "ok");
  });
});
