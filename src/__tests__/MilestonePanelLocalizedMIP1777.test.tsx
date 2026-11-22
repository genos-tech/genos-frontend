/**
 * MIP-1777: the milestone panel's own words come from the locale files.
 *
 * Opening a milestone showed English next to Japanese: the header chip "Milestone", the
 * "Start Milestone" / "Complete Milestone" button and the "N total" progress line were literal
 * JSX text, so no locale could translate them. The REAL `TaskPreview` (milestone mode) is
 * mounted under the real `I18nProvider`, in en, ja and ar, with the leaves stubbed the way
 * `MilestonePreviewDependencies.test.tsx` does it.
 *
 * The wording of ja / ar is a draft (TODO(copy): MIP-1777): the assertions read the catalog
 * instead of repeating the draft, and pin what must NOT show: the English.
 */
import { act } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskPreview } from "../features/tasks/components/contents/TaskPreview";
import { fmt, I18nProvider, loadLocale } from "../i18n";
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

vi.mock("../context/authState", () => ({
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

const makeMilestone = (status: string) => ({
    milestoneId: 17771,
    taskId: 177710,
    displayId: "PRJ-177710",
    projectId: PROJECT.projectId,
    teamId: "t1",
    sprintId: null,
    folderId: null,
    reporterId: null,
    reporter: null,
    title: "Launch",
    description: [],
    status,
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
    tsCreatedAt: "2026-11-01 10:00:00",
    tsUpdatedAt: "2026-11-01 10:00:00",
    tasksTotal: 4,
    tasksClosed: 0,
});

// Four tasks under the milestone: Open 3, WIP 1 -> "4 total".
const TASKS = [
    ["Open", 1],
    ["Open", 2],
    ["Open", 3],
    ["WIP", 4],
].map(([status, id]) => ({
    id,
    status,
    parentTaskId: 177710,
    milestoneId: 17771,
    isMilestone: false,
}));

const stubBag = <T extends object>(base: T): T =>
    new Proxy(base, {
        get: (target, prop) => {
            if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
            if (typeof prop === "symbol") return undefined;
            return () => undefined;
        },
    });

const Host = ({ status }: { status: string }) => {
    const useTM = stubBag({
        currentPreviewTask: undefined,
        currentPreviewTaskId: -1,
        currentPreviewKind: "milestone",
        currentPreviewMilestoneId: 17771,
        previewLoadFailedTaskId: null,
        allTasks: TASKS,
        taskComments: [],
        taskCommentLines: 1,
        taskDependencies: {},
    });
    const useSM = stubBag({
        projectMilestones: { [PROJECT.projectId]: [makeMilestone(status)] },
        convertedMilestones: {},
        projectSprints: {},
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

const mount = async (locale: "en" | "ja" | "ar", status: string) => {
    await loadLocale(locale);
    window.localStorage.setItem("genos-locale", locale);
    const view = render(
        <CssVarsProvider>
            <I18nProvider>
                <Host status={status} />
            </I18nProvider>
        </CssVarsProvider>
    );
    await act(async () => {
        for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });
    return view;
};

beforeEach(() => {
    window.localStorage.removeItem("genos-locale");
});
afterEach(() => {
    window.localStorage.removeItem("genos-locale");
    vi.clearAllMocks();
});

describe("the milestone panel header reads in the member's language (MIP-1777)", () => {
    for (const locale of ["ja", "ar"] as const) {
        it(`${locale}: an Open milestone shows the translated chip, Start button and total`, async () => {
            await mount(locale, "Open");
            const c = await loadLocale(locale);
            expect(c.tasks.preview.startMilestone).not.toBe(en.tasks.preview.startMilestone);
            expect(
                screen.getByRole("button", { name: c.tasks.preview.startMilestone })
            ).toBeInTheDocument();
            expect(screen.getByText(c.tasks.titleBlock.milestoneBadge)).toBeInTheDocument();
            expect(
                screen.getByText(`· ${fmt(c.tasks.preview.totalCount, { count: 4 })}`)
            ).toBeInTheDocument();
            // No English word of the panel's own is left next to it.
            expect(screen.queryByText("Start Milestone")).toBeNull();
            expect(screen.queryByText("Milestone")).toBeNull();
            expect(screen.queryByText(/\btotal\b/)).toBeNull();
        });

        it(`${locale}: a WIP milestone shows the translated Complete button`, async () => {
            await mount(locale, "WIP");
            const c = await loadLocale(locale);
            expect(
                screen.getByRole("button", { name: c.tasks.preview.completeMilestone })
            ).toBeInTheDocument();
            expect(screen.queryByText("Complete Milestone")).toBeNull();
            expect(
                screen.queryByRole("button", { name: c.tasks.preview.startMilestone })
            ).toBeNull();
        });
    }

    it("en is unchanged: Milestone, Start Milestone, 4 total", async () => {
        await mount("en", "Open");
        expect(screen.getByRole("button", { name: "Start Milestone" })).toBeInTheDocument();
        expect(screen.getByText("Milestone")).toBeInTheDocument();
        expect(screen.getByText("· 4 total")).toBeInTheDocument();
    });

    it("en: a WIP milestone says Complete Milestone", async () => {
        await mount("en", "WIP");
        expect(screen.getByRole("button", { name: "Complete Milestone" })).toBeInTheDocument();
    });

    it("a Pending milestone offers Start too", async () => {
        await mount("ja", "Pending");
        const ja = await loadLocale("ja");
        expect(
            screen.getByRole("button", { name: ja.tasks.preview.startMilestone })
        ).toBeInTheDocument();
    });
});
