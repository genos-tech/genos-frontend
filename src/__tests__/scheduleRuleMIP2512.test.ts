/** A schedule row words its time rule in the page's language (MIP-2512): the API's
 *  `when` is English, so the page builds the sentence from the rule's own fields. */
import { describe, expect, it } from "vitest";

import { describeRule } from "../features/schedules/scheduleRule";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

type Rule = Parameters<typeof describeRule>[0];

const SERVER = "server words";
const base = { when: SERVER, timeOfDay: "09:00" };
const RULES: Record<string, Rule> = {
    daily: { ...base, frequency: "daily" },
    weekdays: { ...base, frequency: "weekdays" },
    weekly: { ...base, frequency: "weekly", weekdays: [2, 0] },
    monthly: { ...base, frequency: "monthly", monthDay: 15 },
    once: { ...base, frequency: "once", runDate: "2026-12-24" },
};

const strings = (m: unknown) =>
    (m as typeof en).settings.schedules as Parameters<typeof describeRule>[1];
const words = (messages: unknown, locale: string) =>
    Object.fromEntries(
        Object.entries(RULES).map(([k, r]) => [k, describeRule(r, strings(messages), locale)])
    );

describe("the schedule row's time rule", () => {
    it("reads in English", () => {
        expect(words(en, "en")).toEqual({
            daily: "Every day at 09:00",
            weekdays: "Every Monday to Friday at 09:00",
            weekly: "Every Monday and Wednesday at 09:00",
            monthly: "Every month on day 15 at 09:00",
            once: "Once, on Dec 24, 2026 at 09:00",
        });
    });

    it("reads in Japanese", () => {
        expect(words(ja, "ja")).toEqual({
            daily: "毎日 09:00",
            weekdays: "毎週月曜〜金曜 09:00",
            weekly: "毎週月曜日、水曜日 09:00",
            monthly: "毎月15日 09:00",
            once: "1回のみ: 2026年12月24日 09:00",
        });
    });

    it.each([
        ["zh", zh],
        ["es", es],
        ["fr", fr],
        ["hi", hi],
        ["ar", ar],
    ] as const)("%s words all five rules itself", (locale, messages) => {
        const out = words(messages, locale);
        for (const text of Object.values(out)) {
            expect(text).toContain("09:00");
            expect(text).not.toContain("{");
            expect(text).not.toBe(SERVER);
            expect(text).not.toMatch(/Every|Once/);
        }
        expect(new Set(Object.values(out)).size).toBe(5);
    });

    it("keeps the server's words for a rule it cannot complete or does not know", () => {
        const s = strings(en);
        for (const rule of [
            { ...base, frequency: "weekly", weekdays: [] },
            { ...base, frequency: "monthly" },
            { ...base, frequency: "once" },
            { ...base, frequency: "hourly" },
        ]) {
            expect(describeRule(rule as Rule, s, "en")).toBe(SERVER);
        }
    });
});
