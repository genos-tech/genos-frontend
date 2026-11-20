/**
 * MIP-1730: the preview panes must not put the viewer in a missing reporter's place.
 *
 * `tasks.reporter` is SET_NULL, so a hard-deleted account leaves a task or milestone with no
 * reporter: `GET /task/getTask/` sends `"reporter": null`, a milestone payload `reporter: null`
 * and `reporterId: null`. The preview panes used to answer that with `myself` (`reporter ||
 * myself`, and the fallback of `milestoneReporterToUserProps`).
 *
 * What the premise check found, per path:
 *   - Task preview, chip: the chip showed the viewer (`setReporter(working.reporter || myself)`).
 *   - Task preview, save: NOT affected. The chip state is display-only; a PUT is built from the
 *     working copy (`tmpCurrentTaskContent`), whose reporter stays null, so the PUT carries
 *     `reporter: null`, which the server's None-strip drops (MIP-1729). Pinned below.
 *   - Milestone preview, save: AFFECTED. The synthetic working copy took the viewer as its
 *     reporter, so ANY edit (a sprint, a date) diffed `viewer` against the stored null and sent
 *     `reporterId: <viewer>`; the milestone PATCH applies `reporter_id`, so the edit silently
 *     made the viewer the reporter. The card the browser rewrote then named the viewer, where the
 *     server's own render says "Deleted user".
 *
 * A task or milestone that HAS a reporter is pinned unchanged.
 */
import { useState } from "react";
import { act, render, renderHook, waitFor } from "@testing-library/react";
import axios, { type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACTeamUsers } from "../features/tasks/components/autocompletes/ACTeamUsers";
import { usePreviewEditMirror } from "../features/tasks/components/contents/utils/usePreviewEditMirror";
import { Milestone } from "../features/tasks/sprint-milestone/types";
import {
    milestoneReporterPatch,
    milestoneReporterToUserProps,
} from "../features/tasks/utils/milestoneReporter";
import { milestoneToTaskProps } from "../features/tasks/utils/milestoneTaskProps";
import { useSendUpdatedTask } from "../hooks/tasks/useSendUpdatedTask";
import { useTaskEditState } from "../hooks/tasks/useTaskEditState";
import { getMessages } from "../i18n";
import { UserProps } from "../types/admin";
import { TaskProps } from "../types/tasks";

