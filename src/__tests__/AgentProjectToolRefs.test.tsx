// What an approved agent project write has to change in the browser, beyond the
// transcript. Three links, each tested here:
//   1. emitProjectToolResult turns a tool result into the right window event:
//      `projectDeleted` for a delete_project that reports `project.deleted`,
//      and an inbox resync for the two join-request answers, and nothing else.
//   2. useAgentQA and useSpotlight call it when their tool result arrives (the
//      decide/resume stream reuses these same handlers).
//   3. useProjectManagement answers `projectDeleted` the way ModalDeleteProject
//      answers a 204 (leave the project's page if it is open, and drop it from
//      the team project list), without calling the delete endpoint.

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    emitProjectToolResult,
    PROJECT_DELETED_EVENT,
    type ProjectDeletedDetail,
} from "../features/agentQA/approvedProjectWrites";
import { useAgentQA } from "../features/agentQA/useAgentQA";
import { INBOX_RESYNC_EVENT, type InboxResyncDetail } from "../features/inbox/inboxResyncEvent";
import { useSpotlight } from "../features/spotlight/useSpotlight";
import { useProjectManagement } from "../hooks/common/useProjectManagement";
import { askAgentStream, type ToolResultProjectRef } from "../services/agentApi";
import { authApi } from "../services/api";
import type { UserProps } from "../types/admin";
import type { ProjectProps } from "../types/tasks";

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

// The project hook must never reach the delete endpoint: the server already
// deleted the project. Any api object the code asks for records its calls.
const apiDelete = vi.fn();
vi.mock("../services/api", () => ({
    authApi: vi.fn(() => ({ delete: apiDelete, get: vi.fn(async () => ({ data: [] })) })),
}));

const DELETED: ToolResultProjectRef = { project_id: 42, deleted: true };

const listen = <T,>(name: string) => {
    const seen: T[] = [];
    const onEvent = (event: Event) => seen.push((event as CustomEvent<T>).detail);
    window.addEventListener(name, onEvent);
    return { seen, stop: () => window.removeEventListener(name, onEvent) };
};

describe("emitProjectToolResult", () => {
    it("announces a deleted project, by id, for delete_project's ref", () => {
        const deleted = listen<ProjectDeletedDetail>(PROJECT_DELETED_EVENT);
        const resync = listen<InboxResyncDetail>(INBOX_RESYNC_EVENT);
        emitProjectToolResult("delete_project", DELETED);
        deleted.stop();
        resync.stop();
        expect(deleted.seen).toEqual([{ projectId: 42 }]);
        expect(resync.seen).toEqual([]);
    });

    it.each([
        ["no ref (an older backend)", "delete_project", undefined],
        ["a ref that is not a delete", "delete_project", { project_id: 42, deleted: false }],
        ["a ref with no usable id", "delete_project", { project_id: "x", deleted: true }],
        ["a ref on another tool", "manage_project", DELETED],
    ])("announces nothing for %s", (_label, tool, ref) => {
        const deleted = listen<ProjectDeletedDetail>(PROJECT_DELETED_EVENT);
        emitProjectToolResult(tool, ref as ToolResultProjectRef | undefined);
        deleted.stop();
        expect(deleted.seen).toEqual([]);
    });

    it.each(["approve_join_request", "decline_join_request"])(
        "asks for an inbox sync after %s, and announces no deleted project",
        (tool) => {
            const resync = listen<InboxResyncDetail>(INBOX_RESYNC_EVENT);
            const deleted = listen<ProjectDeletedDetail>(PROJECT_DELETED_EVENT);
            emitProjectToolResult(tool);
            resync.stop();
            deleted.stop();
            // `done` is the reply channel `requestInboxResync` adds; only the reason matters here.
            expect(resync.seen).toEqual([
                expect.objectContaining({ reason: "agent-write", deliveredTag: undefined }),
            ]);
            expect(deleted.seen).toEqual([]);
        }
    );

    it.each([
        "manage_project_members",
        "add_project_tag",
        "manage_project_labels",
        "delete_project",
        "list_my_inbox",
    ])("does not ask for an inbox sync after %s", (tool) => {
        const resync = listen<InboxResyncDetail>(INBOX_RESYNC_EVENT);
        emitProjectToolResult(tool, tool === "delete_project" ? DELETED : undefined);
        resync.stop();
        expect(resync.seen).toEqual([]);
    });
});

// Streams one tool result, then finishes the turn.
const streamToolResult = (tool_name: string, project?: ToolResultProjectRef) =>
    vi.mocked(askAgentStream).mockImplementation(async (args) => {
        args.onToolStart?.({ step: 0, tool_name, arguments: {} });
        args.onToolResult?.({ step: 0, tool_name, summary: "ok", project });
        args.onDelta("answer");
        args.onDone("sess-1", "run-1");
    });

