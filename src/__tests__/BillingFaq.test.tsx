/**
 * The pricing page's billing FAQ (MIP-1250).
 *
 * Pins three things: the first-month answer is hidden unless the server's switch says the offer is
 * on (both states are tested), the ja and en copy have the same questions in the same order, and the
 * copy never uses the words the messaging brief forbids.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BillingFaq } from "../lp/BillingFaq";
import { BILLING_FAQ } from "../lp/copy/billingFaq";

const FIRST_MONTH_EN = "Is the first month free?";
const FIRST_MONTH_JA = "最初の 1 か月は無料ですか？";

describe("BillingFaq", () => {
    it("hides the first-month answer while the offer is off", () => {
        render(<BillingFaq firstMonthOffer={false} lang="en" />);
        expect(screen.queryByText(FIRST_MONTH_EN)).toBeNull();
        expect(screen.getByText("Can I cancel at any time?")).toBeTruthy();
    });

    it("shows the first-month answer when the offer is on", () => {
        render(<BillingFaq lang="en" firstMonthOffer />);
        expect(screen.getByText(FIRST_MONTH_EN)).toBeTruthy();
    });

    it("hides and shows the Japanese first-month answer the same way", () => {
        const { unmount } = render(<BillingFaq firstMonthOffer={false} lang="ja" />);
        expect(screen.queryByText(FIRST_MONTH_JA)).toBeNull();
        unmount();
        render(<BillingFaq lang="ja" firstMonthOffer />);
        expect(screen.getByText(FIRST_MONTH_JA)).toBeTruthy();
    });

    it("never mentions the first month while the offer is off, nor a removed promotion-code box (MIP-1895)", () => {
        for (const lang of ["en", "ja"] as const) {
            const { container, unmount } = render(
                <BillingFaq firstMonthOffer={false} lang={lang} />
            );
            const text = container.textContent ?? "";
            expect(text).not.toMatch(/first (free )?month|最初の 1 か月/i);
            unmount();
        }
        expect(JSON.stringify(BILLING_FAQ)).not.toMatch(
            /promotion-code box|プロモーションコードの入力欄/
        );
    });

    it("has the same questions, in the same order, in ja and en", () => {
        expect(BILLING_FAQ.ja.items.map((i) => i.id)).toEqual(
            BILLING_FAQ.en.items.map((i) => i.id)
        );
        expect(BILLING_FAQ.en.items.length).toBeGreaterThanOrEqual(8);
        expect(BILLING_FAQ.en.items.length).toBeLessThanOrEqual(12);
    });

    it("answers the AI-app limit question without writing a number that the plan table owns", () => {
        for (const lang of ["en", "ja"] as const) {
            const item = BILLING_FAQ[lang].items.find((i) => i.id === "mcp-limits");
            expect(item, lang).toBeDefined();
            const text = item!.a.join(" ");
            // The per-plan numbers come from the server's tier table: a copy here would drift.
            expect(text, lang).not.toMatch(/\b(3,000|10,000|30,000)\b/);
            expect(text, lang).toContain("UTC");
        }
    });

    it("never uses the forbidden product words", () => {
        const all = JSON.stringify(BILLING_FAQ);
        expect(all).not.toMatch(/secretary/i);
        expect(all).not.toContain("秘書");
        expect(all).not.toMatch(/chatgpt/i);
    });
});
