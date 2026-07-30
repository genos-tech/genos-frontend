import createCache from "@emotion/cache";
import { prefixer } from "stylis";
import rtlPlugin from "stylis-plugin-rtl";

/**
 * Emotion cache that mirrors physical CSS for right-to-left locales.
 *
 * WHY THIS IS NEEDED AT ALL. `<html dir="rtl">` (set from the locale since
 * `0811befc`, pre-mount since #319) flips what the *browser* owns: text
 * direction, `text-align: start`, the flex inline axis, logical properties.
 * It cannot flip a physical one — and the app is built from ~180 Joy `sx`
 * shorthands like `ml` / `pr`, which compile to `marginLeft` /
 * `paddingRight`. So Arabic came out HALF-mirrored: rows reversed while
 * their padding and absolute offsets stayed put. That is worse than plain
 * LTR, not better.
 *
 * `stylis-plugin-rtl` rewrites those declarations as emotion serialises
 * them, which reaches every `sx`, every `styled()`, and Joy's own internal
 * styles in one move — the only way to cover them without auditing ~180
 * call sites by hand.
 *
 * WHAT IT DOESN'T REACH: plain stylesheets (`App.css`, `index.css`) and
 * third-party CSS (BlockNote, Virtuoso) never pass through emotion.
 * `App.css` was converted to logical properties in #319 for exactly this
 * reason; the third-party sheets remain a known gap.
 */

/** `key` must differ from the default (`css`) or the two caches collide. */
export const RTL_CACHE_KEY = "gp-rtl";

/**
 * Built lazily and memoised: `createCache` inserts a `<style>` container on
 * construction, so building one for every LTR user — i.e. everyone except
 * Arabic — would be pure waste.
 */
let cache: ReturnType<typeof createCache> | null = null;

export const getRtlCache = () => {
    if (cache === null) {
        cache = createCache({
            key: RTL_CACHE_KEY,
            // `prefixer` is emotion's default plugin. Passing `stylisPlugins`
            // REPLACES the default list, so omitting it here would silently
            // drop vendor prefixing for RTL users only.
            stylisPlugins: [prefixer, rtlPlugin],
        });
    }
    return cache;
};