describe.each([
    [
        "useSpotlight",
        async () => {
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
        async () => {
            const { result } = renderHook(() =>
                useAgentQA({ accessToken: "test-token", teamId: "team-1" })
            );
            act(() => {
                result.current.onAsk("q");
            });
            await waitFor(() => expect(result.current.turns).toHaveLength(1));
        },
    ],
] as const)("%s passes an approved project write on to the browser", (_name, runTurn) => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it("announces the deleted project from delete_project's ref", async () => {
        const deleted = listen<ProjectDeletedDetail>(PROJECT_DELETED_EVENT);
        streamToolResult("delete_project", DELETED);
        await runTurn();
        deleted.stop();
        expect(deleted.seen).toEqual([{ projectId: 42 }]);
    });

    it.each(["approve_join_request", "decline_join_request"])(
        "asks for an inbox sync after %s",
        async (tool) => {
            const resync = listen<InboxResyncDetail>(INBOX_RESYNC_EVENT);
            streamToolResult(tool);
            await runTurn();
            resync.stop();
            expect(resync.seen).toHaveLength(1);
        }
    );

    it("does neither for an unrelated tool", async () => {
        const deleted = listen<ProjectDeletedDetail>(PROJECT_DELETED_EVENT);
        const resync = listen<InboxResyncDetail>(INBOX_RESYNC_EVENT);
        streamToolResult("manage_project_members");
        await runTurn();
        deleted.stop();
        resync.stop();
        expect(deleted.seen).toEqual([]);
        expect(resync.seen).toEqual([]);
    });
});

describe("useProjectManagement answers projectDeleted", () => {
    // No teamId/userId, so the hook's own load-on-mount effect stays idle and
    // only the lists this test sets are in play.
    const myself = { teamId: "", userId: "" } as UserProps;
    const project = (projectId: number, projectName: string): ProjectProps => ({
        projectId,
        projectName,
        projectTags: [],
    });

    const setUp = () => {
        const hook = renderHook(() => useProjectManagement(myself, "test-token", ""));
        act(() => {
            hook.result.current.setTeamProjects([
                project(41, "Marketing"),
                project(42, "Website Redesign"),
                project(43, "Support"),
            ]);
            hook.result.current.setCurrentProject(project(42, "Website Redesign"));
        });
        return hook;
    };
    const announce = (projectId: number) =>
        act(() => {
            window.dispatchEvent(
                new CustomEvent<ProjectDeletedDetail>(PROJECT_DELETED_EVENT, {
                    detail: { projectId },
                })
            );
        });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("closes the page of the open project and takes it out of the project list", () => {
        const { result } = setUp();
        announce(42);
        expect(result.current.currentProject).toBeNull();
        expect(result.current.teamProjects.map((p) => p.projectId)).toEqual([41, 43]);
    });

    it("leaves the open project alone when another one was deleted", () => {
        const { result } = setUp();
        announce(43);
        expect(result.current.currentProject?.projectId).toBe(42);
        expect(result.current.teamProjects.map((p) => p.projectId)).toEqual([41, 42]);
    });

    it("never calls the delete endpoint: the server already deleted the project", () => {
        setUp();
        announce(42);
        expect(apiDelete).not.toHaveBeenCalled();
        expect(vi.mocked(authApi)).not.toHaveBeenCalled();
    });

    it("ignores a malformed event", () => {
        const { result } = setUp();
        act(() => {
            window.dispatchEvent(new CustomEvent(PROJECT_DELETED_EVENT));
            window.dispatchEvent(
                new CustomEvent(PROJECT_DELETED_EVENT, { detail: { projectId: "42" } })
            );
        });
        expect(result.current.currentProject?.projectId).toBe(42);
        expect(result.current.teamProjects).toHaveLength(3);
    });

    it("removes its listener when the hook unmounts", () => {
        const add = vi.spyOn(window, "addEventListener");
        const remove = vi.spyOn(window, "removeEventListener");
        const hook = setUp();
        const added = add.mock.calls.filter(([type]) => type === PROJECT_DELETED_EVENT);
        expect(added).toHaveLength(1);
        hook.unmount();
        const removed = remove.mock.calls.filter(([type]) => type === PROJECT_DELETED_EVENT);
        expect(removed.map(([, handler]) => handler)).toEqual(added.map(([, handler]) => handler));
        add.mockRestore();
        remove.mockRestore();
    });
});
