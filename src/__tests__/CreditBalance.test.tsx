/**
 * The credit balance UI — Phase 2's customer-facing surface.
 *
 * What has to hold, in order of how badly it misleads if wrong:
 *
 *  1. The "low" warning fires when the balance can no longer cover ONE
 *     request, not at some percentage. That is the moment asking starts
 *     failing; a 10% threshold would stay silent through the failures
 *     on a 10-credit plan.
 *  2. Fractional balances survive. A request can cost 0.11 credits, so
 *     rounding would tell someone with 0.4 left that they have "0".
 *  3. The reset label is derived from the server's DATE, so a page left
 *     open overnight recomputes rather than showing yesterday's answer.
 *  4. Unlimited plans say so instead of rendering an empty meter.
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

describe("CreditBalance", () => {
    it("states the balance against the limit", () => {
        renderBalance(block());
        expect(screen.getByText(/40 of 100 credits left/i)).toBeTruthy();
    });

    it("keeps fractional credits rather than rounding to zero", () => {
        // 0.4 credits is a real, spendable balance on a cheap request.
        renderBalance(block({ balance: 0.4, limit: 10, per_request_max: 5 }));
        expect(screen.getByText(/0\.4 of 10 credits left/i)).toBeTruthy();
    });

    it("warns when the balance cannot cover one more request", () => {
        // 3 left, a request may cost up to 5 -> the next ask fails.
        renderBalance(block({ balance: 3, limit: 10, per_request_max: 5 }));
        expect(screen.getByText(/not enough credits/i)).toBeTruthy();
    });

    it("does not warn while a request is still affordable", () => {
        // 6 of 100 is only 6% — a percentage threshold would cry here,
        // but the user can still ask.
        renderBalance(block({ balance: 6, limit: 100, per_request_max: 5 }));
        expect(screen.queryByText(/not enough credits/i)).toBeNull();
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
        expect(screen.getByText(/40 of 100 credits left/i)).toBeTruthy();
        expect(screen.queryByText(/NaN/)).toBeNull();
    });

    it("announces an unlimited plan instead of an empty meter", () => {
        renderBalance(block({ unlimited: true, balance: null, limit: null, used: null }));
        expect(screen.getByText(/unlimited ai credits/i)).toBeTruthy();
        expect(screen.queryByText(/credits left/i)).toBeNull();
    });
});
