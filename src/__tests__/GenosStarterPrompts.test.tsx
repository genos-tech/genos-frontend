/**
 * The Genos page's empty state offers one-click starter questions, because an
 * empty input is a dead end: nothing on the page says what Genos can be
 * *asked* rather than searched, so a first-time visitor may never ask
 * anything — and no amount of answer quality fixes an unasked question.
 *
 * Four things are pinned here, each of which was a real decision rather than
 * an incidental detail:
 *
 *  1. A click asks IMMEDIATELY, via `onAsk(text)`. The `overrideQuery`
 *     argument exists precisely so an ask can bypass the input (the retry
 *     button on past turns uses it too); going through `onQueryChange` would
 *     put a 150ms debounce and a render cycle between the click and the ask,
 *     and would leave the question sitting in the box afterwards.
 *  2. They are HIDDEN, not disabled, when AI answers are off. `onAsk` returns
 *     silently in that state (useSpotlight.ts), so a visible chip would do
 *     nothing whatsoever on click — strictly worse than not being there. This
 *     is the opposite of the service filter chips right below them, which
 *     stay visible-but-disabled because they describe a selection that still
 *     exists.
 *  3. They vanish the moment the visitor types. A starter replacing their own
 *     half-written question would throw the text away.
 *  4. The overlay (⌘K) does not get them: it is opened deliberately, by
 *     someone who already knows what Spotlight is.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EMPTY_ASK_STATE } from "../features/agentQA/types";
import { SpotlightContent } from "../features/spotlight/SpotlightContent";
import { en } from "../i18n/locales/en";

vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));

// Stands in for a translated catalog. Non-English locales are
// `DeepPartial<Messages>` deep-merged onto English, and `deepMerge` replaces
// arrays WHOLESALE — so whatever a locale puts at `spotlight.starters.items`
// is what the component sees, including `[]` or something that isn't an array
// at all. There is no way to reach that through the real catalogs (they all
// inherit English's three), so the hook is intercepted instead.
const startersOverride: { value?: unknown } = {};

vi.mock("../i18n", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../i18n")>();
    return {
        ...actual,
        useTranslation: () => {
            const real = actual.useTranslation();
            if (!("value" in startersOverride)) return real;
            return {
                ...real,
                t: {
                    ...real.t,
                    spotlight: {
                        ...real.t.spotlight,
                        starters: {
                            ...real.t.spotlight.starters,
                            items: startersOverride.value,
                        },
                    },
                },
            };
        },
    };
});

afterEach(() => {
    delete startersOverride.value;
});

const STARTERS = en.spotlight.starters.items;

const contentProps = (over: Record<string, unknown> = {}) => ({
    query: "",
    onQueryChange: vi.fn(),
    results: [],
    isLoading: false,
    error: null,
    filterServices: [],
    onToggleFilterService: vi.fn(),
    onSelect: vi.fn(),
    onPreview: vi.fn(),
    onAsk: vi.fn(),
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onCancel: vi.fn(),
    onNewConversation: vi.fn(),
    ask: { ...EMPTY_ASK_STATE },
    turns: [],
    aiAnswersEnabled: true,
    historyMode: "closed" as const,
    historySessions: [],
    historyDetail: null,
    historyIsLoading: false,
    openHistory: vi.fn(),
    viewHistorySession: vi.fn(),
    backToHistoryList: vi.fn(),
    closeHistory: vi.fn(),
    onOpenSettings: vi.fn(),
    variant: "page" as const,
    ...over,
});

const renderContent = (over: Record<string, unknown> = {}) => {
    const props = contentProps(over);
    const utils = render(
        <CssVarsProvider>
            <SpotlightContent {...props} />
        </CssVarsProvider>
    );
    return { ...utils, props };
};

// The starter row is a labelled group, so it can be found the way a screen
// reader would rather than by class or DOM position.
const starterRow = () => screen.queryByRole("group", { name: en.spotlight.starters.label });

describe("Genos page starter prompts", () => {
    it("offers every starter on the empty page", () => {
        renderContent();
        expect(starterRow()).toBeInTheDocument();
        // Absolute count, not "at least one": a row that rendered a single
        // starter would pass a looser assertion while looking broken.
        expect(STARTERS.length).toBeGreaterThan(0);
        for (const s of STARTERS) {
            expect(screen.getByRole("button", { name: s })).toBeInTheDocument();
        }
    });

    it("asks the clicked question immediately, without routing through the input", () => {
        const { props } = renderContent();
        fireEvent.click(screen.getByRole("button", { name: STARTERS[0] }));
        // The whole question, verbatim — a truncated chip label must not
        // become a truncated ask.
        expect(props.onAsk).toHaveBeenCalledWith(STARTERS[0]);
        // Not staged in the input first: that path is debounced (so the ask
        // could fire against stale text) and would leave the question in the
        // box after submitting.
        expect(props.onQueryChange).not.toHaveBeenCalled();
    });

    it("hides them when AI answers are off, rather than disabling them", () => {
        renderContent({ aiAnswersEnabled: false });
        expect(starterRow()).toBeNull();
        // Specifically NOT present-but-disabled: `onAsk` no-ops in this
        // state, so a rendered chip could never do anything.
        expect(screen.queryByRole("button", { name: STARTERS[0] })).toBeNull();
    });

    it("withdraws them as soon as the visitor types their own question", () => {
        renderContent();
        expect(starterRow()).toBeInTheDocument();
        // Keyed off the input's own text, not the debounced `query` prop —
        // the same reason the results card flips on `localInput`.
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "w" } });
        expect(starterRow()).toBeNull();
    });

    it("keeps them out of the ⌘K overlay", () => {
        renderContent({ variant: "overlay" });
        expect(starterRow()).toBeNull();
    });

    it("keeps them out of an active conversation", () => {
        // A streaming ask is the earliest point of agent mode — the panel
        // owns the surface from here, and follow-ups have their own input.
        renderContent({ ask: { ...EMPTY_ASK_STATE, isStreaming: true } });
        expect(starterRow()).toBeNull();
    });

    it("draws no row at all for a locale that ships no starters", () => {
        // A translator may legitimately leave `items: []`. The label must go
        // with them — a lone "Try asking" heading followed by nothing reads
        // as a loading failure.
        startersOverride.value = [];
        renderContent();
        expect(starterRow()).toBeNull();
        expect(screen.queryByText(en.spotlight.starters.label)).toBeNull();
    });

    it("survives a catalog where the starters aren't an array", () => {
        // Locale catalogs are plain data that a human edits; the component
        // must degrade to "no row" rather than throw on `.map`, which on this
        // surface would blank the whole Genos page.
        startersOverride.value = "What happened this week?";
        expect(() => renderContent()).not.toThrow();
        expect(starterRow()).toBeNull();
        // The input is still there — the page didn't come down with it.
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("renders exactly the starters a locale provides, not English's three", () => {
        startersOverride.value = ["なにが起きた?", "だれが担当?"];
        renderContent();
        expect(screen.getByRole("button", { name: "なにが起きた?" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "だれが担当?" })).toBeInTheDocument();
        // Not padded out with English leftovers — `deepMerge` replaces the
        // array wholesale, and the row must honour that.
        expect(screen.queryByRole("button", { name: STARTERS[2] })).toBeNull();
    });
});
