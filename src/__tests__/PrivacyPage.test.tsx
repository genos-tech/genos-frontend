/**
 * `/privacy` — the privacy policy. Pins what must never silently
 * vanish: the operative heading, the processor list (every subprocessor
 * we actually use), the opt-out claim, and the contact address.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import PrivacyPage from "../lp/PrivacyPage";

describe("PrivacyPage", () => {
    it("renders the operative policy with the real processor list", () => {
        render(
            <MemoryRouter>
                <PrivacyPage />
            </MemoryRouter>
        );
        expect(screen.getByText("プライバシーポリシー")).toBeTruthy();
        // Processors we actually use — keep in sync with the stack.
        expect(screen.getByText(/Stripe（決済処理）/)).toBeTruthy();
        expect(screen.getByText(/Google Gemini \/ Anthropic Claude（AI 機能/)).toBeTruthy();
        // Tavily / Resend appear once per language section.
        expect(screen.getAllByText(/Tavily/).length).toBe(2);
        expect(screen.getByText(/PostHog（プロダクト分析/)).toBeTruthy();
        expect(screen.getAllByText(/Resend/).length).toBe(2);
        // Hide-not-delete honesty + deletion on request.
        expect(screen.getByText(/データの削除ではありません/)).toBeTruthy();
        // Contact appears in both language sections.
        expect(screen.getAllByText("genos.support@genosai.dev").length).toBe(2);
        expect(screen.getByText("Privacy Policy (English summary)")).toBeTruthy();
    });
});
