/**
 * MIP-968 step 3: when a task opens, its side loaders (comments, activity,
 * notes, dependencies, children, deliveries, and the parent task of a
 * subtask) land together instead of one commit each.
 *
 * The REAL `TaskPreview`, `TaskMainBlock` and `TaskSubTasksBlock` are mounted
 * (they own the loaders and their state). Only what is not under test is
 * stubbed: the editor, the tab body, the pickers, GitHub. The network is the
 * `authApi` mock below: every request is recorded by URL and answered by the
 * test, one answer per `act`, the way separate responses arrive in a browser
 * (one task each, so React cannot batch them).
 */
import { act, Profiler, ProfilerOnRenderCallback, useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskPreview } from "../features/tasks/components/contents/TaskPreview";
import { loadTaskDependenciesInto } from "../features/tasks/services/loadTaskDependencies";
import { emitTaskTouched } from "../features/tasks/services/taskEvents";
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

const KEYS = [
    "comments",
    "activity",
    "notes",
    "dependencies",
    "children",
    "deliveries",
    "parent",
] as const;
type Key = (typeof KEYS)[number];

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
    2: { comments: 1, activity: 4, notes: 2, dependencies: 2, deliveries: 3 },
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
const keyOf = (url: string): Key | undefined => KEYS.find((k) => ROUTE[k].test(url));

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
    deps: Record<number, { blocking: unknown[] }>;
    commits: number;
} = { open: () => undefined, deps: {}, commits: 0 };

const onRender: ProfilerOnRenderCallback = () => {
    host.commits += 1;
};

