/**
 * Settings → AI credit usage (MIP-1971): the three states, the credits-null branch, an unknown
 * job key, a very long schedule name, and the buy / upgrade links.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AiCreditUsageSection } from "../components/layout/settings/AiCreditUsageSection";
import { I18nProvider } from "../i18n";

const navigate = vi.fn();
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));

const fetchCreditUsage = vi.fn();
const fetchCreditCharges = vi.fn();
vi.mock("../services/agentApi", () => ({
    fetchCreditUsage: (...a: unknown[]) => fetchCreditUsage(...a),
    fetchCreditCharges: (...a: unknown[]) => fetchCreditCharges(...a),
}));

const credits = {
    unlimited: false,
    balance: 40,
    limit: 50,
    used: 10,
    purchased_balance: 0,
    period_end_iso: "2026-12-01T00:00:00+00:00",
    per_request_max: 5,
};
const usage = (over: Record<string, unknown> = {}) => ({
    credits,
    tier: "free",
    period: "2026-11",
    period_end_iso: credits.period_end_iso,
    by_job: [
        { job: "ask", count: 2, credits: 8 },
        { job: "brand_new", count: 1, credits: 2 },
    ],
    month_total_credits: 10,
    recent: [
        { id: 2, at: new Date().toISOString(), job: "ask", credits: 3.5, detail: "", source: "" },
        {
            id: 1,
            at: new Date().toISOString(),
            job: "schedule",
            credits: 0.1,
            detail: "x".repeat(200),
            source: "",
        },
    ],
    next_cursor: null,
    ...over,
});

const renderIt = (onNavigateAway?: () => void) =>
    render(
        <I18nProvider>
            <AiCreditUsageSection onNavigateAway={onNavigateAway} />
        </I18nProvider>
    );

describe("AiCreditUsageSection", () => {
    beforeEach(() => {
        navigate.mockReset();
        fetchCreditUsage.mockReset();
        fetchCreditCharges.mockReset();
    });

    it("shows balance, jobs (unknown key as Other AI use) and recent charges", async () => {
        fetchCreditUsage.mockResolvedValue(usage());
        renderIt();
        expect(await screen.findByText("Credits left")).toBeTruthy();
        expect(screen.getByText("40")).toBeTruthy();
        expect(screen.getAllByText("Ask Genos").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Other AI use").length).toBeGreaterThan(0);
        expect(screen.getByText("3.5")).toBeTruthy();
        // the long schedule name stays in one truncated line, full text in the title
        expect(screen.getByTitle(/AI sentences in scheduled reports · x{200}/)).toBeTruthy();
    });

    it("empty state when there is no use", async () => {
        fetchCreditUsage.mockResolvedValue(
            usage({ by_job: [], recent: [], month_total_credits: 0 })
        );
        renderIt();
        expect(await screen.findByText("No AI use yet this month")).toBeTruthy();
    });

    it("error state retries", async () => {
        fetchCreditUsage.mockResolvedValueOnce(null).mockResolvedValueOnce(usage());
        renderIt();
        fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
        expect(await screen.findByText("Credits left")).toBeTruthy();
        expect(fetchCreditUsage).toHaveBeenCalledTimes(2);
    });

    it("credits null: no tiles, says the plan limits daily requests", async () => {
        fetchCreditUsage.mockResolvedValue(usage({ credits: null, period_end_iso: null }));
        renderIt();
        await waitFor(() => expect(screen.getByText(/limits daily AI requests/)).toBeTruthy());
        expect(screen.queryByText("Credits left")).toBeNull();
        expect(screen.queryByRole("button", { name: "Buy credits" })).toBeNull();
    });

    it("buy credits goes to the packs, upgrade only on Free", async () => {
        const away = vi.fn();
        fetchCreditUsage.mockResolvedValue(usage());
        renderIt(away);
        fireEvent.click(await screen.findByRole("button", { name: "Buy credits" }));
        expect(away).toHaveBeenCalled();
        expect(navigate).toHaveBeenCalledWith("/workspace/plans#credit-packs");
        fireEvent.click(screen.getByRole("button", { name: "Upgrade plan" }));
        expect(navigate).toHaveBeenLastCalledWith("/workspace/plans");
    });

    it("no upgrade button on a paid plan", async () => {
        fetchCreditUsage.mockResolvedValue(usage({ tier: "pro" }));
        renderIt();
        await screen.findByRole("button", { name: "Buy credits" });
        expect(screen.queryByRole("button", { name: "Upgrade plan" })).toBeNull();
    });

    it("names connected apps and explains Other AI use under its line", async () => {
        fetchCreditUsage.mockResolvedValue(
            usage({
                by_job: [
                    { job: "connected_app", count: 3, credits: 1 },
                    { job: "brand_new", count: 1, credits: 2 },
                ],
            })
        );
        renderIt();
        await screen.findByText("Credits left");
        expect(screen.getAllByText("AI searches from connected apps").length).toBeGreaterThan(0);
        expect(screen.getByText(/ran in Genos/)).toBeTruthy();
        expect(screen.getByText(/no name of its own yet/)).toBeTruthy();
    });

    it("a charge no job names shows its raw source", async () => {
        fetchCreditUsage.mockResolvedValue(
            usage({
                recent: [
                    {
                        id: 9,
                        at: new Date().toISOString(),
                        job: "other",
                        credits: 0.2,
                        detail: "",
                        source: "new_thing",
                    },
                ],
            })
        );
        renderIt();
        expect(await screen.findByText("Other AI use (new_thing)")).toBeTruthy();
    });

    it("Recent charges: Load more appends the next page, then the button is gone", async () => {
        fetchCreditUsage.mockResolvedValue(usage({ next_cursor: 1 }));
        fetchCreditCharges.mockResolvedValue({
            recent: [
                {
                    id: 0,
                    at: new Date().toISOString(),
                    job: "summary",
                    credits: 0.7,
                    detail: "",
                    source: "",
                },
            ],
            next_cursor: null,
        });
        renderIt();
        fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
        await waitFor(() => expect(screen.getByText("0.7")).toBeTruthy());
        expect(fetchCreditCharges).toHaveBeenCalledWith("tok", 1);
        expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
        expect(screen.getByRole("status").textContent).toBe("No more charges.");
        // focus lands on the first NEW row
        const rows = screen.getByRole("list", { name: "Recent charges" }).children;
        expect(document.activeElement).toBe(rows[2]);
    });

    it("Recent charges: a failed page keeps the rows and offers Try again", async () => {
        fetchCreditUsage.mockResolvedValue(usage({ next_cursor: 1 }));
        fetchCreditCharges.mockResolvedValueOnce(null);
        renderIt();
        fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
        expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
        expect(screen.getByText("3.5")).toBeTruthy();
    });

    it("no Load more when the first page is everything", async () => {
        fetchCreditUsage.mockResolvedValue(usage());
        renderIt();
        await screen.findByText("Credits left");
        expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    });
});
