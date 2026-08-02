/**
 * The credit balance UI — Phase 2's customer-facing surface.
 *
 * What has to hold, in order of how badly it misleads if wrong:
 *
 *  1. The bar fills with what has been USED. A full balance reads
 *     empty, not full — the same direction as the task and note quota
 *     bars two tabs away. Backwards, it would say "you have used it
 *     all" to someone who has used none.
 *  2. Low and empty are DIFFERENT states, because the server treats
 *     them differently: below one request's maximum you can still ask
 *     (the run stops partway if it gets expensive), at zero you cannot
 *     ask at all. Neither is a percentage — a 10% threshold would stay
 *     silent through every stop on a 10-credit plan.
 *  3. Fractional balances survive. A request can cost 0.11 credits, so
 *     rounding would tell someone with 0.4 left that they have "0".
 *  4. The reset label is derived from the server's DATE, so a page left
 *     open overnight recomputes rather than showing yesterday's answer.
 *  5. Unlimited plans say so instead of rendering an empty meter.
 *  6. The unit is always "AI credits" — "credits" alone asks the
 *     question it is supposed to answer.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CreditBalance } from "../components/layout/settings/CreditBalance";
import { I18nProvider } from "../i18n";
import type { CreditsBlock } from "../services/agentApi";

const inDays = (n: number): string => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString();
};

const block = (over: Partial<CreditsBlock> = {}): CreditsBlock => ({
    unlimited: false,
    balance: 40,
    limit: 100,
    used: 60,
    period_end_iso: inDays(10),
    per_request_max: 5,
    ...over,
});

const renderBalance = (credits: CreditsBlock) =>
    render(
        <I18nProvider>
            <CreditBalance credits={credits} />
        </I18nProvider>
    );

/** The Joy LinearProgress reports its fill through ARIA. */
const barValue = (): number =>
    Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"));

describe("CreditBalance", () => {
    it("states the balance against the limit", () => {
        renderBalance(block());
        expect(screen.getByText(/40 of 100 AI credits left/i)).toBeTruthy();
    });

    it("names the unit 'AI credits', never a bare 'credits'", () => {
        renderBalance(block());
        expect(screen.queryByText(/\d+ of \d+ credits left/i)).toBeNull();
    });

    it("keeps fractional credits rather than rounding to zero", () => {
        // 0.4 credits is a real, spendable balance on a cheap request.
        renderBalance(block({ balance: 0.4, limit: 10, per_request_max: 5 }));
        expect(screen.getByText(/0\.4 of 10 AI credits left/i)).toBeTruthy();
    });

    it("shows a FULL bar on an untouched allowance", () => {
        // Direction reversed 2026-08-02 by maintainer request: the bar
        // is a fuel gauge showing what is LEFT, so an unspent month
        // reads full. This agrees with the label beside it, which has
        // always said "{balance} of {limit} AI credits left" — the
        // previous used-fill direction contradicted its own caption.
        renderBalance(block({ balance: 200, limit: 200, used: 0 }));
        expect(barValue()).toBe(100);
    });

    it("drains the bar in proportion to what has been used", () => {
        renderBalance(block({ balance: 40, limit: 100 }));
        expect(barValue()).toBe(40);
    });

    it("shows an EMPTY bar once the allowance is gone", () => {
        renderBalance(block({ balance: 0, limit: 100 }));
        expect(barValue()).toBe(0);
    });

    it("warns that a long request may stop partway when running low", () => {
        // 3 left, a request may cost up to 5 -> it can still be asked,
        // and the server stops it mid-run if it gets that expensive.
        renderBalance(block({ balance: 3, limit: 10, per_request_max: 5 }));
        expect(screen.getByText(/stop partway/i)).toBeTruthy();
        expect(screen.queryByText(/out of AI credits/i)).toBeNull();
    });

    it("says you are OUT only at zero, where asking actually fails", () => {
        renderBalance(block({ balance: 0, limit: 10, per_request_max: 5 }));
        expect(screen.getByText(/out of AI credits/i)).toBeTruthy();
        expect(screen.queryByText(/stop partway/i)).toBeNull();
    });

    it("does not warn while a request is still affordable", () => {
        // 6 of 100 is only 6% — a percentage threshold would cry here,
        // but the user can ask freely.
        renderBalance(block({ balance: 6, limit: 100, per_request_max: 5 }));
        expect(screen.queryByText(/stop partway/i)).toBeNull();
        expect(screen.queryByText(/out of AI credits/i)).toBeNull();
    });

    it("renders the reset day from the server date", () => {
        renderBalance(block({ period_end_iso: inDays(1) }));
        expect(screen.getByText(/resets tomorrow/i)).toBeTruthy();
    });

    it("says 'today' on the reset day rather than a negative count", () => {
        renderBalance(block({ period_end_iso: inDays(0) }));
        expect(screen.getByText(/resets today/i)).toBeTruthy();
    });

    it("tolerates a malformed date instead of rendering NaN", () => {
        renderBalance(block({ period_end_iso: "not-a-date" }));
        expect(screen.getByText(/40 of 100 AI credits left/i)).toBeTruthy();
        expect(screen.queryByText(/NaN/)).toBeNull();
    });

    it("announces an unlimited plan instead of an empty meter", () => {
        renderBalance(block({ unlimited: true, balance: null, limit: null, used: null }));
        expect(screen.getByText(/unlimited ai credits/i)).toBeTruthy();
        expect(screen.queryByText(/credits left/i)).toBeNull();
    });
});
