/**
 * MIP-1415: a milestone's dependency edges never showed in its preview.
 *
 * A milestone's edges are stored on its BACKING task, and the dependency block
 * and the Manage dependencies modal read `useTM.taskDependencies[backing id]`.
 * The task preview's own loader keys on `useTM.currentPreviewTask`, which
 * opening a milestone clears, so nothing filled that entry. The milestone
 * preview now loads it itself.
 *
 * The REAL `TaskPreview` (milestone mode) is mounted, with the leaves stubbed
 * the way `TaskOpenSideLoaders.test.tsx` does; the network is recorded by URL.
 */
import { act, useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskPreview } from "../features/tasks/components/contents/TaskPreview";
import { loadTaskDependenciesInto } from "../features/tasks/services/loadTaskDependencies";

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
                network.pending.push({ url, resolve: (data) => resolve({ data }), reject });
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

vi.mock("../features/tasks/services/loadSpecificTask", () => ({
    // The backing task's own copy: not under test, never answers.
    loadSpecificTask: vi.fn(() => new Promise(() => undefined)),
}));

// ------------------------------------------------------------------ data --

const PROJECT = { projectId: 7, projectName: "Proj" };
const ME = { userId: "u1", teamId: "t1", userName: "Me", userEmail: "me@x.io" };

// Ids unique to this file: the dependency request cache lives at module level.
const makeMilestone = (
    milestoneId: number,
    taskId: number,
    tsUpdatedAt = "2026-11-01 10:00:00"
) => ({
    milestoneId,
    taskId,
    displayId: `PRJ-${taskId}`,
    projectId: PROJECT.projectId,
    teamId: "t1",
    sprintId: null,
    folderId: null,
    reporterId: null,
    reporter: null,
    title: `Milestone ${milestoneId}`,
    description: [],
    status: "Blocked",
    statusCode: null,
    priority: null,
    priorityCode: null,
    startDate: null,
    dueDate: null,
    tags: [],
    links: [],
    customFieldValues: {},
    collaborators: [],
    assignees: [],
    isDeleted: false,
    tsCreatedAt: tsUpdatedAt,
    tsUpdatedAt,
    tasksTotal: 0,
    tasksClosed: 0,
});

const depUrls = () =>
    network.all.map((r) => r.url).filter((u) => /^\/task\/dependency\/list\//.test(u));
const taskIdOf = (url: string) =>
    Number(new URLSearchParams(url.split("?")[1] ?? "").get("task_id"));

// ------------------------------------------------------------------ host --

const stubBag = <T extends object>(base: T): T =>
    new Proxy(base, {
        get: (target, prop) => {
            if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
            if (typeof prop === "symbol") return undefined;
            return () => undefined;
        },
    });

const host: {
    openMilestone: (milestoneId: number) => void;
    deps: Record<number, unknown>;
    loads: number[];
    refreshes: number;
} = { openMilestone: () => undefined, deps: {}, loads: [], refreshes: 0 };

const Host = ({ milestones }: { milestones: ReturnType<typeof makeMilestone>[] }) => {
    const [previewMilestoneId, setPreviewMilestoneId] = useState<number>(
        milestones[0].milestoneId
    );
    const [projectMilestones, setProjectMilestones] = useState({
        [PROJECT.projectId]: milestones,
    });
    const [taskDependencies, setTaskDependencies] = useState<Record<number, unknown>>({});
    host.deps = taskDependencies;
    host.openMilestone = setPreviewMilestoneId;

    const useTM = stubBag({
        currentPreviewTask: undefined,
        currentPreviewTaskId: -1,
        currentPreviewKind: "milestone",
        currentPreviewMilestoneId: previewMilestoneId,
        previewLoadFailedTaskId: null,
        allTasks: [],
        taskComments: [],
        taskCommentLines: 1,
        taskDependencies,
        loadTaskDependenciesFor: (taskId: number, land?: (write: () => void) => void) => {
            host.loads.push(taskId);
            return loadTaskDependenciesInto(
                taskId,
                "test-token",
                (result) => setTaskDependencies((prev) => ({ ...prev, [taskId]: result })),
                land
            );
        },
    });
    const useSM = stubBag({
        projectMilestones,
        convertedMilestones: {},
        projectSprints: {},
        // A re-pull hands back a NEW milestone object for the same backing task,
        // the way the real `refreshMilestone` upserts the server's copy.
        refreshMilestone: (milestoneId: number) => {
            host.refreshes += 1;
            setProjectMilestones((prev) => ({
                ...prev,
                [PROJECT.projectId]: prev[PROJECT.projectId].map((m) =>
                    m.milestoneId === milestoneId ? { ...m } : m
                ),
            }));
        },
        isMilestoneFavorited: () => false,
    });
    const usePM = stubBag({ currentProject: PROJECT, teamProjects: [PROJECT] });
    return (
        <TaskPreview
            myself={ME as never}
            setMyself={vi.fn()}
            socket={null}
            useCM={stubBag({}) as never}
            useNM={stubBag({ taskNoteMeta: undefined }) as never}
            usePM={usePM as never}
            useSM={useSM as never}
            useTEM={stubBag({ teamMemberProfiles: {}, teamMembers: [] }) as never}
            useTM={useTM as never}
            useUISM={stubBag({}) as never}
        />
    );
};

const mount = (milestones: ReturnType<typeof makeMilestone>[]) =>
    render(
        <CssVarsProvider>
            <Host milestones={milestones} />
        </CssVarsProvider>
    );

const settle = () =>
    act(async () => {
        for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });

const answerDeps = async (taskId: number) => {
    const p = network.pending.find(
        (r) => /^\/task\/dependency\/list\//.test(r.url) && taskIdOf(r.url) === taskId
    );
    if (!p) throw new Error(`no pending dependency request for ${taskId}`);
    network.pending.splice(network.pending.indexOf(p), 1);
    await act(async () => {
        p.resolve({ blocking: [], blockedBy: [{ id: 1, taskId: 999 }] });
    });
    await settle();
};

beforeEach(() => {
    network.all.length = 0;
    network.pending.length = 0;
    host.loads = [];
    host.refreshes = 0;
});
afterEach(() => {
    vi.clearAllMocks();
});

describe("milestone preview loads its backing task's dependencies (MIP-1415)", () => {
    it("opening a milestone requests the backing task's edges, once", async () => {
        mount([makeMilestone(14151, 141510)]);
        await settle();
        expect(depUrls().map(taskIdOf)).toEqual([141510]);
        await answerDeps(141510);
        expect(host.deps[141510]).toEqual({ blocking: [], blockedBy: [{ id: 1, taskId: 999 }] });
    });

    it("the edges landing re-pulls the milestone once and does not load again (no loop)", async () => {
        mount([makeMilestone(14152, 141520)]);
        await settle();
        const refreshesBefore = host.refreshes;
        await answerDeps(141520);
        // `backingDepsKey` changed: one re-pull, which hands back a new milestone object
        await settle();
        expect(host.refreshes).toBe(refreshesBefore + 1);
        // ...with the same backing task id, so no second dependency load
        expect(host.loads).toEqual([141520]);
        expect(depUrls()).toHaveLength(1);
    });

    it("switching to another milestone loads that milestone's edges", async () => {
        mount([makeMilestone(14153, 141530), makeMilestone(14154, 141540)]);
        await settle();
        await answerDeps(141530);
        await act(async () => {
            host.openMilestone(14154);
        });
        await settle();
        expect(host.loads).toEqual([141530, 141540]);
        await answerDeps(141540);
        expect(host.deps[141540]).toBeDefined();
    });
});
