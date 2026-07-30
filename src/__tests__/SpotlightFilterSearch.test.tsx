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
import { askAgentStream } from "../services/agentApi";
import { searchSpotlight } from "../services/searchApi";

vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return {
        ...actual,
        askAgentStream: vi.fn(),
        decideAgent: vi.fn(),
        fetchAgentSessionDetail: vi.fn(async () => null),
        fetchAgentSessions: vi.fn(async () => []),
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
        vi.mocked(askAgentStream).mockClear();
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

    it("filter chips never scope the ask (search-only)", async () => {
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onDone("sess-1", "run-1");
        });
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );
        act(() => {
            result.current.open();
            // A mix of groundable + search-only chips.
            result.current.onToggleFilterService("task");
            result.current.onToggleFilterService("answer");
        });
        act(() => {
            result.current.onAsk("which task first?");
        });
        await waitFor(() => {
            expect(askAgentStream).toHaveBeenCalledTimes(1);
        });
        // Search-only: the ask carries no entity_types, so Genos always
        // answers from the full workspace regardless of active chips.
        expect(vi.mocked(askAgentStream).mock.calls[0][0]).not.toHaveProperty("entityTypes");
    });

    it("asks without chips carry no entityTypes", async () => {
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onDone("sess-1", "run-1");
        });
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );
        act(() => {
            result.current.open();
        });
        act(() => {
            result.current.onAsk("anything");
        });
        await waitFor(() => {
            expect(askAgentStream).toHaveBeenCalledTimes(1);
        });
        expect(vi.mocked(askAgentStream).mock.calls[0][0]).not.toHaveProperty("entityTypes");
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

// ---- Project filter → project_ids wire field --------------------------
//
// Same contract as the service chips (omit when empty, both lanes, never
// reaches the ask), with one addition: ids are numbers in the app but
// strings on the wire, because the index stores project_id as a keyword.

