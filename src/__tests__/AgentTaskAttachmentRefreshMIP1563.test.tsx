// What an approved delete of a task's file has to change in the browser (MIP-1563):
//   1. emitTaskAttachmentToolResult forgets the cached full copy of the task (it still lists the
//      file: a file delete does not move the task's updatedAt), drops a load in flight, and tells the
//      open task it was touched; it does nothing for any other tool, a ref with no usable id, or a
//      ref that is not a delete.
//   2. useAgentQA calls it when the tool result arrives (the decide/resume stream reuses the handler).

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { invalidateCachedFullTask } from "../db/services/task-full.service";
import { emitTaskAttachmentToolResult } from "../features/agentQA/approvedTaskWrites";
import { useAgentQA } from "../features/agentQA/useAgentQA";
import { onTaskTouched, type TaskTouchedDetail } from "../features/tasks/services/taskEvents";
import { askAgentStream, type ToolResultTaskAttachmentRef } from "../services/agentApi";

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

vi.mock("../db/services/task-full.service", () => ({
    invalidateCachedFullTask: vi.fn(async () => undefined),
    getCachedFullTask: vi.fn(async () => null),
    cacheFullTask: vi.fn(async () => undefined),
}));

const DELETED: ToolResultTaskAttachmentRef = { task_id: 7, attachment_id: 2, deleted: true };

const listenTouched = () => {
    const seen: TaskTouchedDetail[] = [];
    const stop = onTaskTouched((d) => seen.push(d));
    return { seen, stop };
};

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
});

describe("emitTaskAttachmentToolResult", () => {
    it("forgets the cached task and tells the open task, for delete_task_attachment's ref", () => {
        const touched = listenTouched();
        emitTaskAttachmentToolResult("delete_task_attachment", DELETED);
        touched.stop();
        expect(invalidateCachedFullTask).toHaveBeenCalledExactlyOnceWith(7);
        expect(touched.seen).toEqual([{ taskId: 7, kind: "update" }]);
    });

    it.each([
        ["no ref (an older backend)", "delete_task_attachment", undefined],
        ["a ref that is not a delete", "delete_task_attachment", { task_id: 7, deleted: false }],
        ["a ref with no usable id", "delete_task_attachment", { task_id: "x", deleted: true }],
        ["a ref with a zero id", "delete_task_attachment", { task_id: 0, deleted: true }],
        ["a ref on another tool", "delete_comment", DELETED],
    ])("does nothing for %s", (_label, tool, ref) => {
        const touched = listenTouched();
        emitTaskAttachmentToolResult(tool, ref as ToolResultTaskAttachmentRef | undefined);
        touched.stop();
        expect(invalidateCachedFullTask).not.toHaveBeenCalled();
        expect(touched.seen).toEqual([]);
    });
});

describe("useAgentQA passes an approved file delete on to the browser", () => {
    const streamToolResult = (tool_name: string, task_attachment?: ToolResultTaskAttachmentRef) =>
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onToolStart?.({ step: 0, tool_name, arguments: {} });
            args.onToolResult?.({ step: 0, tool_name, summary: "ok", task_attachment });
            args.onDelta("answer");
            args.onDone("sess-1", "run-1");
        });

    const runTurn = async () => {
        const { result } = renderHook(() =>
            useAgentQA({ accessToken: "test-token", teamId: "team-1" })
        );
        act(() => {
            result.current.onAsk("q");
        });
        await waitFor(() => expect(result.current.turns).toHaveLength(1));
    };

    it("forgets the cached task from delete_task_attachment's ref", async () => {
        streamToolResult("delete_task_attachment", DELETED);
        await runTurn();
        expect(invalidateCachedFullTask).toHaveBeenCalledExactlyOnceWith(7);
    });

    it("does nothing for an unrelated tool", async () => {
        streamToolResult("add_comment");
        await runTurn();
        expect(invalidateCachedFullTask).not.toHaveBeenCalled();
    });
});