const Host = ({ initialTask }: { initialTask?: TaskProps }) => {
    const [currentPreviewTask, setCurrentPreviewTask] = useState<TaskProps | undefined>(
        initialTask
    );
    const [currentPreviewTaskId, setCurrentPreviewTaskId] = useState<number>(
        initialTask ? Number(initialTask.id) : -1
    );
    const [taskComments, setTaskComments] = useState<unknown[]>([]);
    const [taskCommentLines, setTaskCommentLines] = useState(1);
    const [taskDependencies, setTaskDependencies] = useState<
        Record<number, { blocking: unknown[] }>
    >({});
    host.deps = taskDependencies;
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
        taskDependencies,
        // The task manager's own function, over this host's state.
        loadTaskDependenciesFor: (taskId: number, land?: (write: () => void) => void) =>
            loadTaskDependenciesInto(
                taskId,
                "test-token",
                (result) =>
                    setTaskDependencies((prev) => ({
                        ...prev,
                        [taskId]: result as { blocking: unknown[] },
                    })),
                land
            ),
    });
    return (
        <Profiler id="preview" onRender={onRender}>
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
        </Profiler>
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

const fail = async (key: Key, forTask: number) => {
    const p = pendingFor(key, forTask)!;
    network.pending.splice(network.pending.indexOf(p), 1);
    await act(async () => {
        p.reject(new Error("boom"));
    });
    await settle();
};

const commitsDuring = async (fn: () => Promise<void>): Promise<number> => {
    const before = host.commits;
    await fn();
    return host.commits - before;
};

/** What is on screen from the seven loaders. */
const view = () => {
    const tabs = screen.queryByTestId("tabs");
    return {
        comments: Number(tabs?.getAttribute("data-comments") ?? -1),
        activity: Number(tabs?.getAttribute("data-activities") ?? -1),
        notes: Number(tabs?.getAttribute("data-notes") ?? -1),
        deliveries: Number(screen.queryByTestId("deliveries")?.getAttribute("data-count") ?? 0),
        children: screen.queryAllByText(/^child \d+\.\d+$/).length,
        parent: screen.queryByText(/^parent \d+$/)?.textContent ?? null,
    };
};
const viewOf = (taskId: number) => ({
    comments: SIZE[role(taskId)].comments,
    activity: SIZE[role(taskId)].activity,
    notes: SIZE[role(taskId)].notes,
    deliveries: SIZE[role(taskId)].deliveries,
    children: role(taskId),
    parent: parentOf(taskId) == null ? null : `parent ${parentOf(taskId)}`,
});
const EMPTY = { comments: 0, activity: 0, notes: 0, deliveries: 0, children: 0, parent: null };

// Different answer times; the last one is never the same loader twice in a row.
const ORDER_A: Key[] = [
    "parent",
    "deliveries",
    "children",
    "dependencies",
    "notes",
    "comments",
    "activity",
];
const ORDER_B: Key[] = [...ORDER_A].reverse();
const keysFor = (taskId: number): Key[] =>
    parentOf(taskId) == null ? KEYS.filter((k) => k !== "parent") : [...KEYS];
const orderFor = (taskId: number, order = ORDER_A) =>
    order.filter((k) => keysFor(taskId).includes(k));

beforeEach(() => {
    network.all.length = 0;
    network.pending.length = 0;
    host.commits = 0;
    host.deps = {};
    stubs.seen.length = 0;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

// The wait the plan names; the test fakes timers around it.
const WAIT_MS = 800;

const answerAll = async (taskId: number, order = orderFor(taskId)) => {
    for (const key of order) await answer(key, taskId);
};

describe("task open: the same requests", () => {
    // Captured on unmodified main before the change. The task-level `getTask`
    // is not here: it belongs to `useProjectTaskManagement`, above the preview.
    it("pins the requests of a first open and of a switch (the set does not change)", async () => {
        const [A, B] = family(1); // 11, 12: subtasks of 15, 16
        mount();
        // Mounted once, before any task is open (the project list for the pickers).
        expect(network.all.map((r) => r.url)).toEqual([
            "/project/projects/?team_id=t1&attendee_id=u1",
        ]);
        network.all.length = 0;
        await open(makeTask(A));
        expect(network.all.map((r) => r.url).sort()).toEqual([
            "/note/task/?team_id=t1&project_id=7&task_id=11",
            "/task/activity/?team_id=t1&task_id=11",
            "/task/childTasks/?team_id=t1&project_id=7&current_task_id=11",
            "/task/comment/?user_id=u1&task_id=11",
            "/task/deliveries/?team_id=t1&task_id=11",
            "/task/dependency/list/?task_id=11",
            "/task/getTask/?team_id=t1&project_id=7&task_id=15&attachments=meta",
        ]);
        await answerAll(A);
        network.all.length = 0;
        await open(makeTask(B));
        expect(network.all.map((r) => r.url).sort()).toEqual([
            "/note/task/?team_id=t1&project_id=7&task_id=12",
            "/task/activity/?team_id=t1&task_id=12",
            "/task/childTasks/?team_id=t1&project_id=7&current_task_id=12",
            "/task/comment/?user_id=u1&task_id=12",
            "/task/deliveries/?team_id=t1&task_id=12",
            "/task/dependency/list/?task_id=12",
            "/task/getTask/?team_id=t1&project_id=7&task_id=16&attachments=meta",
        ]);
    });
});

describe("task open: the side loaders land together", () => {
    it("a subtask: seven answers at seven different times land in at most 2 commits", async () => {
        const [A] = family(2);
        mount();
        await open(makeTask(A));
        expect(view()).toEqual(EMPTY);
        const commits = await commitsDuring(() => answerAll(A));
        expect(view()).toEqual(viewOf(A));
        expect(host.deps[A].blocking).toHaveLength(SIZE[role(A)].dependencies);
        expect(commits).toBeLessThanOrEqual(2);
    });

    it("a task without a parent: six answers land in at most 2 commits", async () => {
        const [, , C] = family(3);
        mount();
        await open(makeTask(C));
        const commits = await commitsDuring(() => answerAll(C));
        expect(view()).toEqual(viewOf(C));
        expect(commits).toBeLessThanOrEqual(2);
    });

    it("the answer order does not matter", async () => {
        const [A] = family(4);
        mount();
        await open(makeTask(A));
        const commits = await commitsDuring(() => answerAll(A, orderFor(A, ORDER_B)));
        expect(view()).toEqual(viewOf(A));
        expect(commits).toBeLessThanOrEqual(2);
    });

    it("nothing from a loader is shown while another one is still outstanding", async () => {
        const [A] = family(5);
        mount();
        await open(makeTask(A));
        const order = orderFor(A);
        for (const key of order.slice(0, -1)) await answer(key, A);
        expect(view()).toEqual(EMPTY);
        await answer(order[order.length - 1], A);
        expect(view()).toEqual(viewOf(A));
    });

    it("a preview that mounts with its task already open lands together too (modal, note page)", async () => {
        const [A] = family(14);
        mount(makeTask(A));
        await settle();
        expect(view()).toEqual(EMPTY);
        const commits = await commitsDuring(() => answerAll(A));
        expect(view()).toEqual(viewOf(A));
        expect(commits).toBeLessThanOrEqual(2);
    });

    it("a switch to another task lands together too (A -> B)", async () => {
        const [A, B] = family(6);
        mount();
        await open(makeTask(A));
        await answerAll(A);
        await open(makeTask(B));
        const commits = await commitsDuring(() => answerAll(B));
        expect(view()).toEqual(viewOf(B));
        expect(commits).toBeLessThanOrEqual(2);
    });

    it("a warm switch (A -> B -> A inside the cache lifetimes) is no worse than a cold one", async () => {
        const [A, B] = family(7);
        mount();
        await open(makeTask(A));
        await answerAll(A);
        const switchOpen = await commitsDuring(() => open(makeTask(B)));
        await answerAll(B);
        // Back to A: comments, activity, deliveries and children come from the
        // request caches in a microtask; notes, dependencies and the parent
        // are asked again and answer later, at different times.
        network.all.length = 0;
        const total = await commitsDuring(async () => {
            await open(makeTask(A));
            for (const key of ["parent", "dependencies", "notes"] as Key[]) await answer(key, A);
        });
        expect(network.all.map((r) => keyOf(r.url)).sort()).toEqual([
            "dependencies",
            "notes",
            "parent",
        ]);
        expect(view()).toEqual(viewOf(A));
        // The open's own commits plus at most 2 for everything that landed.
        expect(total).toBeLessThanOrEqual(switchOpen + 2);
    });
});

describe("task open: one slow endpoint does not hold the others for ever", () => {
    it("after 800 ms the answered ones land together, the slow one lands on its own later", async () => {
        const [A] = family(8);
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        mount();
        await open(makeTask(A));
        const slow: Key = "deliveries";
        for (const key of orderFor(A).filter((k) => k !== slow)) await answer(key, A);
        expect(view()).toEqual(EMPTY);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(WAIT_MS - 1);
        });
        expect(view()).toEqual(EMPTY);

        const atTimeout = await commitsDuring(async () => {
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1);
            });
        });
        expect(view()).toEqual({ ...viewOf(A), deliveries: 0 });
        expect(atTimeout).toBeLessThanOrEqual(2);

        const late = await commitsDuring(() => answer(slow, A));
        expect(view()).toEqual(viewOf(A));
        expect(late).toBe(1);
    });

    it("an answer that comes after everything landed is shown at once (not held for a next batch)", async () => {
        const [A] = family(9);
        mount();
        await open(makeTask(A));
        await answerAll(A);
        // A comment is posted: the comment list is asked again.
        await act(async () => {
            emitTaskTouched(A, "comment");
        });
        await settle();
        const commits = await commitsDuring(() => answer("comments", A));
        expect(view().comments).toBe(SIZE[role(A)].comments);
        expect(commits).toBe(1);
    });
});

