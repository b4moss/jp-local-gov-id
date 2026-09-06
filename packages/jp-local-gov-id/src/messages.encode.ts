import { createMessageHelpers } from "./messages.core";
import {
  ENCODE_MESSAGES,
  type EncodeMessageKey,
} from "./messages.encode.generated";

export type { EncodeMessageKey };
export { ENCODE_MESSAGES };

const helpers = createMessageHelpers(ENCODE_MESSAGES);

/** Return a static encode/generate catalog message. */
export const msg = helpers.msg;

/** Format an encode/generate catalog template with `{name}` placeholders. */
export const fmt = helpers.fmt;
