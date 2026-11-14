// What an approved agent convert or project move of a milestone has to change in the browser (MIP-1564):
//   1. emitMilestoneChangeToolResult, for a convert, forgets the cached full copy of the converted row
//      (it describes the other kind of thing), drops a load in flight, tells the open task, and asks
//      for the project to be re-read; for a move it asks for BOTH projects to be re-read and drops no
//      copy (the app's own move does not); it does nothing for another tool, no ref, or no usable id.
//   2. useAgentQA calls it when the tool result arrives (the decide/resume stream reuses the handler).

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { invalidateCachedFullTask } from "../db/services/task-full.service";
import { emitMilestoneChangeToolResult } from "../features/agentQA/approvedTaskWrites";
import { useAgentQA } from "../features/agentQA/useAgentQA";
import {
    onTasksBulkChanged,
    onTaskTouched,
    type TaskTouchedDetail,
} from "../features/tasks/services/taskEvents";
import { forgetInFlightTask } from "../features/tasks/services/taskLoadInFlight";
import { askAgentStream, type ToolResultMilestoneChangeRef } from "../services/agentApi";

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

vi.mock("../features/tasks/services/taskLoadInFlight", () => ({
    forgetInFlightTask: vi.fn(),
    inFlightTaskLoads: { get: vi.fn() },
    inFlightTaskKey: vi.fn(),
}));

vi.mock("../db/services/task-full.service", () => ({
    invalidateCachedFullTask: vi.fn(async () => undefined),
    getCachedFullTask: vi.fn(async () => null),
    cacheFullTask: vi.fn(async () => undefined),
}));

const CONVERT: ToolResultMilestoneChangeRef = {
    kind: "convert",
    direction: "task_to_milestone",
    task_id: 7,
    milestone_id: 3,
    project_id: 11,
};
const MOVE: ToolResultMilestoneChangeRef = {
    kind: "move",
    task_id: 7,
    milestone_id: 3,
    project_id: 12,
    from_project_id: 11,
};

const listen = () => {
    const touched: TaskTouchedDetail[] = [];
    const bulk: Array<number | undefined> = [];
    const stops = [
        onTaskTouched((d) => touched.push(d)),
        onTasksBulkChanged((d) => bulk.push(d.projectId)),
    ];
    return { touched, bulk, stop: () => stops.forEach((s) => s()) };
};

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
});

describe("emitMilestoneChangeToolResult", () => {
    it("for a convert forgets the row's cached copy, tells the open task and re-reads the project", async () => {
        const seen = listen();
        emitMilestoneChangeToolResult("manage_milestone", CONVERT);
        await waitFor(() => expect(seen.touched).toEqual([{ taskId: 7, kind: "update" }]));
        seen.stop();
        expect(invalidateCachedFullTask).toHaveBeenCalledExactlyOnceWith(7);
        expect(forgetInFlightTask).toHaveBeenCalledExactlyOnceWith(7);
        expect(seen.bulk).toEqual([11]);
    });

    it("works the same for a milestone turned into a task", async () => {
        const seen = listen();
        emitMilestoneChangeToolResult("manage_milestone", {
            ...CONVERT,
            direction: "milestone_to_task",
        });
        await waitFor(() => expect(seen.bulk).toEqual([11]));
        seen.stop();
        expect(invalidateCachedFullTask).toHaveBeenCalledExactlyOnceWith(7);
    });

    it("for a move re-reads BOTH projects and drops no copy", () => {
        const seen = listen();
        emitMilestoneChangeToolResult("manage_milestone", MOVE);
        seen.stop();
        expect(seen.bulk).toEqual([11, 12]);
        expect(invalidateCachedFullTask).not.toHaveBeenCalled();
        expect(seen.touched).toEqual([]);
    });

    it("re-reads only the project it has an id for", () => {
        const seen = listen();
        emitMilestoneChangeToolResult("manage_milestone", { kind: "move", project_id: 12 });
        emitMilestoneChangeToolResult("manage_milestone", { kind: "move", from_project_id: 11 });
        seen.stop();
        expect(seen.bulk).toEqual([12, 11]);
    });

    it.each([
        ["no ref (an older backend)", "manage_milestone", undefined],
        ["a ref on another tool", "update_task", CONVERT],
        [
            "a convert with no usable ids",
            "manage_milestone",
            { kind: "convert", task_id: "x", project_id: 0 },
        ],
        [
            "a convert with fractional ids",
            "manage_milestone",
            { kind: "convert", task_id: 1.5, project_id: 2.5 },
        ],
        [
            "a kind it does not know",
            "manage_milestone",
            { kind: "rename", task_id: 7, project_id: 11 },
        ],
    ])("does nothing for %s", (_label, tool, ref) => {
        const seen = listen();
        emitMilestoneChangeToolResult(tool, ref as ToolResultMilestoneChangeRef | undefined);
        seen.stop();
        expect(invalidateCachedFullTask).not.toHaveBeenCalled();
        expect(seen.touched).toEqual([]);
        expect(seen.bulk).toEqual([]);
    });
});

describe("useAgentQA passes an approved convert or move on to the browser", () => {
    const streamToolResult = (
        tool_name: string,
        milestone_change?: ToolResultMilestoneChangeRef
    ) =>
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onToolStart?.({ step: 0, tool_name, arguments: {} });
            args.onToolResult?.({ step: 0, tool_name, summary: "ok", milestone_change });
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

    it("forgets the converted row and re-reads its project", async () => {
        const seen = listen();
        streamToolResult("manage_milestone", CONVERT);
        await runTurn();
        await waitFor(() => expect(invalidateCachedFullTask).toHaveBeenCalledExactlyOnceWith(7));
        expect(seen.bulk).toContain(11);
        seen.stop();
    });

    it("re-reads both projects after a move", async () => {
        const seen = listen();
        streamToolResult("manage_milestone", MOVE);
        await runTurn();
        await waitFor(() => expect(seen.bulk).toEqual([11, 12]));
        seen.stop();
    });

    it("does nothing for an ordinary milestone write", async () => {
        const seen = listen();
        streamToolResult("manage_milestone");
        await runTurn();
        expect(invalidateCachedFullTask).not.toHaveBeenCalled();
        expect(seen.bulk).toEqual([]);
        seen.stop();
    });
});
