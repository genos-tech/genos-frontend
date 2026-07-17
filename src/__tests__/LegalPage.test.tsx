/**
 * `/legal` — 特定商取引法に基づく表記.
 *
 * A static legal document, so the test pins what must never silently
 * vanish: the operative Japanese heading, the cancellation/refund
 * policy rows, the live prices, and the contact address.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import LegalPage from "../lp/LegalPage";

describe("LegalPage", () => {
    it("renders the operative disclosure and policy rows", () => {
        render(
            <MemoryRouter>
                <LegalPage />
            </MemoryRouter>
        );
        expect(screen.getByText("特定商取引法に基づく表記")).toBeTruthy();
        // Cancellation + refund policy — the reason this page exists.
        expect(screen.getByText("解約について")).toBeTruthy();
        expect(screen.getByText("返金について")).toBeTruthy();
        expect(screen.getByText(/日割り返金は原則として/)).toBeTruthy();
        // Live prices as charged by Stripe — once per language section.
        expect(screen.getAllByText(/1,200/).length).toBe(2);
        expect(screen.getAllByText(/2,500/).length).toBe(2);
        // Contact address (both language sections carry it).
        expect(screen.getAllByText("genos.support@genosai.dev").length).toBe(2);
        // English summary present.
        expect(screen.getByText(/English summary/)).toBeTruthy();
    });
});
