import { createMessageHelpers } from "./messages.core";
import { MESSAGES, type MessageKey } from "./messages.generated";

export type { MessageKey };
export { MESSAGES };

const helpers = createMessageHelpers(MESSAGES);

/** Return a static runtime catalog message (no placeholder substitution). */
export const msg = helpers.msg;

/** Format a runtime catalog template with `{name}` placeholders. */
export const fmt = helpers.fmt;
