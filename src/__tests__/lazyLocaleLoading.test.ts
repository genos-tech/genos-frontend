/**
 * The non-English locale path, which nothing else covers.
 *
 * jsdom reports `navigator.language === "en-US"`, so the rest of the
 * suite always takes the synchronous English branch: no dynamic import,
 * no boot gate, no warm cache. That leaves the entire mechanism behind
 * lazy catalog loading unexercised, which is exactly the part that can
 * silently degrade into "every string is English" without failing a
 * type check or a render test.
 *
 * These tests drive the loader directly rather than through the
 * provider, because the property that matters is the one the ~30
 * synchronous `getMessages()` callers depend on: after the boot gate
 * resolves, the merged catalog is readable WITHOUT awaiting.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { getMessages } from "../i18n/getMessages";
import { bootI18n, getLoadedMessages, isLocaleLoaded, loadLocale } from "../i18n/localeLoaders";
import { en } from "../i18n/locales/en";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";

describe("lazy locale loading", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it("English is available synchronously with no load", () => {
        expect(isLocaleLoaded("en")).toBe(true);
        expect(getLoadedMessages("en")).toBe(en);
    });

    it("falls back to English before a catalog is loaded", () => {
        // The pre-boot state. Not a crash, not undefined — English.
        //
        // ORDER-DEPENDENT: the loader's cache is module-level and by
        // design survives between tests, and later cases in this file
        // load every locale. This case must stay above them.
        expect(getLoadedMessages("fr")).toBe(en);
    });

    it("loads a catalog and then serves it synchronously", async () => {
        await loadLocale("ja");

        expect(isLocaleLoaded("ja")).toBe(true);
        // The whole point: no await here. This is what getMessages() does.
        const ja = getLoadedMessages("ja");
        expect(ja).not.toBe(en);
        expect(ja.common.actions.save).not.toBe(en.common.actions.save);
    });

    it("deep-merges onto English so untranslated keys still resolve", async () => {
        const ja = await loadLocale("ja");
        // Every top-level section English has must exist after merging,
        // even though the ja catalog is a DeepPartial.
        for (const key of Object.keys(en)) {
            expect(ja).toHaveProperty(key);
        }
    });

    it("de-dupes concurrent loads of the same locale", async () => {
        const [a, b] = await Promise.all([loadLocale("es"), loadLocale("es")]);
        expect(a).toBe(b);
        expect(getLoadedMessages("es")).toBe(a);
    });

    it("getMessages reads the warm cache after the boot gate", async () => {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, "fr");
        await bootI18n("fr");

        // Synchronous call, no locale argument — the exact shape used by
        // agentApi / notificationRouter / the task+note services.
        const messages = getMessages();
        expect(messages).toBe(getLoadedMessages("fr"));
        expect(messages.common.actions.save).not.toBe(en.common.actions.save);
    });

    it("bootI18n resolves immediately for English", async () => {
        await expect(bootI18n("en")).resolves.toBeUndefined();
    });

    it("every non-English locale has a working loader", async () => {
        // Guards the hand-written LOADERS map: a typo in one entry would
        // otherwise only surface for users of that one language.
        for (const locale of ["ja", "es", "fr", "zh", "ar", "hi"] as const) {
            const messages = await loadLocale(locale);
            expect(messages.common.actions.save).toBeTruthy();
            expect(isLocaleLoaded(locale)).toBe(true);
        }
    });
});
