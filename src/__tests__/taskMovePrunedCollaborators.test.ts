/**
 * A task moved to another project (MIP-1587).
 *
 * genos-api drops the collaborators who cannot open the task in the
 * destination (project member or owner, assignee, reporter). The app's copy
 * still lists them, and the next save that re-sends one is refused with HTTP
 * 400 ("not a member of this project"). After the move the working copy, the
 * preview task and the cached full task must lose exactly those people, the
 * other edits must stay, and the next save must go through.
 */
import { useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSendUpdatedTask } from "../hooks/tasks/useSendUpdatedTask";
import { useTaskEditState } from "../hooks/tasks/useTaskEditState";
import { useTaskSaveTriggers } from "../hooks/tasks/useTaskSaveTriggers";
import { UserProps } from "../types/admin";
import { TaskProps } from "../types/tasks";

const cacheFullTask = vi.fn();
const invalidateCachedFullTask = vi.fn();
vi.mock("../db/services/task-full.service", () => ({
    getCachedFullTask: vi.fn().mockResolvedValue(null),
    cacheFullTask: (...args: unknown[]) => cacheFullTask(...args),
    invalidateCachedFullTask: (...args: unknown[]) => invalidateCachedFullTask(...args),
}));
const getTasksByProject = vi.fn();
vi.mock("../db/services/task.service", () => ({
    TaskService: class {
        getTasksByProject(...args: unknown[]) {
            return getTasksByProject(...args);
        }
    },
}));
vi.mock("../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: vi.fn().mockResolvedValue([]),
}));
vi.mock("../features/tasks/services/addTask", () => ({
    addTask: vi.fn().mockResolvedValue(null),
}));
vi.mock("../features/tasks/services/uploadTaskAttachments", () => ({
    uploadTaskAttachments: vi.fn().mockResolvedValue([]),
}));
vi.mock("../services/channel/channelService", () => ({
    channelService: { updateTaskCard: vi.fn().mockResolvedValue(undefined) },
}));

const myself = { teamId: "t1", userId: "u-asg" } as unknown as UserProps;
const user = (userId: string) => ({ userId, userName: userId }) as unknown as UserProps;

// Who is on the task: the assignee and the reporter (who can always open it)
// and three collaborators. Only Bob is on the destination project.
const asg = user("u-asg");
const rep = user("u-rep");
const ann = user("u-ann"); // not on the destination
const bob = user("u-bob"); // member of the destination
const own = user("u-own"); // owner of the destination, no membership row

const makeTask = (extra: Partial<TaskProps> = {}): TaskProps =>
    ({
        id: 42,
        displayId: "KDS-42",
        title: "A task",
        body: [],
        project: { projectId: 1, projectName: "Kds", systemUserId: "sys" },
        assignee: asg,
        reporter: rep,
        priority: { priority: "Medium" },
        effortLevel: { level: "Medium" },
        status: { status: "Open" },
        dueDate: "",
        links: [],
        tags: [],
        attachments: [],
        parentTaskId: null,
        threadId: null,
        collaborators: [ann, bob, asg, rep, own],
        ...extra,
    }) as unknown as TaskProps;

const DESTINATION = {
    projectId: 2,
    projectName: "Other",
    systemUserId: "sys",
    projectTags: [],
} as unknown as TaskProps["project"];

const adapter = vi.fn();
const refuse = (config: InternalAxiosRequestConfig, data: unknown) =>
    new AxiosError("Request failed with status code 400", "ERR_BAD_REQUEST", config, null, {
        data,
        status: 400,
        statusText: "",
        headers: {},
        config,
    });
const reply = (config: InternalAxiosRequestConfig, data: unknown, status = 200) => ({
    data,
    status,
    statusText: "",
    headers: {},
    config,
});
const puts = () => adapter.mock.calls.filter(([c]) => c.method === "put");
const putBody = (n: number): Record<string, unknown> => JSON.parse(puts()[n][0].data);
const gets = (fragment: string) =>
    adapter.mock.calls.filter(([c]) => c.method === "get" && String(c.url).includes(fragment));

