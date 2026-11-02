/**
 * `/privacy` — the privacy policy. Pins what must never silently
 * vanish or drift: the operative heading, every processor the code sends
 * data to (in BOTH languages), the hosting statement, the in-app
 * deletion route, the opt-out claim, and the contact address. Also pins
 * the claims that must NOT come back until verified.
 *
 * When a processor is added or removed, update `PROCESSORS` in
 * privacyProcessors.ts AND `EXPECTED_PROCESSORS` here (that duplication is the
 * point: it makes a silent edit to the table show up in review).
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import PrivacyPage from "../lp/PrivacyPage";
import { PROCESSORS } from "../lp/privacyProcessors";

const EXPECTED_PROCESSORS = [
    "Railway",
    "Google（Gemini）",
    "Anthropic（Claude）",
    "OpenAI",
    "Cohere",
    "Tavily",
    "Stripe",
    "Resend",
    "PostHog",
    "GIPHY",
    "Google（サインイン・カレンダー）",
    "GitHub",
    "ブラウザ提供元のプッシュ通知サービス（Apple・Google・Mozilla）",
];

const renderPage = () =>
    render(
        <MemoryRouter>
            <PrivacyPage />
        </MemoryRouter>
    );

/** The Japanese and English sections, split at the English heading. */
const splitText = (text: string) => {
    const at = text.indexOf("Privacy Policy (English summary)");
    expect(at).toBeGreaterThan(0);
    return { ja: text.slice(0, at), en: text.slice(at) };
};

describe("PrivacyPage", () => {
    it("renders the operative policy and both language sections", () => {
        renderPage();
        expect(screen.getByText("プライバシーポリシー")).toBeTruthy();
        expect(screen.getByText("Privacy Policy (English summary)")).toBeTruthy();
        // Hide-not-delete honesty.
        expect(screen.getByText(/データの削除ではありません/)).toBeTruthy();
        // The contact address is a link in the Japanese and the English requests sections.
        expect(screen.getAllByText("genos.support@genosai.dev").length).toBe(2);
    });

    it("lists exactly the expected processors, in both languages", () => {
        const { container } = renderPage();
        expect(PROCESSORS.map((p) => p.name)).toEqual(EXPECTED_PROCESSORS);
        const { ja, en } = splitText(container.textContent ?? "");
        for (const name of EXPECTED_PROCESSORS) {
            expect(ja, `JA missing ${name}`).toContain(name);
            expect(en, `EN missing ${name}`).toContain(name);
        }
        // Each processor has real text in both languages, not a stub.
        for (const p of PROCESSORS) {
            expect(p.ja.length).toBeGreaterThan(20);
            expect(p.en.length).toBeGreaterThan(20);
        }
    });

    it("discloses the processors the page used to omit, with what they receive", () => {
        const { container } = renderPage();
        const { ja, en } = splitText(container.textContent ?? "");
        // OpenAI embeddings of indexed content.
        expect(ja).toMatch(/OpenAI：検索のための埋め込み/);
        expect(en).toMatch(/OpenAI: Embeddings for search/);
        // Cohere only when configured.
        expect(ja).toMatch(/Cohere：検索結果の並べ替え.*設定した場合のみ/);
        expect(en).toMatch(/Cohere: Used only when it is configured/);
        // GIPHY media is loaded by the browser from GIPHY directly.
        expect(ja).toMatch(/GIPHY.*ブラウザが直接読み込む/);
        expect(en).toMatch(/GIPHY.*loaded by your browser directly/);
        // Google sign-in and calendar.
        expect(ja).toMatch(/Google（サインイン・カレンダー）.*カレンダー/);
        expect(en).toMatch(/Signing in with Google.*calendar/);
    });

    it("describes the analytics truthfully: team ID, not the team name, and not anonymous", () => {
        const { container } = renderPage();
        const { ja, en } = splitText(container.textContent ?? "");
        expect(ja).toMatch(/PostHog：プロダクト分析。ユーザー ID、チーム ID、役割/);
        expect(en).toMatch(/PostHog: Product analytics\. Your user ID, team ID, role/);
        expect(ja).toContain("チーム名は送信しません");
        expect(en).toContain("The team name is not sent");
        // The data is tied to the user id, so the page must not call it anonymous.
        expect(en).toMatch(/PostHog: Product analytics[^]*?\(not anonymous\)/);
        // The opt-out path matches the Settings UI (General → Privacy & analytics).
        expect(ja).toContain("「設定 → 一般 → プライバシーと分析」");
        expect(en).toContain("Settings → General → Privacy & analytics");
    });

    it("states the hosting as Railway only", () => {
        const { container } = renderPage();
        const text = container.textContent ?? "";
        expect(text).toContain("Railway 上でのみ稼働");
        expect(text).toContain("Production runs on Railway only");
        // Production is not on Google Cloud (paused); do not claim it.
        expect(text).not.toMatch(/Google Cloud/);
    });

    it("points deletion at the in-app flow and keeps a contact route", () => {
        const { container } = renderPage();
        const { ja, en } = splitText(container.textContent ?? "");
        expect(ja).toContain("「設定 → アカウント → アカウントを削除」");
        expect(en).toContain("Settings → Account → Delete account");
        // The old "email us to delete your data" instruction is gone, but a
        // fallback for people who cannot sign in remains.
        expect(ja).toContain("サインインできない場合");
        expect(en).toContain("If you cannot sign in");
        // Honest about what in-app deletion does NOT reach.
        expect(ja).toContain("自動的には削除されません");
        expect(en).toContain("not deleted automatically");
    });

    it("does not make claims that are unverified or placeholders", () => {
        const { container } = renderPage();
        const text = container.textContent ?? "";
        // No visible placeholders for the owner.
        expect(text).not.toMatch(/TODO|TBD|FIXME/);
        // The "does not train on your data" promise is unverified (MIP-729):
        // reinstate only after the owner confirms the agreement.
        expect(text).not.toMatch(/学習/);
        expect(text).not.toMatch(/do not train|don't train|not train/i);
        expect(text).not.toMatch(/business-tier|business APIs/i);
        // No compliance regimes or certifications asserted.
        expect(text).not.toMatch(/GDPR|CCPA|SOC ?2|ISO ?27001|HIPAA/i);
    });
});
