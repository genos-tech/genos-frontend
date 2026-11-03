// An approved agent write to the user's to-do list has to reach the chat-side
// to-do pane without a reload. Links, each tested here:
//   1. TODO_WRITE_TOOLS names the tools (the way NOTE_SIDEBAR_TOOLS and
//      TASK_WRITE_TOOLS do for notes and tasks).
//   2. useAgentQA and useSpotlight both dispatch `todoChanged` for exactly
//      those tools when their tool result arrives. Spotlight always did; the
//      thread and note asks (useAgentQA) never did, so a to-do written from a
//      thread or note ask stayed out of the pane until a reload.
//   3. The decide/resume stream reuses the same handlers, so the real path
//      (the write pauses for approval, the user approves) emits it too.
//   (useTodoGroups answering the event is covered in hooks/useTodoGroups.test.ts.)

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TODO_WRITE_TOOLS } from "../features/agentQA/todoWriteTools";
import { useAgentQA } from "../features/agentQA/useAgentQA";
import { useSpotlight } from "../features/spotlight/useSpotlight";
import { askAgentStream, decideAgent } from "../services/agentApi";

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

const TODO_CHANGED = "todoChanged";

const TODO_WRITES = ["create_todo_item", "update_todo_item", "delete_todo_item"];
// Reads of the to-do list change nothing; the other writes have their own
// events (tasks, notes) and must not make the to-do pane refetch.
const NOT_TODO_WRITES = [
    "list_today_todos",
    "list_uncompleted_todos",
    "create_task",
    "update_task",
    "create_note",
    "update_note",
    "create_calendar_event",
];

const listenForTodoChanged = () => {
    const seen = vi.fn();
    window.addEventListener(TODO_CHANGED, seen);
    return { seen, stop: () => window.removeEventListener(TODO_CHANGED, seen) };
};

// Streams one tool result, then finishes the turn.
const streamToolResult = (tool_name: string) =>
    vi.mocked(askAgentStream).mockImplementation(async (args) => {
        args.onToolStart?.({ step: 0, tool_name, arguments: {} });
        args.onToolResult?.({ step: 0, tool_name, summary: "ok" });
        args.onDelta("answer");
        args.onDone("sess-1", "run-1");
    });

// The write pauses for approval; the resumed (decide) stream delivers its result.
const pauseThenApproveStream = (tool_name: string) => {
    vi.mocked(askAgentStream).mockImplementation(async (args) => {
        args.onToolStart?.({ step: 0, tool_name, arguments: {} });
        args.onPendingApproval?.({
            step: 0,
            tool_name,
            arguments: {},
            approval_token: "tok",
            run_id: "run-1",
        });
    });
    vi.mocked(decideAgent).mockImplementation(async (args) => {
        args.onToolStart?.({ step: 0, tool_name, arguments: {} });
        args.onToolResult?.({ step: 0, tool_name, summary: "ok" });
        args.onDelta("answer");
        args.onDone("sess-1", "run-1");
    });
};

describe("TODO_WRITE_TOOLS", () => {
    it("covers the three to-do writes", () => {
        for (const name of TODO_WRITES) expect(TODO_WRITE_TOOLS.has(name)).toBe(true);
    });

    it("leaves out the to-do reads and every other write", () => {
        for (const name of NOT_TODO_WRITES) expect(TODO_WRITE_TOOLS.has(name)).toBe(false);
    });
});

describe.each([
    [
        "useSpotlight",
        () => {
            const { result } = renderHook(() =>
                useSpotlight({ accessToken: "test-token", teamId: "team-1" })
            );
            return result;
        },
    ],
    [
        "useAgentQA",
        () => {
            const { result } = renderHook(() =>
                useAgentQA({ accessToken: "test-token", teamId: "team-1" })
            );
            return result;
        },
    ],
] as const)("%s dispatches todoChanged for an agent to-do write", (_name, render) => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    const runTurn = async (tool: string) => {
        streamToolResult(tool);
        const result = render();
        act(() => {
            result.current.onAsk("q");
        });
        await waitFor(() => expect(result.current.turns).toHaveLength(1));
    };

    it.each(TODO_WRITES)("%s", async (tool) => {
        const { seen, stop } = listenForTodoChanged();
        await runTurn(tool);
        stop();
        expect(seen).toHaveBeenCalledTimes(1);
    });

    it.each(NOT_TODO_WRITES)("%s does not", async (tool) => {
        const { seen, stop } = listenForTodoChanged();
        await runTurn(tool);
        stop();
        expect(seen).not.toHaveBeenCalled();
    });

    it("also fires when the write was approved, not only when it ran straight away", async () => {
        pauseThenApproveStream("update_todo_item");
        const { seen, stop } = listenForTodoChanged();
        const result = render();
        act(() => {
            result.current.onAsk("move my call with Sam to tomorrow");
        });
        await waitFor(() => expect(result.current.ask.pendingApproval).not.toBeNull());
        // Paused is not written: nothing has changed yet.
        expect(seen).not.toHaveBeenCalled();

        act(() => result.current.onApprove());
        await waitFor(() => expect(result.current.turns).toHaveLength(1));
        stop();
        expect(seen).toHaveBeenCalledTimes(1);
    });
});
