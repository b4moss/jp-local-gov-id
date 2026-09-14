/**
 * Bare-specifier prefix for library chunks remapped into the playground import map.
 * Relative `./chunk.js` imports cannot resolve from blob: URLs, so we rewrite them.
 */
export const PLAYGROUND_CHUNK_PREFIX = "@jp-lg-chunk/";

export const API_ENTRY_FILE = "jp-local-gov-id.js";

/**
 * Rewrite relative chunk imports to bare specifiers so import maps can resolve them
 * when the module itself is loaded from a blob: URL.
 */
export function rewriteChunkRelativeImports(source: string): string {
  return source.replace(
    /((?:import\s*\(\s*|from\s+))(["'])\.\/([^"']+\.js)\2/g,
    (_match, prefix: string, quote: string, fileName: string) =>
      `${prefix}${quote}${PLAYGROUND_CHUNK_PREFIX}${fileName}${quote}`,
  );
}
