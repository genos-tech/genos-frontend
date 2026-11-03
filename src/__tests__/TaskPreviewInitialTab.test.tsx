/**
 * MIP-988: after a task switch the preview must pick its starting tab again
 * (comments if the task has any, else notes), once both loads have answered.
 *
 * The REAL `TaskPreview` is mounted (leaves stubbed, network answered by the
 * test). `useInitialTabIndex` is keyed on a working copy that lags the task
 * being shown, while the comment and note loaders are keyed on the task being
 * shown; a load that answers for the new task must still count.
 */
import { act, useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskPreview } from "../features/tasks/components/contents/TaskPreview";
import type { TaskProps } from "../types/tasks";

// ---------------------------------------------------------------- network --

type Pending = { url: string; resolve: (data: unknown) => void; reject: (e: unknown) => void };
const network = vi.hoisted(() => ({
    all: [] as { url: string }[],
    pending: [] as Pending[],
}));

vi.mock("../services/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../services/api")>()),
    authApi: () => ({
        get: (url: string) =>
            new Promise((resolve, reject) => {
                network.all.push({ url });
                network.pending.push({
                    url,
                    resolve: (data) => resolve({ data }),
                    reject,
                });
            }),
    }),
}));

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));

// Reads of the IndexedDB task cache: always a miss, so the parent task goes to
// the network and shows up in the request list.
vi.mock("../db/services/task-full.service", () => ({
    getCachedFullTask: vi.fn(async () => undefined),
    cacheFullTask: vi.fn(async () => undefined),
}));

// GitHub lookups belong to MIP-967: they resolve at once and change nothing.
vi.mock("../features/integrations/services/github", () => ({
    tryLoadLinkedBranches: vi.fn(async () => null),
    tryLoadLinkedPulls: vi.fn(async () => null),
}));
vi.mock("../features/integrations/services/prStatusCache", () => ({
    getCachedOrFetchPrStatus: vi.fn(async () => null),
}));

// -------------------------------------------------------- stubbed leaves --

// What the tab body was handed, one entry per render (a recorder, so a test
// can also assert what was NEVER shown).
const stubs = vi.hoisted(() => ({ seen: [] as string[] }));

vi.mock("../features/tasks/components/contents/base/TaskTitleBlock", () => ({
    TaskTitleBlock: () => null,
}));
vi.mock("../features/tasks/components/contents/base/TaskBodyBlock", () => ({
    TaskBodyBlock: () => null,
}));
vi.mock("../features/tasks/components/contents/base/TaskCustomBarBlock", () => ({
    TaskCustomBarBlock: () => null,
}));
vi.mock("../features/tasks/components/contents/base/TaskTabBlock", () => ({
    // Shows what reached the tab body, so a test can see what landed.
    TaskTabBlock: (p: Record<string, unknown>) => {
        stubs.seen.push(
            `c${(p.taskComments as unknown[]).length}a${(p.taskActivities as unknown[]).length}n${(p.taskNotes as unknown[]).length}`
        );
        return (
            <div
                data-activities={(p.taskActivities as unknown[]).length}
                data-comments={(p.taskComments as unknown[]).length}
                data-notes={(p.taskNotes as unknown[]).length}
                data-tab={String(p.tabIndex)}
                data-testid="tabs"
            />
        );
    },
}));
vi.mock("../features/tasks/diagram/components/LazyTaskDiagram", () => ({
    LazyTaskDiagram: () => null,
}));
vi.mock("../features/integrations/components/LinkedPrCard", () => ({
    LinkedPrCard: () => null,
}));
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({ AvatarWithStatus: () => null }));
vi.mock("../features/tasks/sprint-milestone/components/MilestoneFolderPicker", () => ({
    MilestoneFolderPicker: () => null,
}));
vi.mock("../features/tasks/sprint-milestone/components/SprintMilestonePicker", () => ({
    SprintMilestonePicker: () => null,
}));
vi.mock("../features/tasks/components/autocompletes/ACProjectTags", () => ({
    ACProjectTags: () => null,
}));
vi.mock("../features/tasks/components/autocompletes/ACTaskEffortLevel", () => ({
    ACTaskEffortLevel: () => null,
}));
vi.mock("../features/tasks/components/autocompletes/ACTaskPriority", () => ({
    ACTaskPriority: () => null,
}));
vi.mock("../features/tasks/components/autocompletes/ACTaskSelector", () => ({
    StatusChip: () => null,
}));
vi.mock("../features/tasks/components/autocompletes/ACTaskStatus", () => ({
    ACTaskStatus: () => null,
}));
vi.mock("../features/tasks/components/autocompletes/ACTeamProjects", () => ({
    ACTeamProjects: () => null,
}));
vi.mock("../features/tasks/components/autocompletes/ACTeamUsers", () => ({
    ACTeamUsers: () => null,
}));
vi.mock("../features/tasks/components/autocompletes/MultiMemberPicker", () => ({
    MultiMemberPicker: () => null,
}));
vi.mock("../features/tasks/components/modals/ModalManageTags", () => ({
    ModalManageTags: () => null,
}));
vi.mock("../features/tasks/components/contents/base/CustomFieldsBlock", () => ({
    CustomFieldsBlock: () => null,
}));
vi.mock("../features/tasks/components/contents/base/sub/DynamicURLManager", () => ({
    DynamicURLManager: () => null,
}));
vi.mock("../features/tasks/components/contents/base/sub/TaskDueDateInput", () => ({
    TaskDueDateInput: () => null,
}));
vi.mock("../features/tasks/components/contents/base/sub/TaskStartDateInput", () => ({
    TaskStartDateInput: () => null,
}));
vi.mock("../features/tasks/components/contents/base/TaskDeliveriesBlock", () => ({
    // The deliveries the block was handed, so a test can see what landed.
    TaskDeliveriesBlock: (p: { deliveries?: unknown[] }) => (
        <div data-count={p.deliveries?.length ?? 0} data-testid="deliveries" />
    ),
}));
vi.mock("../features/tasks/components/contents/base/TaskDependenciesBlock", () => ({
    isCurrentlyBlocked: () => false,
    TaskDependenciesBlock: () => null,
}));

