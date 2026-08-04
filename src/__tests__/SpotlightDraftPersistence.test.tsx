/**
 * An unsent Genos draft must survive dismissing the surface — closing the
 * Cmd-K overlay or navigating off the Genos page. The draft lives in
 * `useSpotlight.query` at the App root; `SpotlightContent.localInput` is
 * only a 150 ms debounce buffer in front of it. Two mechanics make that
 * work, and both are pinned here:
 *   1. unmount FLUSHES a pending debounced write, so text typed in the
 *      last 150 ms before an Escape isn't dropped on the floor;
 *   2. mount SEEDS the input from `query`, so the draft comes back on
 *      either surface.
 * The matching hook-side contract (close/leave doesn't clear `query`, but
 * still drops results + filters) lives in SpotlightPageMode.test.tsx.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EMPTY_ASK_STATE } from "../features/agentQA/types";
import { SpotlightOverlay } from "../features/spotlight/SpotlightOverlay";

vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));

const overlayProps = (query: string, onQueryChange: (q: string) => void) => ({
    isOpen: true,
    onClose: vi.fn(),
    query,
    onQueryChange,
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
});

const renderOverlay = (query: string, onQueryChange: (q: string) => void) =>
    render(
        <CssVarsProvider>
            <SpotlightOverlay {...overlayProps(query, onQueryChange)} />
        </CssVarsProvider>
    );

describe("Spotlight draft persistence", () => {
    it("flushes the in-flight debounced write when the surface unmounts", () => {
        const onQueryChange = vi.fn();
        const { unmount } = renderOverlay("", onQueryChange);

        // Typing only touches local state — the App-level write is still
        // sitting in the 150 ms debounce window (timers never advance here).
        fireEvent.change(screen.getByRole("textbox"), {
            target: { value: "draft I did not send" },
        });
        expect(onQueryChange).not.toHaveBeenCalled();

        // Escape / click-outside unmounts the content. The pending write
        // must land rather than be cleared, or the draft is lost.
        unmount();
        expect(onQueryChange).toHaveBeenCalledWith("draft I did not send");
    });

    it("seeds the input from the preserved query on a fresh mount", () => {
        const { unmount } = renderOverlay("draft I did not send", vi.fn());
        expect(screen.getByRole("textbox")).toHaveValue("draft I did not send");
        unmount();
    });
});
