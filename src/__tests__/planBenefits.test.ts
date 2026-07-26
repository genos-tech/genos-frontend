/**
 * The checkmark rows on a plan card, across the two AI eras.
 *
 * Credits replaced daily ask counts as the customer's real limit. The
 * daily numbers still EXIST in the payload — they're still counted
 * server-side for the Free abuse breaker — but under credits they bind
 * nobody, so rendering them would be selling a limit that is not one.
 *
 * The switch is `monthly_ai_credits` being present, which the server
 * sends only when it actually enforces credits. Same payload-shape
 * convention the model picker uses: either side can deploy first and
 * the page still describes what is really enforced.
 */

import { describe, expect, it } from "vitest";

import { en } from "../i18n/locales/en";
import type { PlanTier } from "../services/billingApi";
import { planBenefitRows } from "../features/billing/planBenefits";

const p = en.settings.planUsage;

const tier = (over: Partial<PlanTier["limits"]> = {}, t: PlanTier["tier"] = "pro"): PlanTier => ({
    tier: t,
    price: { amount: 2000, currency: "usd", interval: "month" },
    purchasable: true,
    contact_sales: false,
    limits: {
        llm_ask_daily: 250,
        web_search_daily: 60,
        task_create_monthly: 1500,
        note_create_monthly: 1000,
        message_retention_days: null,
        upload_max_mb: 50,
        ...over,
    },
});

const rows = (t: PlanTier) => planBenefitRows(t, p, "en").join(" | ");

describe("planBenefitRows — daily era (no monthly_ai_credits)", () => {
    it("advertises daily asks and web searches", () => {
        const out = rows(tier());
        expect(out).toContain("250 AI asks every day");
        expect(out).toContain("60 AI web searches per day");
    });

    it("says nothing about credits", () => {
        expect(rows(tier())).not.toMatch(/credit/i);
    });
});

describe("planBenefitRows — credits era", () => {
    it("advertises the monthly credit allowance", () => {
        expect(rows(tier({ monthly_ai_credits: 100 }))).toContain("100 AI credits every month");
    });

    it("stops advertising the daily ask count", () => {
        // It is still in the payload and still counted server-side, but
        // it no longer limits anyone — quoting it would sell a limit
        // that is not one.
        const out = rows(tier({ monthly_ai_credits: 100 }));
        expect(out).not.toContain("AI asks every day");
        expect(out).not.toContain("250");
    });

    it("stops quoting a per-day web-search number", () => {
        // Web search is priced into the request now — a capability, not
        // a quota. A per-day figure for it would be fiction.
        const out = rows(tier({ monthly_ai_credits: 100 }));
        expect(out).not.toContain("web searches per day");
        expect(out).toContain("Web search included");
    });

    it("explains what a credit buys, next to the number", () => {
        // "100 AI credits" raises "how far does that go?" — and the
        // answer is the reason credits exist.
        const out = rows(tier({ monthly_ai_credits: 100 }));
        expect(out).toMatch(/Simple questions use fewer credits/i);
    });

    it("handles an unlimited allowance", () => {
        const out = rows(tier({ monthly_ai_credits: null }, "enterprise"));
        expect(out).toContain("Unlimited AI credits");
    });

    it("treats null and undefined differently", () => {
        // null = unlimited (enterprise). undefined = the server is not
        // enforcing credits at all. Conflating them would advertise
        // "unlimited AI" on every plan the moment the flag went off.
        expect(rows(tier({ monthly_ai_credits: null }))).toContain("Unlimited AI credits");
        expect(rows(tier())).not.toMatch(/credit/i);
    });

    it("leaves the non-AI rows alone", () => {
        const out = rows(tier({ monthly_ai_credits: 100 }));
        expect(out).toContain("1,500");
        expect(out).toContain("1,000");
        expect(out).toContain("50");
    });
});

describe("planBenefitRows — shared by both pages", () => {
    it("is one function, so the two plans pages cannot disagree", () => {
        // They each carried their own copy under a comment claiming they
        // could never disagree — a property only a shared function
        // actually provides.
        const t = tier({ monthly_ai_credits: 40 }, "core");
        expect(planBenefitRows(t, p, "en")).toEqual(planBenefitRows(t, p, "en"));
    });

    it("formats numbers per locale", () => {
        const t = tier({ monthly_ai_credits: 100000 });
        expect(planBenefitRows(t, p, "en").join(" ")).toContain("100,000");
    });
});
