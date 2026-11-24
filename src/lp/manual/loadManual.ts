import type { Manual } from "../../manual/manualSource";
import type { Lang } from "../lpLang";
import { buildSearchIndex, type SearchEntry } from "./search";

/**
 * Loads the manual JSON for a language, on demand. Each language is its own chunk, so the
 * landing pages never carry the manual. The Japanese file is written by MIP-2322: until
 * `src/manual/manual.ja.json` exists the glob below finds only English, and a Japanese visitor
 * gets the English manual with a notice (`shown` says which language came back).
 */
const loaders = import.meta.glob<Manual>("../../manual/manual.*.json", { import: "default" });

export type LoadedManual = {
    manual: Manual;
    /** The language the text is in: `en` when `ja` was asked for and does not exist yet. */
    shown: Lang;
    index: () => SearchEntry[];
};

const cache = new Map<Lang, Promise<LoadedManual>>();

const loaderFor = (lang: Lang) => loaders[`../../manual/manual.${lang}.json`];

export const hasManual = (lang: Lang): boolean => loaderFor(lang) !== undefined;

export const loadManual = (lang: Lang): Promise<LoadedManual> => {
    const shown: Lang = hasManual(lang) ? lang : "en";
    let pending = cache.get(shown);
    if (!pending) {
        const load = loaderFor(shown);
        pending = load().then((manual) => {
            // The search index is built the first time something asks for it, not on page load.
            let index: SearchEntry[] | undefined;
            return {
                manual,
                shown,
                index: () => (index ??= buildSearchIndex(manual)),
            };
        });
        // A failed load must not be remembered, or a retry would never run.
        pending.catch(() => cache.delete(shown));
        cache.set(shown, pending);
    }
    return pending;
};
