/**
 * MIP-1057: "Ask Genos about this milestone" in the milestone's "..." menu opens THAT milestone's own
 * conversation, addressed by its BACKING task's id (never its `milestoneId`), in its project.
 *
 * The REAL `TaskPreview` (milestone mode) is mounted, with the leaves stubbed the way
 * `MilestonePreviewDependencies.test.tsx` does. The milestone's id (3) and its backing task's id (555)
 * are different on purpose.
 */
import { act, useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { onAskGenosAbout } from "../features/spotlight/askGenosAbout";
import { onAskGenosAboutTask } from "../features/taskAsk/taskAskLink";
import { TaskPreview } from "../features/tasks/components/contents/TaskPreview";
import { loadTaskDependenciesInto } from "../features/tasks/services/loadTaskDependencies";
import { en } from "../i18n/locales/en";

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

const Host = ({
    milestones,
    hostZIndex,
}: {
    milestones: ReturnType<typeof makeMilestone>[];
    hostZIndex?: number;
}) => {
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
            hostZIndex={hostZIndex}
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

const mount = (milestones: ReturnType<typeof makeMilestone>[], hostZIndex?: number) =>
    render(
        <CssVarsProvider>
            <Host hostZIndex={hostZIndex} milestones={milestones} />
        </CssVarsProvider>
    );

const settle = () =>
    act(async () => {
        for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });

afterEach(() => {
    vi.clearAllMocks();
});

describe("the milestone menu's Ask Genos (MIP-1057)", () => {
    const openMenu = async (milestone = makeMilestone(3, 555), hostZIndex?: number) => {
        mount([milestone], hostZIndex);
        await settle();
        fireEvent.click(screen.getAllByLabelText("More options")[0]);
        return screen.getAllByRole("menuitem");
    };

    it("is offered, and asks about the BACKING task, in the milestone's project, as a milestone", async () => {
        const items = await openMenu();
        expect(items.map((el) => el.textContent)).toContain(en.tasks.preview.menu.askGenos);
        const heard = vi.fn();
        const heardAboutRef = vi.fn();
        const off = onAskGenosAboutTask(heard);
        const offRef = onAskGenosAbout(heardAboutRef);
        fireEvent.click(screen.getByRole("menuitem", { name: en.tasks.preview.menu.askGenos }));
        off();
        offRef();
        expect(heard).toHaveBeenCalledTimes(1);
        expect(heard).toHaveBeenCalledWith({
            taskId: 555,
            projectId: PROJECT.projectId,
            displayId: "PRJ-555",
            title: "Milestone 3",
            isMilestone: true,
        });
        // Not the Cmd-K hand-off.
        expect(heardAboutRef).not.toHaveBeenCalled();
    });

    it("is not offered inside the link-preview modal (the window would open behind it)", async () => {
        const items = await openMenu(makeMilestone(3, 555), 10020);
        expect(items.map((el) => el.textContent)).not.toContain(en.tasks.preview.menu.askGenos);
    });
});