// The server's answers. `onMove` is what the PUT that carries the project
// change returns; any later PUT is judged like #861 does: a person who is not
// on the project and was not stored before is refused.
let stored: string[];
let moveAnswer: Record<string, unknown>;
let originalAdapter: typeof axios.defaults.adapter;
let now = 0;

const roster = (config: InternalAxiosRequestConfig) => {
    const url = String(config.url);
    if (url.includes("/project/members/"))
        return reply(config, { project_members: [{ attendee__id: "u-bob" }] });
    if (url.includes("/project/task-field-rules/"))
        return reply(config, { rules: {}, ownerUserId: "u-own" });
    return null;
};

beforeEach(() => {
    now += 60_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    vi.spyOn(console, "error").mockImplementation(() => {});
    originalAdapter = axios.defaults.adapter;
    axios.defaults.adapter = adapter;
    adapter.mockReset();
    cacheFullTask.mockReset();
    cacheFullTask.mockResolvedValue(undefined);
    invalidateCachedFullTask.mockReset();
    invalidateCachedFullTask.mockResolvedValue(undefined);
    getTasksByProject.mockReset();
    getTasksByProject.mockResolvedValue([]);
    stored = ["u-ann", "u-bob", "u-asg", "u-rep", "u-own"];
    moveAnswer = {
        task: {
            ts_updated_at: "2026-11-15T00:00:00Z",
            collaborators: ["u-bob", "u-asg", "u-rep", "u-own"],
        },
        movedFromProjectId: 1,
    };
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
        const fromRoster = roster(config);
        if (fromRoster) return fromRoster;
        if (config.method !== "put") return reply(config, {});
        const sent = JSON.parse(config.data).collaborators as string[];
        const project = JSON.parse(config.data).project as number;
        if (project === 2 && !stored.includes("moved")) {
            stored = ["moved", "u-bob", "u-asg", "u-rep", "u-own"];
            return reply(config, moveAnswer);
        }
        // #861: someone who is not stored and not allowed is refused.
        const refused = sent.find((id) => !stored.includes(id));
        if (refused)
            throw refuse(config, {
                error: `\`collaborators\`: '${refused}' is not a member of this project, so they could not open the task. Add them to the project first.`,
            });
        return reply(config, { task: { ts_updated_at: "2026-11-15T00:01:00Z" } });
    });
});

afterEach(() => {
    axios.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
});

const useHarness = (initial: TaskProps) => {
    const [preview, setPreview] = useState<TaskProps | undefined>(initial);
    const state = useTaskEditState(initial);
    const send = useSendUpdatedTask({
        socket: null,
        myself,
        accessToken: "tok",
        currentPreviewTask: preview,
        setCurrentPreviewTask: setPreview,
        taskEditState: state,
        bodyRef: { current: [] },
    });
    useTaskSaveTriggers(state, send);
    return { state, preview, send };
};
type Hook = ReturnType<typeof renderHook<ReturnType<typeof useHarness>, unknown>>;

const ids = (list: UserProps[] | undefined) => (list ?? []).map((c) => c.userId);

const edit = async (hook: Hook, change: (prev: TaskProps) => TaskProps, expectPuts: number) => {
    act(() => {
        hook.result.current.state.setTmpCurrentTaskContent(change);
        hook.result.current.state.setTaskUpdated(true);
    });
    await waitFor(() => {
        expect(puts()).toHaveLength(expectPuts);
        expect(hook.result.current.state.taskUpdated).toBe(false);
    });
    await act(async () => {});
};

const moveWithEdits = (hook: Hook) =>
    edit(
        hook,
        (prev) => ({
            ...prev,
            project: DESTINATION,
            status: { status: "WIP" } as never,
            // Outside Ann stays in the list the person sees until the move lands.
            collaborators: [ann, bob, asg, rep, own],
        }),
        1
    );

