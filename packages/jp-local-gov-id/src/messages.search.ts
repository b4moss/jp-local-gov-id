import { createMessageHelpers } from "./messages.core";
import {
  SEARCH_MESSAGES,
  type SearchMessageKey,
} from "./messages.search.generated";

export type { SearchMessageKey };
export { SEARCH_MESSAGES };

const helpers = createMessageHelpers(SEARCH_MESSAGES);

/** Static search-catalog message (no placeholder substitution). */
export const msg = helpers.msg;

/** Format a search-catalog template with `{name}` placeholders. */
export const fmt = helpers.fmt;
