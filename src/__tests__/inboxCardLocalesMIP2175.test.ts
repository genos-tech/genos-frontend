/**
 * MIP-2175: the Inbox card's new sentences exist in all seven locales (non en/ja are drafts), each
 * keeps the `{name}` token so the name can be set bold wherever the language puts it, and the
 * card's short type names and reminder headlines did not turn into the English ones.
 */
import { describe, expect, it } from "vitest";

import { splitAroundName } from "../features/inbox/components/inboxActor";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const CATALOGS = { en, ja, zh, es, fr, hi, ar } as const;
const KEYS = ["joinTeam", "joinProject", "joinGm", "noteAccess"] as const;

describe("inbox.card in all seven locales", () => {
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
        it(`${locale}: four sentences, each with one {name}`, () => {
            const card = catalog.inbox?.card as Record<string, string>;
            expect(card).toBeTruthy();
            for (const key of KEYS) {
                expect(typeof card[key]).toBe("string");
                expect(card[key].split("{name}").length - 1).toBe(1);
                const [before, after] = splitAroundName(card[key]);
                expect(before + after).not.toContain("{");
                if (locale !== "en") expect(card[key]).not.toBe(en.inbox.card[key]);
            }
        });

        it(`${locale}: reminder headlines are short sentences without a trailing full stop`, () => {
            const m = catalog.inbox?.messageReminder;
            for (const line of [
                m?.headline,
                m?.headlineFrom,
                m?.headlineComment,
                m?.headlineCommentFrom,
                catalog.inbox?.todoReminder?.headline,
            ]) {
                expect(line).toBeTruthy();
                expect(line).not.toMatch(/[.。]$/);
            }
            if (locale !== "en") {
                expect(m?.headline).not.toBe(en.inbox.messageReminder.headline);
            }
        });
    }
});
