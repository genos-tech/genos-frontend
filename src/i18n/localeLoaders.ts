import { en } from "./locales/en";
import { deepMerge, DeepPartial, Locale, Messages } from "./types";

// Lazy loading for the six non-English catalogs.
//
// English is imported statically and always available: it is the fallback
// every other locale deep-merges onto, so it can never be async. The other
// six are `import()`ed, which keeps ~108 kB gzip of catalogs a given user
// will never read out of the entry chunk.
//
// The whole design exists to preserve one property: `getMessages()` is
// SYNCHRONOUS and is called from ~30 non-React service modules (error
// paths in agentApi, the notification router, task/note services). It
// cannot become async without touching all of them, so instead the
// catalog is resolved into a module-level cache BEFORE the app mounts
// (see `bootI18n` below) and read synchronously from there afterwards.

const LOADERS: Record<Exclude<Locale, "en">, () => Promise<DeepPartial<Messages>>> = {
    ja: () => import("./locales/ja").then((m) => m.ja),
    es: () => import("./locales/es").then((m) => m.es),
    fr: () => import("./locales/fr").then((m) => m.fr),
    zh: () => import("./locales/zh").then((m) => m.zh),
    ar: () => import("./locales/ar").then((m) => m.ar),
    hi: () => import("./locales/hi").then((m) => m.hi),
};

// Fully merged catalogs, keyed by locale. `en` is seeded so the English
// path never allocates or awaits.
const CACHE = new Map<Locale, Messages>([["en", en]]);

// De-dupes concurrent loads of the same locale (the boot gate and the
// provider effect both ask for the initial locale).
const IN_FLIGHT = new Map<Locale, Promise<Messages>>();

/** True once `locale`'s catalog is merged and readable synchronously. */
export const isLocaleLoaded = (locale: Locale): boolean => CACHE.has(locale);

/**
 * The merged catalog for `locale` if it has been loaded, else English.
 *
 * Callers that need a guarantee must `await loadLocale` first. In practice
 * the boot gate makes this moot: nothing renders or runs until the initial
 * locale is in the cache.
 */
export const getLoadedMessages = (locale: Locale): Messages => CACHE.get(locale) ?? en;

/** Load + merge `locale`'s catalog, caching it. Idempotent and safe to
 *  call concurrently. Falls back to English if the chunk fails to load —
 *  a missing translation is a far better outcome than a dead app. */
export const loadLocale = async (locale: Locale): Promise<Messages> => {
    const cached = CACHE.get(locale);
    if (cached) return cached;
    const pending = IN_FLIGHT.get(locale);
    if (pending) return pending;

    const promise = LOADERS[locale as Exclude<Locale, "en">]()
        .then((dictionary) => {
            const merged = deepMerge(en, dictionary) as Messages;
            CACHE.set(locale, merged);
            return merged;
        })
        .catch((err) => {
            console.error(`[i18n] failed to load the "${locale}" catalog; using English.`, err);
            // Cache English under this locale so we don't retry the failed
            // chunk on every render.
            CACHE.set(locale, en);
            return en;
        })
        .finally(() => {
            IN_FLIGHT.delete(locale);
        });

    IN_FLIGHT.set(locale, promise);
    return promise;
};

/**
 * Warm the cache for the locale the app is about to start in.
 *
 * Call this before mounting React. It is what lets `getMessages()` stay
 * synchronous AND correct, and it also prevents the visible
 * English-then-flip that a render-first approach would give every
 * non-English user. English resolves without a network request, so
 * English users pay nothing.
 */
export const bootI18n = async (locale: Locale): Promise<void> => {
    if (locale === "en") return;
    await loadLocale(locale);
};
