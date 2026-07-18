/**
 * Spotlight service-filter tests.
 *
 * Covers the two halves of the feature:
 *   - `useSpotlight` — active filter chips map to the `entity_types`
 *     wire field on BOTH search lanes (keyword + hybrid); no chips →
 *     the key is omitted entirely (byte-identical to the pre-filter
 *     request); closing the overlay resets the selection.
 *   - `SpotlightOverlay` — the chip row renders in search mode only:
 *     it disappears the moment an ask starts (agent mode) and clicking
 *     a chip reports the toggled service.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_ASK_STATE } from "../features/agentQA/types";
import { SpotlightOverlay } from "../features/spotlight/SpotlightOverlay";
import { useSpotlight } from "../features/spotlight/useSpotlight";
import { searchSpotlight } from "../services/searchApi";

vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return {
        ...actual,
        askAgentStream: vi.fn(),
        decideAgent: vi.fn(),
        fetchAgentSessionDetail: vi.fn(async () => null),
        fetchAgentSessions: vi.fn(async () => []),
        fetchAgentUsage: vi.fn(async () => null),
        submitAgentFeedback: vi.fn(async () => true),
    };
});

vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));

vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

describe("useSpotlight service filter → entity_types wire field", () => {
    beforeEach(() => {
        vi.mocked(searchSpotlight).mockClear();
        localStorage.clear();
    });

    it("omits entity_types with no chips, sends mapped types once toggled", async () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );
        act(() => {
            result.current.open();
            result.current.setQuery("meeting");
        });
        // Typing path: debounced, then both lanes fire without the key.
        await waitFor(() => {
            expect(searchSpotlight).toHaveBeenCalledTimes(2);
        });
        for (const [args] of vi.mocked(searchSpotlight).mock.calls) {
            expect(args.entity_types).toBeUndefined();
        }

        vi.mocked(searchSpotlight).mockClear();
        act(() => {
            result.current.onToggleFilterService("task");
        });
        // Chip path: same query → no debounce; task expands to
        // task + milestone on both lanes.
        await waitFor(() => {
            expect(searchSpotlight).toHaveBeenCalledTimes(2);
        });
        for (const [args] of vi.mocked(searchSpotlight).mock.calls) {
            expect(args.entity_types).toEqual(["task", "milestone"]);
        }

        // Deselecting the last chip goes back to omitting the key.
        vi.mocked(searchSpotlight).mockClear();
        act(() => {
            result.current.onToggleFilterService("task");
        });
        await waitFor(() => {
            expect(searchSpotlight).toHaveBeenCalledTimes(2);
        });
        for (const [args] of vi.mocked(searchSpotlight).mock.calls) {
            expect(args.entity_types).toBeUndefined();
        }
    });

    it("resets the selection when the overlay closes", async () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );
        act(() => {
            result.current.open();
            result.current.onToggleFilterService("chat");
            result.current.onToggleFilterService("note");
        });
        expect(result.current.filterServices).toEqual(["chat", "note"]);
        act(() => {
            result.current.close();
        });
        await waitFor(() => {
            expect(result.current.filterServices).toEqual([]);
        });
    });
});

// ---- Overlay: chips are a search-mode-only surface --------------------

const overlayProps = () => ({
    isOpen: true,
    onClose: vi.fn(),
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
    dailyUsage: null,
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

const renderOverlay = (props: ReturnType<typeof overlayProps>) =>
    render(
        <CssVarsProvider>
            <SpotlightOverlay {...props} />
        </CssVarsProvider>
    );

describe("SpotlightOverlay filter chips", () => {
    it("shows all four service chips in search mode and reports toggles", async () => {
        const user = userEvent.setup();
        const props = overlayProps();
        renderOverlay(props);

        // The row leads with a "Filters" text label.
        expect(screen.getByText("Filters")).toBeTruthy();
        // The chip label span is pointer-events: none in Joy — the
        // clickable surface is the ChipAction button, which takes its
        // accessible name from the label.
        expect(screen.getByRole("button", { name: "Chats" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Notes" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Todos" })).toBeTruthy();

        await user.click(screen.getByRole("button", { name: "Chats" }));
        expect(props.onToggleFilterService).toHaveBeenCalledWith("chat");
        await user.click(screen.getByRole("button", { name: "Tasks" }));
        expect(props.onToggleFilterService).toHaveBeenCalledWith("task");
    });

    it("hides the chips the moment an ask starts (agent mode)", () => {
        const props = overlayProps();
        props.ask = { ...EMPTY_ASK_STATE, isStreaming: true, askedQuery: "why?" };
        renderOverlay(props);

        expect(screen.queryByText("Filters")).toBeNull();
        expect(screen.queryByText("Chats")).toBeNull();
        expect(screen.queryByText("Tasks")).toBeNull();
        expect(screen.queryByText("Notes")).toBeNull();
        expect(screen.queryByText("Todos")).toBeNull();
    });

    it("marks active chips with aria-pressed", () => {
        const props = overlayProps();
        props.filterServices = ["chat"];
        renderOverlay(props);

        expect(screen.getByRole("button", { name: "Chats", pressed: true })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Tasks", pressed: false })).toBeTruthy();
        expect(document.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
    });
});
