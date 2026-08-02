/**
 * Only Gemini is offered in the model picker for now.
 *
 * This is a *product* rule with no server enforcement behind it, which
 * makes it exactly the kind that regresses silently — someone adds a
 * provider to the catalog, it appears in the dropdown, and nothing
 * fails. So the rule is pinned here rather than living only in a `Set`
 * literal.
 *
 * The picker is rendered through `LlmModelSection`, the single
 * implementation both the main Settings modal and the Spotlight
 * settings modal use — so asserting once covers both surfaces.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LlmModelSection } from "../components/layout/SettingsModal";
import { en } from "../i18n/locales/en";

const strings = en.settings.llmModel;

let currentProvider = "gemini";

// The section reads its catalog from this hook and nothing else, so the
// hook is the whole boundary worth stubbing.
vi.mock("../hooks/common/useLlmModelPreference", () => ({
    useLlmModelPreference: () => ({
        loading: false,
        setChoice: vi.fn(),
        setEffort: vi.fn(),
        data: {
            tier: "pro",
            current: { provider: currentProvider, model: "m1", effort: "low" },
            models: [
                { provider: "gemini", model: "m1", label: "Gemini Flash", note: "" },
                { provider: "claude", model: "m2", label: "Claude Sonnet", note: "" },
                { provider: "openai", model: "m3", label: "GPT", note: "" },
            ],
            // The section also renders the daily-usage rows; they are
            // not what this test is about, but they must be present or
            // it fails on the render rather than the assertion.
            limits: {
                llm_ask: { used: 0, limit: 100 },
                web_search: { used: 0, limit: 10 },
            },
        },
    }),
}));

const renderSection = () =>
    render(
        <CssVarsProvider>
            <LlmModelSection />
        </CssVarsProvider>
    );

/** Open the provider dropdown and return its options.
 *
 * There are two comboboxes in this section — provider, then model (or
 * effort). Provider is the first, and its position is part of the
 * layout being asserted: it is the control the user reaches first.
 */
const openProviderMenu = async () => {
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("combobox")[0]);
    return screen.getAllByRole("option");
};

describe("provider hold-back", () => {
    it("offers Gemini and disables the providers held back", async () => {
        currentProvider = "gemini";
        renderSection();
        const options = await openProviderMenu();
        const byLabel = (label: string) => options.find((o) => o.textContent?.includes(label));

        const gemini = byLabel(strings.providerGemini);
        const claude = byLabel(strings.providerClaude);
        const openai = byLabel(strings.providerOpenai);

        expect(gemini, "Gemini must stay selectable").toBeDefined();
        expect(gemini).not.toHaveAttribute("aria-disabled", "true");

        for (const [name, option] of [
            [strings.providerClaude, claude],
            [strings.providerOpenai, openai],
        ] as const) {
            expect(option, `${name} must still be LISTED, not removed`).toBeDefined();
            expect(option, `${name} must not be selectable`).toHaveAttribute(
                "aria-disabled",
                "true"
            );
            expect(
                within(option!).getByText(strings.providerComingSoon),
                `${name} must say why it is unavailable`
            ).toBeTruthy();
        }
    });

    it("leaves a user's own current provider selectable", async () => {
        // Someone already on Claude opening their own settings must not
        // find their current choice greyed out — that reads as "your
        // setting is broken", not "this one is paused".
        currentProvider = "claude";
        renderSection();
        const options = await openProviderMenu();
        const claude = options.find((o) => o.textContent?.includes(strings.providerClaude));
        expect(claude).toBeDefined();
        expect(claude).not.toHaveAttribute("aria-disabled", "true");

        const openai = options.find((o) => o.textContent?.includes(strings.providerOpenai));
        expect(openai, "the others stay held back").toHaveAttribute("aria-disabled", "true");
    });
});
