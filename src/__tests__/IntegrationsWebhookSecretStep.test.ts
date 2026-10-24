/**
 * The manual webhook "Secret" step must not point admins at the shared
 * GITHUB_WEBHOOK_SECRET (MIP-760).
 *
 * Since MIP-618 every hook signs with a secret of its own, and the shared
 * one is being retired. A hook made by hand has no registration row, so it
 * delivers nothing until someone with GitHub connected links a PR or branch
 * from the repo; adopting it then replaces the secret. The step used to say
 * "paste the same value the operator set in the backend env var
 * GITHUB_WEBHOOK_SECRET", which keeps the retired secret in circulation.
 *
 * Checked per locale and absolutely, not as a ratio: a type check only
 * proves the key exists, and a ratio ("most locales changed") cannot see
 * the one locale that still carries the old instruction, or still shows
 * English to a Japanese visitor.
 */
import { describe, expect, it } from "vitest";

import { getLoadedMessages, loadLocale } from "../i18n/localeLoaders";
import { en } from "../i18n/locales/en";
import type { Locale } from "../i18n/types";

const LOCALES: Locale[] = ["en", "ar", "es", "fr", "hi", "ja", "zh"];

const webhook = (locale: Locale) => getLoadedMessages(locale).integrations.github.webhook;

describe("manual webhook secret step", () => {
    it.each(LOCALES)("%s no longer names the shared secret", async (locale) => {
        await loadLocale(locale);
        const step = webhook(locale);

        expect(step.stepSecret).not.toContain("GITHUB_WEBHOOK_SECRET");
        // The label key is gone entirely, so nothing can render it.
        expect("secretEnvLabel" in step).toBe(false);
    });

    it.each(LOCALES.filter((l) => l !== "en"))(
        "%s has its own translation, not the English text",
        async (locale) => {
            await loadLocale(locale);

            expect(webhook(locale).stepSecret).not.toBe(en.integrations.github.webhook.stepSecret);
            expect(webhook(locale).stepSecret.length).toBeGreaterThan(20);
        }
    );

    it("English says the hook does nothing until a PR or branch is linked", () => {
        const text = en.integrations.github.webhook.stepSecret;

        expect(text).toMatch(/any value/i);
        expect(text).toMatch(/does nothing until/i);
    });
});
