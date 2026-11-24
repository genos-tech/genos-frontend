/**
 * The students FAQ answer about reminders (MIP-2308). The Japanese answer used to say reminders
 * are not provided while the app ships them; both languages must now tell the same story:
 * a manual "Remind me…" on a to-do, Genos AI on Core and up, push plus Inbox, no email, and no
 * reminders on task due dates.
 */
import { describe, expect, it } from "vitest";

import { students } from "../lp/segments/students";

const faqAnswer = (lang: "en" | "ja", questionPart: RegExp): string => {
    const copy = (students as unknown as Record<string, unknown>)[lang] as {
        faq: { items: Array<{ q: string; a: string }> };
    };
    const hit = copy.faq.items.find((item) => questionPart.test(item.q));
    if (!hit) throw new Error(`no ${lang} FAQ item matching ${questionPart}`);
    return hit.a;
};

describe("students FAQ: reminders", () => {
    const en = () => faqAnswer("en", /remind/i);
    const ja = () => faqAnswer("ja", /リマインダー/);

    it("Japanese no longer says reminders are not provided", () => {
        expect(ja()).not.toMatch(/未提供/);
        expect(ja()).toMatch(/^はい/);
    });

    it("English and Japanese both name the manual path with the app's own label", () => {
        expect(en()).toContain("Remind me…");
        expect(ja()).toContain("リマインドする…");
    });

    it("both gate the AI path to Core and up", () => {
        expect(en()).toContain("On Core and up");
        expect(ja()).toContain("Core以上");
    });

    it("both say push plus Inbox, no email, and no task-due-date reminders", () => {
        expect(en()).toMatch(/push/);
        expect(en()).toMatch(/Inbox/);
        expect(en()).toMatch(/No email/);
        expect(en()).toMatch(/Task due dates do not send reminders/);
        expect(ja()).toMatch(/プッシュ通知/);
        expect(ja()).toMatch(/受信箱/);
        expect(ja()).toMatch(/メールは送られません/);
        expect(ja()).toMatch(/タスクの期限にはリマインダーは付きません/);
    });
});
