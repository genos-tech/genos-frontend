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

    it("has the same questions, in the same order, in ja and en", () => {
        expect(BILLING_FAQ.ja.items.map((i) => i.id)).toEqual(
            BILLING_FAQ.en.items.map((i) => i.id)
        );
        expect(BILLING_FAQ.en.items.length).toBeGreaterThanOrEqual(8);
        expect(BILLING_FAQ.en.items.length).toBeLessThanOrEqual(10);
    });

    it("never uses the forbidden product words", () => {
        const all = JSON.stringify(BILLING_FAQ);
        expect(all).not.toMatch(/secretary/i);
        expect(all).not.toContain("秘書");
        expect(all).not.toMatch(/chatgpt/i);
    });
});
