// An approved agent write to a note, a note folder or the Favorites list has to
// reach the notes sidebar without a reload. Three links, each tested here:
//   1. NOTE_SIDEBAR_TOOLS names the tools (the way TASK_WRITE_TOOLS does).
//   2. useAgentQA and useSpotlight dispatch `noteChanged` for exactly those
//      tools when their tool result arrives.
//   3. useNoteManagement answers `noteChanged` by re-reading the folder lists
//      and Favorites as well as the note meta. Before this, only the meta was
//      re-read, so an agent-made folder or star stayed out of the sidebar.

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NOTE_SIDEBAR_TOOLS } from "../features/agentQA/noteWriteTools";
import { useAgentQA } from "../features/agentQA/useAgentQA";
import { loadFavoriteNotesMeta } from "../features/notes/favorite-notes/services";
import { loadMyNoteFolders } from "../features/notes/my-notes/services/loadMyNoteFolders";
import { loadTeamNoteFolders } from "../features/notes/team-notes/services/loadTeamNoteFolders";
import { useSpotlight } from "../features/spotlight/useSpotlight";
import { useNoteManagement } from "../hooks/notes/useNoteManagement";
import { askAgentStream } from "../services/agentApi";
import type { UserProps } from "../types/admin";

vi.mock("../services/agentApi", () => ({
    askAgentStream: vi.fn(),
    decideAgent: vi.fn(),
    fetchAgentSessionDetail: vi.fn(async () => null),
    fetchAgentSessions: vi.fn(async () => []),
    fetchAgentUsage: vi.fn(async () => null),
    submitAgentFeedback: vi.fn(async () => true),
}));

vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));

vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

vi.mock("../features/notes/my-notes/services/loadMyNoteFolders", () => ({
    loadMyNoteFolders: vi.fn(async () => []),
}));

vi.mock("../features/notes/team-notes/services/loadTeamNoteFolders", () => ({
    loadTeamNoteFolders: vi.fn(async () => []),
}));

vi.mock("../features/notes/favorite-notes/services", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/notes/favorite-notes/services")>()),
    loadFavoriteNotesMeta: vi.fn(async () => undefined),
}));

const NOTE_CHANGED = "noteChanged";

// Streams one tool result, then finishes the turn.
const streamToolResult = (tool_name: string) =>
    vi.mocked(askAgentStream).mockImplementation(async (args) => {
        args.onToolStart?.({ step: 0, tool_name, arguments: {} });
        args.onToolResult?.({ step: 0, tool_name, summary: "ok" });
        args.onDelta("answer");
        args.onDone("sess-1", "run-1");
    });

const listenForNoteChanged = () => {
    const seen = vi.fn();
    window.addEventListener(NOTE_CHANGED, seen);
    return { seen, stop: () => window.removeEventListener(NOTE_CHANGED, seen) };
};

describe("NOTE_SIDEBAR_TOOLS", () => {
    it("covers the note writes, the folder tool and the favorite tool", () => {
        for (const name of ["create_note", "update_note", "manage_note_folder", "favorite_note"]) {
            expect(NOTE_SIDEBAR_TOOLS.has(name)).toBe(true);
        }
    });

    it("leaves out the reads and the other writes", () => {
        for (const name of ["list_note_folders", "get_note", "create_task", "manage_project"]) {
            expect(NOTE_SIDEBAR_TOOLS.has(name)).toBe(false);
        }
    });
});

describe.each([
    [
        "useSpotlight",
        async (tool: string) => {
            streamToolResult(tool);
            const { result } = renderHook(() =>
                useSpotlight({ accessToken: "test-token", teamId: "team-1" })
            );
            act(() => {
                result.current.onAsk("q");
            });
            await waitFor(() => expect(result.current.turns).toHaveLength(1));
        },
    ],
    [
        "useAgentQA",
        async (tool: string) => {
            streamToolResult(tool);
            const { result } = renderHook(() =>
                useAgentQA({ accessToken: "test-token", teamId: "team-1" })
            );
            act(() => {
                result.current.onAsk("q");
            });
            await waitFor(() => expect(result.current.turns).toHaveLength(1));
        },
    ],
] as const)("%s dispatches noteChanged for an approved note-sidebar tool", (_name, runTurn) => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it.each(["create_note", "update_note", "manage_note_folder", "favorite_note"])(
        "%s",
        async (tool) => {
            const { seen, stop } = listenForNoteChanged();
            await runTurn(tool);
            stop();
            expect(seen).toHaveBeenCalledTimes(1);
        }
    );

    it.each(["list_note_folders", "get_note", "manage_project"])("%s does not", async (tool) => {
        const { seen, stop } = listenForNoteChanged();
        await runTurn(tool);
        stop();
        expect(seen).not.toHaveBeenCalled();
    });
});

describe("useNoteManagement answers noteChanged", () => {
    const myself = { teamId: "team-1", userId: "user-1" } as UserProps;

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("re-reads the folder lists and Favorites, not only the note meta", async () => {
        renderHook(() => useNoteManagement(myself, "test-token"));
        // Let mount-time work settle so it isn't counted as the refresh.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        vi.mocked(loadMyNoteFolders).mockClear();
        vi.mocked(loadTeamNoteFolders).mockClear();
        vi.mocked(loadFavoriteNotesMeta).mockClear();

        await act(async () => {
            window.dispatchEvent(new CustomEvent(NOTE_CHANGED));
        });

        await waitFor(() => {
            expect(loadMyNoteFolders).toHaveBeenCalledTimes(1);
            expect(loadTeamNoteFolders).toHaveBeenCalledTimes(1);
            expect(loadFavoriteNotesMeta).toHaveBeenCalledTimes(1);
        });
    });
});
