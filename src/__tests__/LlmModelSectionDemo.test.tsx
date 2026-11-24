/**
 * MIP-2341: a demo visitor gets no model/effort picker.
 *
 * The server pins every demo ask to the default Gemini model and spends from a small fixed
 * budget, so a picker would offer a choice that does nothing. `LlmModelSection` is the single
 * implementation behind both the main Settings modal and the Spotlight settings modal, so
 * asserting here covers both surfaces. A real user keeps the picker.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LlmModelSection } from "../components/layout/SettingsModal";
import { en } from "../i18n/locales/en";

const strings = en.settings.llmModel;

let isDemo = false;

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

vi.mock("../hooks/common/useIsDemoUser", () => ({
    useIsDemoUser: () => isDemo,
}));

vi.mock("../hooks/common/useLlmModelPreference", () => ({
    useLlmModelPreference: () => ({
        loading: false,
        setChoice: vi.fn(),
        setEffort: vi.fn(),
        data: {
            tier: "pro",
            current: { provider: "gemini", model: "m1", effort: "low" },
            models: [
                { provider: "gemini", model: "m1", label: "Gemini Flash", note: "" },
                { provider: "claude", model: "m2", label: "Claude Sonnet", note: "" },
            ],
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

describe("LlmModelSection for a demo visitor", () => {
    beforeEach(() => {
        isDemo = false;
    });

    it("renders nothing, so neither the model nor the effort can be picked", () => {
        isDemo = true;
        const { container } = renderSection();
        expect(container).toBeEmptyDOMElement();
        expect(screen.queryAllByRole("combobox")).toHaveLength(0);
        expect(screen.queryByText(strings.heading)).toBeNull();
    });

    it("still shows the picker to a real user", () => {
        renderSection();
        expect(screen.getByText(strings.heading)).toBeInTheDocument();
        expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
    });
});