vi.mock("../db/services/task-full.service", () => ({
    getCachedFullTask: vi.fn().mockResolvedValue(undefined),
    cacheFullTask: vi.fn().mockResolvedValue(undefined),
    invalidateCachedFullTask: vi.fn().mockResolvedValue(undefined),
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

const person = (userId: string, userName = userId) =>
    ({
        userId,
        userName,
        userEmail: `${userName}@x.dev`,
        avatarImgPath: "",
        teamId: "t1",
    }) as unknown as UserProps;

const viewer = person("u-viewer", "Viewer");
const bo = person("u-bo", "Bo");

// ---- the task preview -------------------------------------------------------

const adapter = vi.fn();
let originalAdapter: typeof axios.defaults.adapter;
beforeEach(() => {
    originalAdapter = axios.defaults.adapter;
    axios.defaults.adapter = adapter;
    adapter.mockReset();
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => ({
        data: { task: { ts_updated_at: "now" } },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
    }));
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
    axios.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
});

const makeTask = (reporter: UserProps | null): TaskProps =>
    ({
        id: 42,
        displayId: "KDS-42",
        title: "A task",
        body: [],
        project: { projectId: 1, projectName: "Kds", projectCode: "KDS", systemUserId: "sys" },
        assignee: person("u-ann", "Ann"),
        reporter,
        priority: { priority: "Medium" },
        effortLevel: { level: "Medium" },
        status: { status: "Open" },
        dueDate: "",
        links: [],
        tags: [],
        attachments: [],
        parentTaskId: null,
        threadId: null,
    }) as unknown as TaskProps;

// TaskPreview's own wiring: the real edit state, the real save hook and the real mirror,
// with the chip's state captured the way TaskPreview holds it.
const useHarness = (initial: TaskProps) => {
    const [preview, setPreview] = useState<TaskProps | undefined>(initial);
    const [chip, setChip] = useState<UserProps | null | undefined>(undefined);
    const state = useTaskEditState(initial);
    const send = useSendUpdatedTask({
        socket: null,
        myself: viewer,
        accessToken: "tok",
        currentPreviewTask: preview,
        setCurrentPreviewTask: setPreview,
        taskEditState: state,
        bodyRef: { current: [] },
    });
    usePreviewEditMirror({
        working: state.tmpCurrentTaskContent,
        preview,
        setPreview,
        syncRow: () => {},
        setAssignee: () => {},
        setReporter: setChip,
    });
    return { state, send, chip };
};

const putBody = (): Record<string, unknown> => JSON.parse(adapter.mock.calls[0][0].data);

const changeStatusAndSave = async (
    hook: ReturnType<typeof renderHook<ReturnType<typeof useHarness>, unknown>>
) => {
    act(() => {
        hook.result.current.state.setTmpCurrentTaskContent((prev) => ({
            ...prev,
            status: { status: "WIP" } as TaskProps["status"],
        }));
        hook.result.current.state.setTaskUpdated(true);
    });
    await act(async () => {
        await hook.result.current.send(false);
    });
    await waitFor(() => expect(adapter).toHaveBeenCalled());
};

describe("the task preview, for a task whose reporter is gone", () => {
    it("shows no reporter on the chip (not the viewer)", async () => {
        const hook = renderHook(() => useHarness(makeTask(null)));
        await waitFor(() => expect(hook.result.current.chip).not.toBeUndefined());
        expect(hook.result.current.chip).toBeNull();
    });

    it("saves a status change WITHOUT a reporter: the PUT carries null, never the viewer", async () => {
        const hook = renderHook(() => useHarness(makeTask(null)));
        await changeStatusAndSave(hook);
        const body = putBody();
        // Vacuity guard: this really is the save of the edit.
        expect(body.status).toBe("WIP");
        expect(body.reporter).toBeNull();
    });
});

describe("the task preview, for a task that HAS a reporter (unchanged)", () => {
    it("shows that reporter on the chip", async () => {
        const hook = renderHook(() => useHarness(makeTask(bo)));
        await waitFor(() => expect(hook.result.current.chip).not.toBeUndefined());
        expect(hook.result.current.chip?.userId).toBe("u-bo");
    });

    it("saves with that reporter's id", async () => {
        const hook = renderHook(() => useHarness(makeTask(bo)));
        await changeStatusAndSave(hook);
        expect(putBody().status).toBe("WIP");
        expect(putBody().reporter).toBe("u-bo");
    });
});

// ---- the milestone preview ----------------------------------------------------

const milestone = (over: Partial<Milestone> = {}): Milestone =>
    ({
        milestoneId: 7,
        taskId: 99,
        title: "Launch",
        reporterId: null,
        reporter: null,
        ...over,
    }) as unknown as Milestone;

const embedded = (userId: string, username: string) => ({
    userId,
    username,
    email: `${username}@x.dev`,
    profileImageUrl: "",
});

describe("the milestone preview, for a milestone whose reporter is gone", () => {
    const orphan = milestone();

    it("resolves to no reporter, not the viewer", () => {
        expect(milestoneReporterToUserProps(orphan, [viewer, bo])).toBeNull();
        expect(milestoneReporterToUserProps(null, [viewer, bo])).toBeNull();
        expect(milestoneReporterToUserProps(undefined, [viewer, bo])).toBeNull();
    });

    it("sends no reporter when an edit leaves the reporter alone", () => {
        // The synthetic working copy the preview builds from the milestone.
        const working = { reporter: milestoneReporterToUserProps(orphan, [viewer, bo]) };
        expect(milestoneReporterPatch(working, orphan)).toBeUndefined();
    });

    it("still sends the reporter the person picks", () => {
        expect(milestoneReporterPatch({ reporter: bo }, orphan)).toBe("u-bo");
    });
});

describe("the milestone preview, for a milestone that HAS a reporter (unchanged)", () => {
    const filed = milestone({
        reporterId: "u-bo",
        reporter: embedded("u-bo", "Bo") as never,
    });

    it("resolves to the team member when listed, else to the embedded person", () => {
        expect(milestoneReporterToUserProps(filed, [viewer, bo])).toBe(bo);
        expect(milestoneReporterToUserProps(filed, [viewer])).toMatchObject({
            userId: "u-bo",
            userName: "Bo",
            userEmail: "Bo@x.dev",
        });
    });

    it("sends no reporter when an edit leaves it alone", () => {
        const working = { reporter: milestoneReporterToUserProps(filed, [viewer, bo]) };
        expect(milestoneReporterPatch(working, filed)).toBeUndefined();
    });

    it("sends the new reporter when the person picks another", () => {
        expect(milestoneReporterPatch({ reporter: viewer }, filed)).toBe("u-viewer");
    });

    it("reads the stored reporter from reporterId alone, too", () => {
        const idOnly = milestone({ reporterId: "u-bo", reporter: null });
        expect(milestoneReporterPatch({ reporter: bo }, idOnly)).toBeUndefined();
    });
});

describe("the milestone preview's working copy, end to end", () => {
    // The chain the preview runs on every refresh and edit: payload -> resolved reporter ->
    // task-shaped working copy -> the diff that becomes the PATCH.
    const workingCopyOf = (m: Milestone) =>
        milestoneToTaskProps(
            m,
            null,
            [],
            person("u-ann", "Ann"),
            milestoneReporterToUserProps(m, [viewer, bo]),
            []
        );

    it("keeps a missing reporter missing, and an edit of anything else sends none", () => {
        const orphan = milestone();
        const working = workingCopyOf(orphan);
        expect(working.reporter).toBeNull();
        expect(milestoneReporterPatch(working, orphan)).toBeUndefined();
    });

    it("keeps the reporter a milestone has, and an edit of anything else sends none", () => {
        const filed = milestone({ reporterId: "u-bo", reporter: embedded("u-bo", "Bo") as never });
        const working = workingCopyOf(filed);
        expect(working.reporter?.userId).toBe("u-bo");
        expect(milestoneReporterPatch(working, filed)).toBeUndefined();
    });
});

describe("the reporter picker for a reporter whose account is gone", () => {
    const props = (initialUser: UserProps | null, isAssignee = false) => ({
        myself: viewer,
        setMyself: () => {},
        initialUser,
        taskContent: makeTask(initialUser),
        setTaskContent: () => {},
        setUser: () => {},
        isOpenTeamMembersList: false,
        setIsOpenTeamMembersList: () => {},
        isAssignee,
        useTEM: { teamMembers: [viewer, bo], teamMemberProfiles: {} } as never,
        socket: null,
        useCM: {} as never,
        useUISM: {} as never,
    });

    it("says Deleted user where a reporter would be, and no one is chosen", () => {
        const view = render(<ACTeamUsers {...props(null)} />);
        const input = view.container.querySelector("input")!;
        expect(input.placeholder).toBe(getMessages().tasks.messageTemplate.deletedUser);
        expect(input.value).toBe("");
    });

    it("shows a reporter that exists as the chosen person, with no placeholder", () => {
        const view = render(<ACTeamUsers {...props(bo)} />);
        const input = view.container.querySelector("input")!;
        expect(input.value).toContain("Bo");
        expect(input.placeholder).toBe("");
    });

    it("keeps the assignee's own placeholder for an unassigned task", () => {
        const view = render(<ACTeamUsers {...props(null, true)} />);
        expect(view.container.querySelector("input")!.placeholder).toBe(
            getMessages().tasks.messageTemplate.unassigned
        );
    });
});