describe("useSpotlight project filter → project_ids wire field", () => {
    beforeEach(() => {
        vi.mocked(searchSpotlight).mockClear();
        vi.mocked(askAgentStream).mockClear();
        localStorage.clear();
    });

    it("omits project_ids until projects are picked, then sends them stringified", async () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );
        act(() => {
            result.current.open();
            result.current.setQuery("launch");
        });
        await waitFor(() => {
            expect(searchSpotlight).toHaveBeenCalledTimes(2);
        });
        for (const [args] of vi.mocked(searchSpotlight).mock.calls) {
            expect(args.project_ids).toBeUndefined();
        }

        vi.mocked(searchSpotlight).mockClear();
        act(() => {
            result.current.onChangeFilterProjects([7, 12]);
        });
        // Same query → no debounce. BOTH lanes must carry the scope, or
        // the fast keyword pass paints rows from excluded projects that
        // then visibly swap out.
        await waitFor(() => {
            expect(searchSpotlight).toHaveBeenCalledTimes(2);
        });
        expect(vi.mocked(searchSpotlight).mock.calls).toHaveLength(2);
        for (const [args] of vi.mocked(searchSpotlight).mock.calls) {
            expect(args.project_ids).toEqual(["7", "12"]);
        }
        // Exactly one of the two lanes is the keyword fast pass.
        const vectorFlags = vi
            .mocked(searchSpotlight)
            .mock.calls.map(([args]) => args.use_vector)
            .sort();
        expect(vectorFlags).toEqual([false, true]);

        // Clearing the selection goes back to omitting the key.
        vi.mocked(searchSpotlight).mockClear();
        act(() => {
            result.current.onChangeFilterProjects([]);
        });
        await waitFor(() => {
            expect(searchSpotlight).toHaveBeenCalledTimes(2);
        });
        for (const [args] of vi.mocked(searchSpotlight).mock.calls) {
            expect(args.project_ids).toBeUndefined();
        }
    });

    it("composes with the service chips", async () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );
        act(() => {
            result.current.open();
            result.current.setQuery("launch");
        });
        await waitFor(() => expect(searchSpotlight).toHaveBeenCalled());

        vi.mocked(searchSpotlight).mockClear();
        act(() => {
            result.current.onToggleFilterService("task");
            result.current.onChangeFilterProjects([7]);
        });
        await waitFor(() => {
            expect(searchSpotlight).toHaveBeenCalled();
        });
        const last = vi.mocked(searchSpotlight).mock.calls.at(-1)![0];
        expect(last.entity_types).toEqual(["task", "milestone"]);
        expect(last.project_ids).toEqual(["7"]);
    });

    it("never scopes the ask (search-only)", async () => {
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onDone("sess-1", "run-1");
        });
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );
        act(() => {
            result.current.open();
            result.current.onChangeFilterProjects([7, 12]);
        });
        act(() => {
            result.current.onAsk("what is blocked?");
        });
        await waitFor(() => {
            expect(askAgentStream).toHaveBeenCalledTimes(1);
        });
        // Genos always answers from the full workspace: narrowing what
        // the user BROWSES must never narrow what the agent can reason
        // over. (Scoping the ask by filter was reverted — fe #177.)
        const askArgs = vi.mocked(askAgentStream).mock.calls[0][0];
        expect(askArgs).not.toHaveProperty("project_ids");
        expect(askArgs).not.toHaveProperty("projectIds");
    });

    it("resets the project selection when the overlay closes", async () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );
        act(() => {
            result.current.open();
            result.current.onChangeFilterProjects([7]);
        });
        expect(result.current.filterProjectIds).toEqual([7]);
        act(() => {
            result.current.close();
        });
        await waitFor(() => {
            expect(result.current.filterProjectIds).toEqual([]);
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
        expect(screen.getByRole("button", { name: "Genos answers" })).toBeTruthy();

        await user.click(screen.getByRole("button", { name: "Chats" }));
        expect(props.onToggleFilterService).toHaveBeenCalledWith("chat");
        await user.click(screen.getByRole("button", { name: "Tasks" }));
        expect(props.onToggleFilterService).toHaveBeenCalledWith("task");
        await user.click(screen.getByRole("button", { name: "Genos answers" }));
        expect(props.onToggleFilterService).toHaveBeenCalledWith("answer");
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
        expect(screen.queryByText("Genos answers")).toBeNull();
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

// ---- Overlay: the project picker ---------------------------------------

const PROJECTS = [
    { projectId: 7, projectName: "Apollo", projectTags: [], isJoined: true },
    { projectId: 12, projectName: "Borealis", projectTags: [], isJoined: true },
];

describe("SpotlightOverlay project filter", () => {
    it("renders the picker next to the service chips in search mode", () => {
        const props = { ...overlayProps(), projects: PROJECTS, onChangeFilterProjects: vi.fn() };
        renderOverlay(props);

        // Placeholder doubles as the "no scope" affordance.
        expect(screen.getByPlaceholderText("All projects")).toBeTruthy();
        // Still in the same row as the service chips.
        expect(screen.getByText("Filters")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Genos answers" })).toBeTruthy();
    });

    it("hides the picker in agent mode, like the chips", () => {
        const props = { ...overlayProps(), projects: PROJECTS, onChangeFilterProjects: vi.fn() };
        props.ask = { ...EMPTY_ASK_STATE, isStreaming: true, askedQuery: "why?" };
        renderOverlay(props);

        expect(screen.queryByPlaceholderText("All projects")).toBeNull();
    });

    it("does not render when no projects were threaded", () => {
        // Callers that don't wire the prop (and teams with no projects)
        // keep exactly the pre-feature filter row.
        renderOverlay(overlayProps());
        expect(screen.queryByPlaceholderText("All projects")).toBeNull();
    });

    it("shows the scoped-project count and clears it in one click", async () => {
        const user = userEvent.setup();
        const onChangeFilterProjects = vi.fn();
        const props = {
            ...overlayProps(),
            projects: PROJECTS,
            filterProjectIds: [7, 12],
            onChangeFilterProjects,
        };
        renderOverlay(props);

        // The picker collapses tags to "+N", so the count is spelled out
        // beside it and doubles as a one-click clear. Click the
        // ChipAction button, not the label span — the label is
        // pointer-events: none in Joy (see the service-chip test above).
        await user.click(screen.getByRole("button", { name: "2 projects ×" }));
        expect(onChangeFilterProjects).toHaveBeenCalledWith([]);
    });
});
