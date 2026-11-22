/**
 * MIP-2002: the agent-input `#` picker (Spotlight, Ask modals, to-do pane) serves other projects'
 * tasks from the server task search per query, like the editors' menu, and never loads the team's
 * whole open-task list (`/search/teamTasks/?top_n=-1`).
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HASH_SEARCH_DEBOUNCE_MS } from "../components/editors/hashTaskSearch";
import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";
import { type AgentMentionCandidate } from "../features/agentQA/mentions/types";
import { useAgentMentionDraft } from "../features/agentQA/mentions/useAgentMentionDraft";
import { useAgentMentionSources } from "../features/agentQA/mentions/useAgentMentionSources";
import { savedTaskIds } from "../features/chat/components/todo/titleMentionsHelpers";
import type { TodoGroupProps } from "../types/chat";
import type { SearchTeamTasksResponse } from "../types/tasks";

const searchTasksMock = vi.hoisted(() => vi.fn());
vi.mock("../features/tasks/services/searchTasks", () => ({ searchTasks: searchTasksMock }));
const teamListMock = vi.hoisted(() => vi.fn());
vi.mock("../features/tasks/services/loadTaskSearchList", () => ({
    loadTeamTaskList: teamListMock,
}));

const row = (over: Partial<SearchTeamTasksResponse>) =>
    ({
        projectId: 2,
        projectName: "Marketing",
        taskId: 9,
        displayId: "MKT-9",
        title: "Launch post",
        isMilestone: false,
        status: { code: 0, status: "Open", color: "", textColor: "" },
        ...over,
    }) as unknown as SearchTeamTasksResponse;

const DATA: HashMentionData = {
    tasks: [],
    notes: [],
    chats: [],
    allChats: [],
    projects: [],
    todoGroups: [],
    myself: { teamId: 5 } as never,
    refresh: () => {},
};
const wrapper = ({ children }: { children: React.ReactNode }) => (
    <HashMentionDataProvider value={DATA}>{children}</HashMentionDataProvider>
);

beforeEach(() => {
    searchTasksMock.mockReset();
    teamListMock.mockReset();
    searchTasksMock.mockResolvedValue({ results: [row({})], hasMore: false });
});

describe("useAgentMentionSources.searchTasks", () => {
    it("asks the server search (bounded) and returns task candidates", async () => {
        const { result } = renderHook(() => useAgentMentionSources({ membersOverride: [] }), {
            wrapper,
        });
        const rows = await result.current.searchTasks("launch");
        expect(searchTasksMock).toHaveBeenCalledTimes(1);
        expect(searchTasksMock.mock.calls[0][2]).toMatchObject({ q: "launch", limit: 20 });
        expect(rows).toHaveLength(1);
        expect(rows[0].ref).toMatchObject({ kind: "task", taskId: 9, label: "Launch post" });
        expect(rows[0].subtitle).toBe("MKT-9");
    });

    it("never loads the team's whole task list", async () => {
        const { result } = renderHook(() => useAgentMentionSources({ membersOverride: [] }), {
            wrapper,
        });
        await result.current.searchTasks("launch");
        expect(teamListMock).not.toHaveBeenCalled();
        expect(result.current).not.toHaveProperty("ensureTeamTasks");
    });
});

describe("useAgentMentionDraft with a server task search", () => {
    const candidate = (taskId: number, label: string): AgentMentionCandidate =>
        ({
            ref: { kind: "task", taskId, label },
            trigger: "#",
            key: `task:${taskId}`,
            subtitle: `MKT-${taskId}`,
        }) as AgentMentionCandidate;

    const setup = (
        value: string,
        searchTasks: (q: string) => Promise<AgentMentionCandidate[]>
    ) => {
        const hook = renderHook(
            ({ v }: { v: string }) =>
                useAgentMentionDraft({
                    value: v,
                    onChange: () => {},
                    members: [],
                    entities: [],
                    searchTasks,
                }),
            { initialProps: { v: value } }
        );
        act(() => hook.result.current.setCaret(value.length));
        return hook;
    };

    it("offers a task of another project that the pool does not hold", async () => {
        const search = vi.fn().mockResolvedValue([candidate(9, "Launch post")]);
        const hook = setup("see #launch", search);
        await waitFor(() => expect(hook.result.current.suggestions).toHaveLength(1));
        expect(search).toHaveBeenCalledWith("launch");
        expect(hook.result.current.suggestions[0].ref).toMatchObject({ taskId: 9 });
    });

    it("sends nothing for plain text, an @ mention or a bare #", () => {
        const search = vi.fn().mockResolvedValue([]);
        setup("hello", search);
        setup("@al", search);
        setup("#", search);
        expect(search).not.toHaveBeenCalled();
    });

    it("drops rows that belong to an older query", async () => {
        let resolveFirst: (rows: AgentMentionCandidate[]) => void = () => {};
        const search = vi
            .fn()
            .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
            .mockResolvedValueOnce([candidate(10, "Launch day")]);
        const hook = setup("#la", search);
        hook.rerender({ v: "#lau" });
        act(() => hook.result.current.setCaret(4));
        await waitFor(() => expect(hook.result.current.suggestions).toHaveLength(1));
        await act(async () => resolveFirst([candidate(9, "Lazy")]));
        expect(hook.result.current.suggestions.map((c) => c.key)).toEqual(["task:10"]);
    });
});

describe("saved #ID tokens in to-do titles", () => {
    const group = (titles: string[]): TodoGroupProps =>
        ({
            groupId: 1,
            localDate: "2099-01-01",
            isCompleted: false,
            items: titles.map((title, i) => ({ itemId: i, title, isCompleted: false })),
        }) as unknown as TodoGroupProps;

    it("lists each task id once, ignoring titles-as-text and mid-word hashes", () => {
        expect(
            savedTaskIds([
                group(["Review #MIP-12 today", "#mip-12 again", "Fix #Login bug", "a#GEN-3"]),
                group(["#GEN-4"]),
            ])
        ).toEqual(["GEN-4", "MIP-12"]);
    });
});

// Keeps the debounce constant honest: the search is the editors' one (200 ms).
it("uses the editors' debounce", () => {
    expect(HASH_SEARCH_DEBOUNCE_MS).toBe(200);
});
