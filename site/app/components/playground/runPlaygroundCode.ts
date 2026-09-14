export type ConsoleLevel = "log" | "info" | "warn" | "error" | "debug";

export interface ConsoleEntry {
  id: number;
  level: ConsoleLevel | "system";
  args: unknown[];
  timestamp: number;
}

export type PlaygroundRunEvent =
  | { type: "console"; level: ConsoleLevel; args: unknown[] }
  | { type: "error"; message: string }
  | { type: "done" };

const ALLOWED_IMPORTS = new Set([
  "@b4moss/jp-local-gov-id",
  "@b4moss/jp-local-gov-id-data",
]);

const IMPORT_SOURCE_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"\n]+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

let entryId = 0;
let packageSourcesPromise: Promise<{
  apiEntryFile: string;
  apiModules: Record<string, string>;
  data: string;
  chunkPrefix: string;
}> | null = null;

export function assertAllowedImports(code: string): void {
  IMPORT_SOURCE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMPORT_SOURCE_RE.exec(code)) !== null) {
    const source = match[1] ?? match[2];
    if (!source) continue;
    if (!ALLOWED_IMPORTS.has(source)) {
      throw new Error(
        `Illegal import: "${source}". Only @b4moss/jp-local-gov-id and @b4moss/jp-local-gov-id-data are allowed.`,
      );
    }
  }
}

async function getPackageSources(): Promise<{
  apiEntryFile: string;
  apiModules: Record<string, string>;
  data: string;
  chunkPrefix: string;
}> {
  if (!packageSourcesPromise) {
    packageSourcesPromise = import("./packageSources").then((m) => {
      const sources = m.buildPackageSources();
      return {
        ...sources,
        chunkPrefix: m.PLAYGROUND_CHUNK_PREFIX,
      };
    });
  }
  return packageSourcesPromise;
}

/** Embed a JS string literal inside a classic <script> without breaking out of the tag. */
function embedAsJsString(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** Embed a Record<string, string> as a JS object literal of string values. */
function embedStringRecord(record: Record<string, string>): string {
  const parts = Object.entries(record).map(
    ([key, value]) => `${embedAsJsString(key)}:${embedAsJsString(value)}`,
  );
  return `{${parts.join(",")}}`;
}

function serializeArg(value: unknown): unknown {
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  try {
    JSON.stringify(value);
    return value;
  } catch {
    return String(value);
  }
}

export function createConsoleEntry(
  level: ConsoleEntry["level"],
  args: unknown[],
): ConsoleEntry {
  entryId += 1;
  return {
    id: entryId,
    level,
    args: args.map(serializeArg),
    timestamp: Date.now(),
  };
}

export interface RunPlaygroundOptions {
  code: string;
  host: HTMLElement;
  onEvent: (event: PlaygroundRunEvent) => void;
  signal?: AbortSignal;
}

/**
 * Transform TypeScript with Sucrase, validate imports, and run in a sandbox iframe.
 * Recreates the iframe on each call; pass an AbortSignal to tear down an in-flight run.
 *
 * Blob URLs for modules are created *inside* the iframe so `sandbox="allow-scripts"`
 * (no allow-same-origin) can still load them. Parent-created blob: URLs are blocked.
 */
export async function runPlaygroundCode(
  options: RunPlaygroundOptions,
): Promise<void> {
  const { code, host, onEvent, signal } = options;

  host.replaceChildren();

  assertAllowedImports(code);

  const { transform } = await import("sucrase");
  const transformed = transform(code, {
    transforms: ["typescript"],
    disableESTransforms: true,
  }).code;

  // Re-check after transform (in case of weird rewrite); sources should be unchanged.
  assertAllowedImports(transformed);

  const { apiEntryFile, apiModules, data, chunkPrefix } =
    await getPackageSources();

  if (signal?.aborted) return;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
</head>
<body>
<script>
(() => {
  const CHANNEL = "jp-local-gov-playground";
  const post = (payload) => {
    parent.postMessage({ channel: CHANNEL, ...payload }, "*");
  };
  const wrap = (level) => (...args) => {
    post({ type: "console", level, args: args.map((a) => {
      if (typeof a === "bigint") return String(a) + "n";
      if (typeof a === "function") return "[Function " + (a.name || "anonymous") + "]";
      if (a instanceof Error) return { name: a.name, message: a.message, stack: a.stack };
      try { JSON.stringify(a); return a; } catch { return String(a); }
    }) });
  };
  console.log = wrap("log");
  console.info = wrap("info");
  console.warn = wrap("warn");
  console.error = wrap("error");
  console.debug = wrap("debug");
  window.addEventListener("error", (e) => {
    post({ type: "error", message: e.error?.stack || e.message || String(e.error || e) });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    post({
      type: "error",
      message: r instanceof Error ? (r.stack || r.message) : String(r),
    });
  });

  const toBlobUrl = (source) =>
    URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  const chunkPrefix = ${embedAsJsString(chunkPrefix)};
  const apiEntryFile = ${embedAsJsString(apiEntryFile)};
  const apiModules = ${embedStringRecord(apiModules)};
  const imports = {};
  for (const [name, source] of Object.entries(apiModules)) {
    const url = toBlobUrl(source);
    imports[chunkPrefix + name] = url;
    if (name === apiEntryFile) {
      imports["@b4moss/jp-local-gov-id"] = url;
    }
  }
  imports["@b4moss/jp-local-gov-id-data"] = toBlobUrl(${embedAsJsString(data)});
  const userUrl = toBlobUrl(${embedAsJsString(transformed)});

  const map = document.createElement("script");
  map.type = "importmap";
  map.textContent = JSON.stringify({ imports });
  document.head.appendChild(map);
  window.__pgUserUrl = userUrl;
})();
</script>
<script type="module">
try {
  await import(window.__pgUserUrl);
  parent.postMessage({ channel: "jp-local-gov-playground", type: "done" }, "*");
} catch (e) {
  parent.postMessage({
    channel: "jp-local-gov-playground",
    type: "error",
    message: e instanceof Error ? (e.stack || e.message) : String(e),
  }, "*");
  parent.postMessage({ channel: "jp-local-gov-playground", type: "done" }, "*");
}
</script>
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.setAttribute("title", "playground-sandbox");
  iframe.style.cssText =
    "position:absolute;width:0;height:0;border:0;visibility:hidden";
  iframe.srcdoc = html;

  let settled = false;
  let settle: () => void = () => {};
  const finish = () => {
    if (settled) return;
    settled = true;
    settle();
  };

  const cleanup = () => {
    window.removeEventListener("message", onMessage);
    iframe.remove();
  };

  const onMessage = (event: MessageEvent) => {
    if (event.source !== iframe.contentWindow) return;
    const data = event.data;
    if (!data || data.channel !== "jp-local-gov-playground") return;

    if (data.type === "console") {
      onEvent({
        type: "console",
        level: data.level,
        args: Array.isArray(data.args) ? data.args : [data.args],
      });
    } else if (data.type === "error") {
      onEvent({ type: "error", message: String(data.message ?? "Error") });
    } else if (data.type === "done") {
      onEvent({ type: "done" });
      cleanup();
      finish();
    }
  };

  window.addEventListener("message", onMessage);

  if (signal) {
    const onAbort = () => {
      cleanup();
      signal.removeEventListener("abort", onAbort);
      finish();
    };
    signal.addEventListener("abort", onAbort);
  }

  host.appendChild(iframe);

  await new Promise<void>((resolve) => {
    settle = resolve;
  });
}