describe("collaborators after a project move", () => {
    it("drops the ones the server dropped from the working copy, the preview task and the cache, then the next save is accepted with the other edits kept", async () => {
        const hook = renderHook(() => useHarness(makeTask()));

        await moveWithEdits(hook);

        // The move PUT still carried everyone (the server judges the list
        // before it moves the task).
        expect(putBody(0).collaborators).toEqual(["u-ann", "u-bob", "u-asg", "u-rep", "u-own"]);
        // Working copy and preview task: Ann is gone, everyone else stays.
        const { state, preview } = hook.result.current;
        expect(ids(state.tmpCurrentTaskContent.collaborators)).toEqual([
            "u-bob",
            "u-asg",
            "u-rep",
            "u-own",
        ]);
        expect(ids(preview?.collaborators)).toEqual(["u-bob", "u-asg", "u-rep", "u-own"]);
        expect(state.tmpCurrentTaskContent.status.status).toBe("WIP");
        // The cached full task is written without her.
        const cached = cacheFullTask.mock.calls[0][0] as TaskProps;
        expect(ids(cached.collaborators)).toEqual(["u-bob", "u-asg", "u-rep", "u-own"]);
        expect(cached.project?.projectId).toBe(2);
        // The answer carried the list: nothing was asked of the roster.
        expect(gets("/project/members/")).toHaveLength(0);

        // The next save: no 400, and what was edited before is still there.
        await edit(hook, (prev) => ({ ...prev, priority: { priority: "High" } as never }), 2);
        expect(putBody(1).collaborators).toEqual(["u-bob", "u-asg", "u-rep", "u-own"]);
        expect(putBody(1).priority).toBe("High");
        expect(putBody(1).status).toBe("WIP");
        expect(hook.result.current.state.tmpCurrentTaskContent.status.status).toBe("WIP");
    });

    it("derives them with the picker's rule from the destination roster when the answer carries no list", async () => {
        moveAnswer = { task: { ts_updated_at: "2026-11-15T00:00:00Z" }, movedFromProjectId: 1 };
        const hook = renderHook(() => useHarness(makeTask()));

        await moveWithEdits(hook);

        expect(gets("/project/members/")).toHaveLength(1);
        // Member stays; the project owner (no membership row), the assignee
        // and the reporter stay as holders; the outsider goes.
        const { state, preview } = hook.result.current;
        expect(ids(state.tmpCurrentTaskContent.collaborators)).toEqual([
            "u-bob",
            "u-asg",
            "u-rep",
            "u-own",
        ]);
        expect(ids(preview?.collaborators)).toEqual(["u-bob", "u-asg", "u-rep", "u-own"]);
        expect(ids((cacheFullTask.mock.calls[0][0] as TaskProps).collaborators)).toEqual([
            "u-bob",
            "u-asg",
            "u-rep",
            "u-own",
        ]);

        await edit(hook, (prev) => ({ ...prev, priority: { priority: "High" } as never }), 2);
        expect(putBody(1).collaborators).not.toContain("u-ann");
        expect(putBody(1).status).toBe("WIP");
    });

    it("does not read a list it does not understand as nobody left", async () => {
        // Objects instead of ids: the roster is asked instead, and Bob stays.
        moveAnswer = {
            task: { ts_updated_at: "2026-11-15T00:00:00Z", collaborators: [{ id: "u-bob" }] },
            movedFromProjectId: 1,
        };
        const hook = renderHook(() => useHarness(makeTask()));

        await moveWithEdits(hook);

        expect(gets("/project/members/")).toHaveLength(1);
        expect(ids(hook.result.current.state.tmpCurrentTaskContent.collaborators)).toEqual([
            "u-bob",
            "u-asg",
            "u-rep",
            "u-own",
        ]);
    });

    it("keeps the assignee and the reporter even when they are on no roster", async () => {
        moveAnswer = { task: { ts_updated_at: "2026-11-15T00:00:00Z" }, movedFromProjectId: 1 };
        const hook = renderHook(() => useHarness(makeTask({ collaborators: [ann, asg, rep] })));

        await edit(
            hook,
            (prev) => ({ ...prev, project: DESTINATION, collaborators: [ann, asg, rep] }),
            1
        );

        expect(ids(hook.result.current.state.tmpCurrentTaskContent.collaborators)).toEqual([
            "u-asg",
            "u-rep",
        ]);
    });

    it("leaves the copy alone when the roster cannot be read, and the next save still works", async () => {
        moveAnswer = { task: { ts_updated_at: "2026-11-15T00:00:00Z" }, movedFromProjectId: 1 };
        adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
            if (String(config.url).includes("/project/")) throw refuse(config, {});
            if (config.method !== "put") return reply(config, {});
            return reply(config, moveAnswer);
        });
        const hook = renderHook(() => useHarness(makeTask()));

        await moveWithEdits(hook);

        // Not known is not "nobody": nothing is dropped on a guess.
        expect(ids(hook.result.current.state.tmpCurrentTaskContent.collaborators)).toEqual([
            "u-ann",
            "u-bob",
            "u-asg",
            "u-rep",
            "u-own",
        ]);
        expect(hook.result.current.state.tmpCurrentTaskContent.status.status).toBe("WIP");
    });

    it("does nothing for a save that is not a move", async () => {
        moveAnswer = { task: { ts_updated_at: "2026-11-15T00:00:00Z" }, movedFromProjectId: null };
        adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
            reply(config, moveAnswer)
        );
        const hook = renderHook(() => useHarness(makeTask()));

        await edit(hook, (prev) => ({ ...prev, status: { status: "WIP" } as never }), 1);

        expect(ids(hook.result.current.state.tmpCurrentTaskContent.collaborators)).toEqual([
            "u-ann",
            "u-bob",
            "u-asg",
            "u-rep",
            "u-own",
        ]);
        expect(gets("/project/")).toHaveLength(0);
        expect(getTasksByProject).not.toHaveBeenCalled();
        expect(ids((cacheFullTask.mock.calls[0][0] as TaskProps).collaborators)).toContain(
            "u-ann"
        );
    });

    it("a collaborator added while the move was in flight stays", async () => {
        const dan = user("u-dan");
        let release: () => void = () => {};
        const gate = new Promise<void>((resolve) => (release = resolve));
        adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
            await gate;
            return reply(config, moveAnswer);
        });
        const hook = renderHook(() => useHarness(makeTask()));
        act(() => {
            hook.result.current.state.setTmpCurrentTaskContent((prev) => ({
                ...prev,
                project: DESTINATION,
            }));
            hook.result.current.state.setTaskUpdated(true);
        });
        await waitFor(() => expect(puts()).toHaveLength(1));
        act(() =>
            hook.result.current.state.setTmpCurrentTaskContent((prev) => ({
                ...prev,
                collaborators: [...(prev.collaborators ?? []), dan],
            }))
        );
        release();
        await waitFor(() =>
            expect(ids(hook.result.current.state.tmpCurrentTaskContent.collaborators)).toEqual([
                "u-bob",
                "u-asg",
                "u-rep",
                "u-own",
                "u-dan",
            ])
        );
    });

    it("forgets the cached full task of every sub-task that travelled with it", async () => {
        const row = (id: number, parent: number | null) => ({
            id: String(id),
            parentTaskId: parent == null ? null : String(parent),
        });
        getTasksByProject.mockResolvedValue([
            row(42, null),
            row(43, 42),
            row(44, 43),
            row(50, null),
            row(51, 50),
        ]);
        const hook = renderHook(() => useHarness(makeTask()));

        await moveWithEdits(hook);

        expect(getTasksByProject).toHaveBeenCalledWith(1);
        const forgotten = invalidateCachedFullTask.mock.calls.map(([id]) => id).sort();
        expect(forgotten).toEqual([43, 44]);
    });
});
