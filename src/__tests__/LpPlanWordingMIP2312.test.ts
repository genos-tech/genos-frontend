/**
 * The audience pages must say which plan an AI action needs and must not over-promise
 * (fact-check MIP-2306, rows R2 R3 R7 T1 T2 P1 P3 S2 S3 S6 S8 H11). The Free plan's Genos AI is
 * read-only, Core proposes single changes, multi-task plans and GitHub reading are Pro and up,
 * "schedules" exist only through Google Calendar, and the demo opens in English or Japanese.
 */
import { describe, expect, it } from "vitest";

import { HOME_COPY } from "../lp/copy/home";
import { SEGMENTS } from "../lp/segments";

const allText = (key: keyof typeof SEGMENTS, lang: "en" | "ja"): string =>
    JSON.stringify(SEGMENTS[key][lang]);

describe("audience pages state the plan an AI action needs (MIP-2312)", () => {
    it.each(["en", "ja"] as const)("research %s names the plan and Google Calendar", (lang) => {
        const t = allText("research", lang);
        expect(t).toContain(lang === "en" ? "Pro and up" : "Pro以上");
        expect(t).toContain(lang === "en" ? "Google Calendar" : "Googleカレンダー");
        expect(t).not.toContain(
            lang === "en" ? "todos, deadlines, and calendar events" : "Todo、期限、予定を管理"
        );
    });

    it("research FAQ scopes 'never changes' to Genos AI, in both languages", () => {
        const en = SEGMENTS.research.en.faq.items.find((i) => i.q.includes("change research"));
        const ja = SEGMENTS.research.ja.faq.items.find((i) => i.q.includes("研究記録を自動"));
        expect(en?.a).toMatch(/^No\. Genos AI never changes anything until you approve it\./);
        expect(en?.a).toContain("Apps you connect yourself");
        expect(ja?.a).toContain("Genos AIは、承認するまで何も変更しません");
        expect(ja?.a).toContain("ご自身で接続したアプリ");
    });

    it.each(["en", "ja"] as const)(
        "teams %s separates Pro plans from Core single tasks",
        (lang) => {
            const t = allText("teams", lang);
            expect(t).toContain(lang === "en" ? "up to 20 tasks" : "最大20件");
            expect(t).toContain(lang === "en" ? "Core and up" : "Core以上");
            expect(t).toContain(lang === "en" ? "Google Calendar" : "Googleカレンダー");
        }
    );

    it.each(["en", "ja"] as const)(
        "projects %s gates plans and GitHub reading to Pro and up",
        (lang) => {
            const t = allText("projects", lang);
            const pro = lang === "en" ? "Pro and up" : "Pro以上";
            expect(t.split(pro).length - 1).toBeGreaterThanOrEqual(4);
            expect(t).toContain(lang === "en" ? "with GitHub connected" : "GitHub連携時");
        }
    );

    it.each(["en", "ja"] as const)(
        "students %s says Core and up, and that Free drafts text",
        (lang) => {
            const s = SEGMENTS.students[lang];
            const t = JSON.stringify(s);
            expect(t).toContain(lang === "en" ? "On Core and up" : "Core以上では");
            expect(t).toContain(lang === "en" ? "text draft on Free" : "Freeでは文章の下書き");
            expect(t).not.toContain("Action対応プラン");
            expect(t).not.toContain("plans with actions enabled");
        }
    );

    it("students call-to-action says it opens the demo, not a free signup", () => {
        expect(SEGMENTS.students.en.hero.primary).toBe("Try the demo");
        expect(SEGMENTS.students.en.cta.primary).toBe("Try the demo");
        expect(SEGMENTS.students.ja.hero.primary).toBe("デモを試す");
        expect(SEGMENTS.students.ja.cta.primary).toBe("デモを試す");
    });

    it("the demo FAQ names the two demo languages", () => {
        const text = JSON.stringify(HOME_COPY);
        expect(text).toContain("in English or Japanese. Nothing to install");
        expect(text).toContain("日本語または英語で開きます");
        expect(text).not.toContain("in your language. Nothing");
    });
});
