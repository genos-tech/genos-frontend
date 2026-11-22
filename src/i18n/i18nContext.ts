import { createContext, useContext } from "react";

import { en } from "./locales/en";
import { Locale, Messages } from "./types";

/**
 * Centralized i18n layer. Mirrors the manual `ja` / `en` `Copy` pattern that
 * already exists in `src/lp/LandingPage.tsx`, but lifts it app-wide as a typed
 * context.
 *
 * Consumers call `useTranslation()` and access strings via nested-object
 * notation (`t.tasks.modal.deleteTitle`) — full TypeScript autocompletion,
 * refactor-safe, dead-code-detectable. Path-string lookups are intentionally
 * NOT supported; they would defeat the type system.
 *
 * For non-React contexts (service errors, websocket handlers) use the
 * standalone `getMessages()` helper.
 *
 * Non-English dictionaries are `DeepPartial<Messages>` — missing keys
 * deep-merge-fall-back to the English value so translators can ship
 * incrementally without breaking the build. They are also lazy-loaded
 * (`localeLoaders.ts`); main.tsx awaits the initial one before mounting, so
 * the first render already has the right catalog and no user sees English
 * flash past.
 */

interface I18nContextValue {
    t: Messages;
    locale: Locale;
    setLocale: (l: Locale) => void;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export const useTranslation = (): I18nContextValue => {
    const ctx = useContext(I18nContext);
    if (!ctx) {
        // Provider not mounted (e.g. consumed before App tree, or in a stripped
        // test render). Return a stable English stub so callers don't crash.
        return { t: en, locale: "en", setLocale: () => {} };
    }
    return ctx;
};
