import { MESSAGES, type MessageKey } from "./messages.generated";

export type { MessageKey };
export { MESSAGES };

const PLACEHOLDER_RE = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

/** Return a static catalog message (no placeholder substitution). */
export function msg(key: MessageKey): string {
  const value = MESSAGES[key];
  if (value === undefined) {
    throw new Error(`Unknown message key: ${String(key)}`);
  }
  return value;
}

/**
 * Format a catalog template with `{name}` placeholders.
 * Missing required placeholders or null/undefined values throw.
 */
export function fmt(
  key: MessageKey,
  params: Record<string, string | number | boolean>,
): string {
  const template = msg(key);
  const required = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    required.add(match[1]!);
  }
  for (const name of required) {
    if (!(name in params)) {
      throw new Error(
        `Missing message placeholder "${name}" for key ${String(key)}`,
      );
    }
    const value = params[name];
    if (value === null || value === undefined) {
      throw new Error(
        `Message placeholder "${name}" for key ${String(key)} must not be null or undefined`,
      );
    }
  }
  return template.replace(PLACEHOLDER_RE, (_m, name: string) =>
    String(params[name]),
  );
}
