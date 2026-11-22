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
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import PrivacyPage from "../lp/PrivacyPage";
import { PROCESSORS } from "../lp/privacyProcessors";

const EXPECTED_PROCESSORS = [
    "Railway",
    "Google Cloud Storage",
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
        // Counted inside the page's <main>: the shared footer (LpShell) repeats it too.
        expect(
            within(screen.getByRole("main")).getAllByText("genos.support@genosai.dev").length
        ).toBe(2);
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
        expect(ja).toMatch(/OpenAI：設定により選択された場合のみ/);
        expect(en).toMatch(/OpenAI: Used only when it is configured/);
        // Production embeddings are on Google Cloud (Vertex AI), and the page says so.
        expect(ja).toMatch(/Google（Gemini）.*検索用の索引（埋め込み）.*Vertex AI/);
        expect(en).toMatch(/Google（Gemini）[^]*?embeddings[^]*?Vertex AI/);
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
        expect(ja).toMatch(/PostHog：プロダクト分析。同意していただいた場合にのみ送信します。/);
        expect(en).toMatch(/PostHog: Product analytics, sent only with your consent\./);
        // The device fields the in-app analytics sends are listed, not left out.
        expect(ja).toMatch(/ユーザーエージェント、ページのタイトルも送信します/);
        expect(en).toMatch(/user agent and page title are also sent/);
        expect(ja).toContain("チーム名は送信しません");
        expect(en).toContain("The team name is not sent");
        // The data is tied to the user id once signed in, so the page must not call it anonymous.
        expect(en).toMatch(/PostHog: Product analytics[^]*?\(not anonymous\)/);
        expect(ja).toContain("クリックの自動取得とセッション録画は行っていません");
        expect(en).toContain("Click auto-capture and session recording are not used");
    });

    // MIP-1792 (2026-11-21): the PostHog row now says what the in-app analytics sends
    // (device fields), that the IP is not stored by PostHog, and that deletion does not
    // reach PostHog. Counsel's wording is still pending (MIP-1800); pin the facts here.
    it("pins the PostHog facts: consent first, device fields in the app, IP not stored", () => {
        const posthog = PROCESSORS.find((p) => p.name === "PostHog");
        expect(posthog?.ja).toContain("同意していただいた場合にのみ送信します");
        expect(posthog?.ja).toContain("IP アドレスは、PostHog で保存しないよう設定しています");
        expect(posthog?.ja).toContain(
            "アカウントを削除しても、PostHog 上の情報は自動では削除されません"
        );
        expect(posthog?.en).toContain("sent only with your consent");
        expect(posthog?.en).toContain("IP addresses are set not to be stored by PostHog");
        expect(posthog?.en).toContain("Deleting your account does not automatically delete");
        expect(posthog?.en).toContain("Click auto-capture and session recording are not used");
    });

    it("states the hosting as Railway, and discloses the Google Cloud Storage cost reports", () => {
        const { container } = renderPage();
        const text = container.textContent ?? "";
        expect(text).toContain("本番環境は Railway 上で稼働");
        expect(text).toContain("Production runs on Railway");
        // The AI cost reports are uploaded to a Cloud Storage bucket (per-user pages stopped, MIP-1791).
        const { ja, en } = splitText(text);
        expect(ja).toMatch(/Google Cloud Storage：AI 利用料の集計ページ/);
        expect(ja).toContain("Vertex AI");
        expect(en).toContain("AI features call Google Vertex AI");
        expect(en).toMatch(/Google Cloud Storage: Stores the daily AI cost reports/);
    });

    it("says the Stripe billing owner's email is sent for a team, not a team email (MIP-1904)", () => {
        const stripe = PROCESSORS.find((p) => p.name === "Stripe");
        expect(stripe?.ja).toContain("チームのオーナー）のメールアドレス");
        expect(stripe?.ja).not.toContain("チームのメールアドレスが送信");
        expect(stripe?.en).toContain("email address of the billing owner");
        expect(stripe?.en).not.toContain("team name and team email");
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
        // Stripe keeps the customer record after account deletion (MIP-874).
        expect(ja).toMatch(
            /Stripe[^]*?アカウントを削除しても、Stripe 上の顧客情報と請求履歴は削除されず/
        );
        expect(en).toMatch(
            /Stripe[^]*?does not delete your customer record or billing history at Stripe/
        );
    });

    it("states the backup retention in both languages (MIP-1976)", () => {
        const { container } = renderPage();
        const { ja, en } = splitText(container.textContent ?? "");
        expect(ja).toMatch(/バックアップ[^]*?最長27日間[^]*?既存のバックアップからは/);
        expect(en).toMatch(/backups of our database and of uploaded files for up to\s+27 days/);
        expect(en).toContain("does not remove it from existing backups until they expire");
    });

    // MIP-2007: DRAFT wording for counsel. Pin the facts the agent-call log promises, so the
    // page cannot drift from them (what is kept, what is never kept, who sees it, 90 days,
    // export, account deletion).
    it("states the private AI-app call log in both languages (MIP-2007 draft)", () => {
        const { container } = renderPage();
        const { ja, en } = splitText(container.textContent ?? "");
        expect(ja).toMatch(/AI アプリの呼び出しログ[^]*?ツールの名前[^]*?ID[^]*?日時[^]*?アプリ/);
        expect(ja).toMatch(/引数、検索のキーワード、結果）は保存しません/);
        expect(ja).toMatch(/ご本人のみで[^]*?件数だけ/);
        expect(ja).toMatch(/90\s*日間保存されたのち削除され、データのエクスポートに含まれます/);
        expect(ja).toMatch(/アカウントを削除すると、記録も削除されます/);
        expect(en).toMatch(/AI-app call log:[^]*?which tool was called[^]*?which app made\s+it/);
        expect(en).toMatch(/no arguments, no search text,\s+no results/);
        expect(en).toMatch(/Only you can see your records; a team owner sees only counts/);
        expect(en).toMatch(
            /kept for 90 days[^]*?included if\s+you export your data[^]*?delete your account/
        );
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
