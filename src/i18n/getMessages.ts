import { getLoadedMessages } from "./localeLoaders";
import { resolveInitialLocale } from "./localeSource";
import { Locale, Messages } from "./types";

/**
 * Non-React accessor for the current locale's message catalog. Use this in
 * service-layer code where `useTranslation()` is unavailable — `agentApi.ts`,
 * websocket handlers, notification routers, anywhere outside React render.
 *
 * SYNCHRONOUS by contract: ~30 modules call it on error paths, so it can't
 * become async. Non-English catalogs are now lazy-loaded, so this reads the
 * module-level cache that `bootI18n()` fills BEFORE React mounts (see
 * main.tsx). Every call site runs inside a function body — none at module
 * scope — so by the time any of them execute, the cache is warm.
 *
 * If a catalog somehow isn't loaded (its chunk failed to fetch), this falls
 * back to English rather than throwing: an untranslated error message beats
 * a crash on an error path.
 */
export const getMessages = (locale?: Locale): Messages =>
    getLoadedMessages(locale ?? resolveInitialLocale());