// ------------------------------------------------------------------ data --

const PROJECT = { projectId: 7, projectName: "Proj" };
const ME = { userId: "u1", teamId: "t1", userName: "Me", userEmail: "me@x.io" };

// Every test uses its own family of ids: the request caches live at module
// level and would answer a second test's first open without a request.
// Within a family: the first task is a subtask, the second a subtask of
// another parent, the third has no parent.
const family = (n: number) => [n * 10 + 1, n * 10 + 2, n * 10 + 3] as const;
const role = (id: number) => id % 10;
const parentOf = (id: number): number | null =>
    role(id) === 1 ? id + 4 : role(id) === 2 ? id + 4 : null;

const makeTask = (id: number, over: Partial<TaskProps> = {}): TaskProps =>
    ({
        id,
        displayId: `PRJ-${id}`,
        title: `Task ${id}`,
        body: [],
        attachments: [],
        links: [],
        tags: [],
        collaborators: [],
        project: PROJECT,
        status: { code: 0, status: "Open", color: "#0044c2", textColor: "white" },
        assignee: ME,
        reporter: ME,
        parentTaskId: parentOf(id),
        rootTaskId: id,
        isMilestone: false,
        updatedAt: "2026-11-01 10:00:00",
        ...over,
    }) as unknown as TaskProps;

type Key =
    | "comments"
    | "activity"
    | "notes"
    | "dependencies"
    | "children"
    | "deliveries"
    | "parent";

const ROUTE: Record<Key, RegExp> = {
    comments: /^\/task\/comment\//,
    activity: /^\/task\/activity\//,
    notes: /^\/note\/task\//,
    dependencies: /^\/task\/dependency\/list\//,
    children: /^\/task\/childTasks\//,
    deliveries: /^\/task\/deliveries\//,
    parent: /^\/task\/getTask\//,
};

// What each endpoint answers, per task, so a test can tell WHOSE data landed:
// every role gets different sizes (and titles).
const SIZE: Record<number, Record<Exclude<Key, "children" | "parent">, number>> = {
    1: { comments: 3, activity: 2, notes: 1, dependencies: 1, deliveries: 1 },
    2: { comments: 0, activity: 4, notes: 2, dependencies: 2, deliveries: 3 },
    3: { comments: 2, activity: 1, notes: 3, dependencies: 3, deliveries: 2 },
};
const rows = (n: number, make: (i: number) => unknown) =>
    Array.from({ length: n }, (_, i) => make(i));

/** `taskId` is the id in the request: the task itself, or the parent's id for `parent`. */
const payload = (key: Key, taskId: number): unknown => {
    switch (key) {
        case "children":
            return rows(role(taskId), (i) =>
                makeTask(taskId * 100 + i, { title: `child ${taskId}.${i}` })
            );
        case "parent":
            return [makeTask(taskId, { title: `parent ${taskId}`, parentTaskId: null })];
        case "dependencies":
            return { blocking: rows(SIZE[role(taskId)][key], (i) => ({ id: i })), blockedBy: [] };
        default:
            return rows(SIZE[role(taskId)][key], (i) => ({ id: i, commentId: i, taskId }));
    }
};

const taskIdOfUrl = (url: string): number => {
    const q = new URLSearchParams(url.split("?")[1] ?? "");
    return Number(q.get("current_task_id") ?? q.get("task_id"));
};

