import { g } from "../../../theme/tokens";

/** The presence dot's two colours: online is the success hue, offline the quiet text tone. */
export const PRESENCE_COLOR = { online: g.success.solid, offline: g.text.tertiary } as const;