describe("task open: leaving", () => {
    it("closing the preview while a batch waits leaves no timer behind", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        // What the preview leaves behind on its own when it closes after a
        // batch has landed (a few short timers that are not this change's).
        const [done] = family(15);
        const first = mount();
        await open(makeTask(done));
        await answerAll(done);
        first.unmount();
        const leftover = vi.getTimerCount();
        vi.clearAllTimers();

        // Closing while the batch is still waiting must leave no more than that.
        const [held] = family(16);
        const second = mount();
        await open(makeTask(held));
        await answer("comments", held);
        second.unmount();
        expect(vi.getTimerCount()).toBe(leftover);
    });
});

describe("task open: switching or failing mid-load", () => {
    it("a switch before the batch landed never shows the old task's late results on the new one", async () => {
        const [A, B] = family(10);
        mount();
        await open(makeTask(A));
        // Two of A's answers are in, the rest still on their way.
        await answer("comments", A);
        await answer("deliveries", A);
        await open(makeTask(B));
        const afterSwitch = view();
        // A's late answers arrive after the switch: none of them shows.
        for (const key of ["notes", "children", "dependencies", "activity", "parent"] as Key[]) {
            await answer(key, A);
        }
        expect(view()).toEqual(afterSwitch);
        expect(host.deps[B]).toBeUndefined();
        await answerAll(B);
        expect(view()).toEqual(viewOf(B));
        expect(host.deps[B].blocking).toHaveLength(SIZE[role(B)].dependencies);
    });

    it("the results an open had queued are thrown away when another task opens", async () => {
        const [A, B] = family(13);
        mount();
        await open(makeTask(A));
        // A's dependencies are in and waiting for the rest of A's batch.
        await answer("dependencies", A);
        expect(host.deps[A]).toBeUndefined();
        await open(makeTask(B));
        await answerAll(B);
        expect(view()).toEqual(viewOf(B));
        // Still not written: that batch was never going to be shown.
        expect(host.deps[A]).toBeUndefined();
        expect(host.deps[B].blocking).toHaveLength(SIZE[role(B)].dependencies);
    });

    it("a refresh that lands while the batch waits is not overwritten by the older answer", async () => {
        const [A] = family(11);
        mount();
        await open(makeTask(A));
        await answer("comments", A); // 3 comments, held
        // A new comment is posted: the list is asked again and answers with 4.
        await act(async () => {
            emitTaskTouched(A, "comment");
        });
        await settle();
        const fresh = pendingFor("comments", A)!;
        network.pending.splice(network.pending.indexOf(fresh), 1);
        await act(async () => {
            fresh.resolve(rows(4, (i) => ({ commentId: i })));
        });
        await settle();
        expect(view().comments).toBe(4);
        for (const key of orderFor(A).filter((k) => k !== "comments")) {
            if (pendingFor(key, A)) await answer(key, A);
        }
        // The flush must not put the old 3-comment answer back.
        expect(view().comments).toBe(4);
    });

    // The services catch a failed request and answer with nothing, and the
    // block shows that as it did before: an empty list, no parent row, no
    // dependency entry. What matters here is that the others still land, together.
    it.each(KEYS.map((key, i) => [key, 20 + i] as const))(
        "%s failing does not keep the others back, and shows what it showed before",
        async (failing, familyNumber) => {
            const [A] = family(familyNumber);
            mount();
            await open(makeTask(A));
            const commits = await commitsDuring(async () => {
                for (const key of orderFor(A).filter((k) => k !== failing)) await answer(key, A);
                await fail(failing, A);
            });
            const empty: Partial<ReturnType<typeof view>> =
                failing === "parent"
                    ? { parent: null }
                    : failing === "dependencies"
                      ? {}
                      : { [failing]: 0 };
            expect(view()).toEqual({ ...viewOf(A), ...empty });
            expect(host.deps[A] === undefined).toBe(failing === "dependencies");
            expect(commits).toBeLessThanOrEqual(2);
        }
    );
});