/** The request that `key` made for task `forTask` (the parent request names the parent's id). */
const pendingFor = (key: Key, forTask: number) =>
    network.pending.find(
        (p) =>
            ROUTE[key].test(p.url) &&
            taskIdOfUrl(p.url) === (key === "parent" ? parentOf(forTask) : forTask)
    );

// ------------------------------------------------------------------ host --

// Everything on the task manager that the preview reads and the test does
// not care about is a no-op; the pieces it writes to are real state.
const stubBag = <T extends object>(base: T): T =>
    new Proxy(base, {
        get: (target, prop) => {
            if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
            if (typeof prop === "symbol") return undefined;
            return () => undefined;
        },
    });

const host: {
    open: (task: TaskProps) => void;
} = { open: () => undefined };

const Host = ({ initialTask }: { initialTask?: TaskProps }) => {
    const [currentPreviewTask, setCurrentPreviewTask] = useState<TaskProps | undefined>(
        initialTask
    );
    const [currentPreviewTaskId, setCurrentPreviewTaskId] = useState<number>(
        initialTask ? Number(initialTask.id) : -1
    );
    const [taskComments, setTaskComments] = useState<unknown[]>([]);
    const [taskCommentLines, setTaskCommentLines] = useState(1);
    host.open = (task) => {
        setCurrentPreviewTaskId(Number(task.id));
        setCurrentPreviewTask(task);
    };

    const useTM = stubBag({
        currentPreviewTask,
        currentPreviewTaskId,
        setCurrentPreviewTask,
        setCurrentPreviewTaskId,
        currentPreviewKind: "task",
        currentPreviewMilestoneId: -1,
        previewLoadFailedTaskId: null,
        allTasks: [],
        taskComments,
        setTaskComments,
        taskCommentLines,
        setTaskCommentLines,
        taskDependencies: {},
        loadTaskDependenciesFor: () => undefined,
    });
    return (
        <>
            <TaskPreview
                myself={ME as never}
                setMyself={vi.fn()}
                socket={null}
                useCM={stubBag({}) as never}
                useNM={stubBag({ taskNoteMeta: undefined }) as never}
                usePM={stubBag({}) as never}
                useTEM={stubBag({ teamMemberProfiles: {}, teamMembers: [] }) as never}
                useTM={useTM as never}
                useUISM={stubBag({}) as never}
                holdSwitchWithLoader
            />
        </>
    );
};

/** `initialTask`: the preview mounts with its task already open (a modal, the note page). */
const mount = (initialTask?: TaskProps) =>
    render(
        <CssVarsProvider>
            <Host initialTask={initialTask} />
        </CssVarsProvider>
    );

const settle = () =>
    act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });

/** Open `task` the way a landed `loadTask` does, and let every effect run. */
const open = async (task: TaskProps) => {
    await act(async () => {
        host.open(task);
    });
    await settle();
};

/** Answer one request in its own `act`: one network response = one task. */
const answer = async (key: Key, forTask: number) => {
    const p = pendingFor(key, forTask);
    if (!p) {
        throw new Error(
            `no pending ${key} for ${forTask}; have ${network.pending.map((x) => x.url)}`
        );
    }
    network.pending.splice(network.pending.indexOf(p), 1);
    await act(async () => {
        p.resolve(payload(key, taskIdOfUrl(p.url)));
    });
    await settle();
};

const tabOf = () => Number(screen.getByTestId("tabs").getAttribute("data-tab"));

describe("starting tab after a task switch", () => {
    beforeEach(() => {
        network.all.length = 0;
        network.pending.length = 0;
    });

    it("opens on Comments for a task with comments, then on Notes for a task with only notes", async () => {
        const [a, b] = family(1);
        mount();
        await open(makeTask(a));
        await answer("comments", a);
        await answer("notes", a);
        expect(tabOf()).toBe(0);

        // B has no comments and 2 notes: the tab must move to Notes (1).
        await open(makeTask(b));
        await answer("comments", b);
        await answer("notes", b);
        expect(tabOf()).toBe(1);
    });

    it("also when the notes answer first", async () => {
        const [a, b] = family(2);
        mount();
        await open(makeTask(a));
        await answer("notes", a);
        await answer("comments", a);
        expect(tabOf()).toBe(0);

        await open(makeTask(b));
        await answer("notes", b);
        await answer("comments", b);
        expect(tabOf()).toBe(1);
    });

    it("and back again: a task with comments after one with only notes", async () => {
        const [a, b, c] = family(3);
        mount();
        await open(makeTask(a));
        await answer("comments", a);
        await answer("notes", a);
        await open(makeTask(b));
        await answer("comments", b);
        await answer("notes", b);
        expect(tabOf()).toBe(1);

        await open(makeTask(c)); // role 3: 2 comments
        await answer("comments", c);
        await answer("notes", c);
        expect(tabOf()).toBe(0);
    });
});
