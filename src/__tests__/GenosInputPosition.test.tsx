/**
 * The Genos page input must have exactly TWO vertical positions in search
 * mode: centered while the box is empty, and lifted to a fixed offset once
 * anything is typed — including a query that finds nothing. It must NOT
 * track the result count, which used to walk it up and down as a search
 * widened and re-narrowed mid-typing.
 *
 * The host (`GenosHome`) centers its column, so two CSS pieces override
 * that while a query is live:
 *   - the results card takes an auto bottom margin, which consumes the
 *     free space `justify-content` would otherwise distribute;
 *   - a fixed-height spacer (`order: -1`, so it precedes the host's hero)
 *     sets how far down the block rests — deliberately fixed, so the
 *     offset can't follow the card's height.
 * An empty query removes both, restoring the centered hero.
 *
 * jsdom has no layout engine, so these assert the CSS contract that
 * produces the position (card in/out of flow, the space-absorbing margin,
 * the spacer's fixed height), not measured pixel positions.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EMPTY_ASK_STATE } from "../features/agentQA/types";
import { SpotlightContent } from "../features/spotlight/SpotlightContent";
import type { SpotlightResult } from "../features/spotlight/types";

vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));

const result = (id: string, title: string): SpotlightResult =>
    ({
        entity_type: "task",
        entity_id: id,
        title,
        snippet: "",
        score: 1,
        matched_chunk_types: [],
    }) as unknown as SpotlightResult;

const contentProps = (over: { query?: string; results?: SpotlightResult[] }) => ({
    query: over.query ?? "",
    onQueryChange: vi.fn(),
    results: over.results ?? [],
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
});

// The results region is the scroll container that wraps the rows / the
// no-matches hint. It's the last flex item of the host column.
const resultsCard = (container: HTMLElement) =>
    container.querySelector('[class*="custom-scrollbar"]') as HTMLElement;

// The resting-offset spacer: the only aria-hidden empty div in the tree.
const spacer = (container: HTMLElement) => container.querySelector('div[aria-hidden="true"]');

const renderPage = (over: { query?: string; results?: SpotlightResult[] }) =>
    render(
        <CssVarsProvider>
            <SpotlightContent {...contentProps(over)} />
        </CssVarsProvider>
    );

describe("Genos page input position", () => {
    it("leaves the column centered while the box is empty", () => {
        const { container } = renderPage({ query: "" });
        // Card out of the flow → nothing absorbs the column's free space,
        // and no spacer, so the host's `justify-content: center` wins.
        expect(resultsCard(container)).toHaveStyle({ display: "none" });
        expect(spacer(container)).toBeNull();
    });

    it("lifts the input the moment text is typed, before any results arrive", () => {
        const { container } = renderPage({ query: "" });
        // Type into the box. `results` is still empty and the hook-level
        // `query` prop hasn't been updated (it's debounced), so this is
        // the earliest possible moment — the flip must already have
        // happened off the input's own text.
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "quarterly" } });
        const card = resultsCard(container);
        expect(card).not.toHaveStyle({ display: "none" });
        expect(card).toHaveStyle({ marginBottom: "auto" });
        // Rests partway up, NOT against the top of the page.
        expect(spacer(container)).toHaveStyle({ height: "18dvh" });
    });

    it("holds the same offset when the query finds nothing", () => {
        const { container } = renderPage({ query: "zzz no matches", results: [] });
        expect(screen.getByText(/No matches yet/)).toBeInTheDocument();
        expect(resultsCard(container)).toHaveStyle({ marginBottom: "auto" });
        expect(spacer(container)).toHaveStyle({ height: "18dvh" });
    });

    it("holds the same offset with many results and with few", () => {
        const many = Array.from({ length: 12 }, (_, i) => result(String(i), `Task ${i}`));
        const { container: manyEl } = renderPage({ query: "task", results: many });
        const { container: fewEl } = renderPage({ query: "task 1", results: many.slice(0, 2) });
        // Identical offset either way: the card's own height changes below
        // the input, never the space above it. This is the regression the
        // whole arrangement exists to prevent.
        for (const el of [manyEl, fewEl]) {
            expect(resultsCard(el)).toHaveStyle({ marginBottom: "auto" });
            expect(spacer(el)).toHaveStyle({ height: "18dvh" });
        }
    });

    it("adds no spacer in the overlay, which has its own sheet layout", () => {
        const { container } = render(
            <CssVarsProvider>
                <SpotlightContent {...contentProps({ query: "quarterly" })} variant="overlay" />
            </CssVarsProvider>
        );
        expect(spacer(container)).toBeNull();
    });
});
