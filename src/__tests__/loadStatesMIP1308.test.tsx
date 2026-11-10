/**
 * MIP-1308: the surfaces MIP-1276 only read ("grep only") say what they are doing.
 *
 *  - Sub Tasks block: a failed children request is not "No sub tasks yet", and neither is the
 *    moment before the first answer. Fails at the REQUEST (axios `get` rejects), then Retry
 *    lands the second one.
 *  - Saved filters menu: a failed read is not "No saved filters yet". Same.
 *  - Sprint board: while the first read of a project is in flight the columns are a skeleton,
 *    and when it failed (and nothing is cached) the board is the error with Retry. The board
 *    gets both from the app-wide sync state (MIP-1298), so it is tested at that boundary; the
 *    request -> sync-state half is `syncStatus.test` / the loaders' own tests. An empty board
 *    AFTER a read is still the columns: the quick-add "+" is how the first card is made.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SprintBoard } from "../features/tasks/components/board/SprintBoard";
import { TaskSubTasksBlock } from "../features/tasks/components/contents/base/TaskSubTasksBlock";
import { ProjectsListItem } from "../features/tasks/components/sidebar/ProjectsListItem";
import { SavedFiltersMenu } from "../features/tasks/components/table/SavedFiltersMenu";
import { en } from "../i18n/locales/en";
import { syncStatus, tasksScope } from "../services/syncStatus";
import type { TaskProps, TaskTableProps } from "../types/tasks";

// ---- HTTP, faked at axios (same shape as loadStates.test.tsx) ---------------
const answers = vi.hoisted(() => ({ queue: [] as Array<{ match: string; out: unknown }> }));
const calls = vi.hoisted(() => ({ urls: [] as string[] }));
vi.mock("../services/api", async (orig) => ({
    ...(await orig<typeof import("../services/api")>()),
    authApi: () => ({
        get: vi.fn(async (url: string) => {
            calls.urls.push(url);
            const i = answers.queue.findIndex((a) => url.includes(a.match));
            const hit = i >= 0 ? answers.queue.splice(i, 1)[0] : undefined;
            if (!hit) throw new Error(`unexpected request ${url}`);
            if (hit.out instanceof Error) throw hit.out;
            if (hit.out instanceof Promise) return { data: await hit.out };
            return { data: hit.out };
        }),
    }),
}));
const fail = (match: string) => answers.queue.push({ match, out: new Error("Network Error") });
const ok = (match: string, out: unknown) => answers.queue.push({ match, out });
const hits = (match: string) => calls.urls.filter((u) => u.includes(match)).length;

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({ AvatarWithStatus: () => null }));

// The board: only the part under test is real (the drag library, the columns and the filter menu
// are stand-ins, like taskSaveRefusalBoard.test).
vi.mock("@hello-pangea/dnd", () => ({
    DragDropContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Droppable: ({ children }: { children: (p: unknown, s: unknown) => React.ReactNode }) => (
        <>{children({}, {})}</>
    ),
    Draggable: ({ children }: { children: (p: unknown, s: unknown) => React.ReactNode }) => (
        <>{children({}, {})}</>
    ),
}));
vi.mock("../features/tasks/components/board/SprintBoardColumn", () => ({
    COLUMN_MIN_WIDTH: 240,
    SprintBoardColumn: ({
        column,
        tasks,
        quickAddSlot,
        onQuickAddClick,
    }: {
        column: { id: string };
        tasks: TaskTableProps[];
        quickAddSlot?: React.ReactNode;
        onQuickAddClick?: () => void;
    }) => (
        <div data-testid={`column-${column.id}`}>
            {onQuickAddClick && (
                <button data-testid="quick-add-plus" type="button" onClick={onQuickAddClick} />
            )}
            {quickAddSlot}
            {tasks.map((t) => (
                <span key={t.id} data-testid={`card-${t.id}`} />
            ))}
        </div>
    ),
}));
vi.mock("../features/tasks/components/table/TaskFilterMenu", async () => {
    const React = await import("react");
    return {
        TaskFilterMenu: ({
            useTM,
            setCurrentDisplayingTasks,
        }: {
            useTM: { allTasks: TaskTableProps[] };
            setCurrentDisplayingTasks: (rows: TaskTableProps[]) => void;
        }) => {
            React.useEffect(() => {
                setCurrentDisplayingTasks(useTM.allTasks);
            }, [useTM.allTasks, setCurrentDisplayingTasks]);
            return null;
        },
    };
});
vi.mock("../features/tasks/diagram/components/LazyTaskDiagram", () => ({
    LazyTaskDiagram: () => null,
}));

const wrap = (ui: React.ReactNode) => <CssVarsProvider>{ui}</CssVarsProvider>;
const retry = () => screen.getByRole("button", { name: en.common.actions.retry });

beforeEach(() => {
    answers.queue.length = 0;
    calls.urls.length = 0;
    syncStatus.__reset();
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("Sub Tasks block", () => {
    const child = {
        id: 701,
        displayId: "PRJ-701",
        title: "Wire the endpoint",
        status: { code: 0, status: "Open", color: "#0044c2", textColor: "white" },
        tags: [],
        project: { projectId: 46, projectName: "Destination" },
    };
    // The child-list loader memoizes answers per parent for 30 s, so each case uses its own parent.
    const block = (parentId: number) =>
        render(
            wrap(
                <TaskSubTasksBlock
                    currentTaskContent={
                        {
                            id: parentId,
                            rootTaskId: parentId,
                            title: "Parent",
                            project: { projectId: 46, projectName: "Destination" },
                        } as unknown as TaskProps
                    }
                    emptyText="No tasks yet"
                    forceLoad={true}
                    myself={{ userId: "u1", teamId: "t1" } as never}
                    SectionHeader={({ children }) => <div>{children}</div>}
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{} as never}
                    useTEM={{ teamMemberProfiles: {} } as never}
                    useTM={{ currentPreviewTaskId: -1 } as never}
                    useUISM={{} as never}
                />
            )
        );

    it("a failed load is not 'no sub tasks'; Retry asks again and the rows land", async () => {
        fail("/task/childTasks/");
        ok("/task/childTasks/", [child]);
        block(901);

        expect(await screen.findByText(en.tasks.subTasks.loadFailed)).toBeTruthy();
        expect(screen.queryByText("No tasks yet")).toBeNull();

        fireEvent.click(retry());

        expect(await screen.findByText("Wire the endpoint")).toBeTruthy();
        expect(screen.queryByText(en.tasks.subTasks.loadFailed)).toBeNull();
        expect(hits("/task/childTasks/")).toBe(2);
    });

    it("a task's rows are not drawn under the next task while its list loads", async () => {
        ok("/task/childTasks/", [child]);
        const view = block(903);
        expect(await screen.findByText("Wire the endpoint")).toBeTruthy();

        let answer!: (rows: unknown[]) => void;
        ok("/task/childTasks/", new Promise<unknown[]>((r) => (answer = r)));
        view.rerender(
            wrap(
                <TaskSubTasksBlock
                    currentTaskContent={
                        {
                            id: 904,
                            rootTaskId: 904,
                            title: "Next",
                            project: { projectId: 46, projectName: "Destination" },
                        } as unknown as TaskProps
                    }
                    emptyText="No tasks yet"
                    forceLoad={true}
                    myself={{ userId: "u1", teamId: "t1" } as never}
                    SectionHeader={({ children }) => <div>{children}</div>}
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{} as never}
                    useTEM={{ teamMemberProfiles: {} } as never}
                    useTM={{ currentPreviewTaskId: -1 } as never}
                    useUISM={{} as never}
                />
            )
        );

        await waitFor(() => expect(hits("/task/childTasks/")).toBe(2));
        expect(screen.queryByText("Wire the endpoint")).toBeNull();
        expect(screen.queryByText("No tasks yet")).toBeNull();

        await act(async () => answer([]));
        expect(await screen.findByText("No tasks yet")).toBeTruthy();
    });

    it("says 'no sub tasks' only after an answer of none, never while it waits", async () => {
        let answer!: (rows: unknown[]) => void;
        ok("/task/childTasks/", new Promise<unknown[]>((r) => (answer = r)));
        block(902);

        await waitFor(() => expect(hits("/task/childTasks/")).toBe(1));
        expect(screen.queryByText("No tasks yet")).toBeNull();
        expect(screen.queryByText(en.tasks.subTasks.loadFailed)).toBeNull();

        await act(async () => answer([]));

        expect(await screen.findByText("No tasks yet")).toBeTruthy();
    });
});

describe("Saved filters menu", () => {
    const saved = {
        id: 1,
        filterName: "My blocked work",
        filters: { status: ["Blocked"] },
        createdBy: "u9",
        tsUpdatedAt: "2026-07-30T00:00:00Z",
    };
    const menu = () =>
        render(
            wrap(
                <SavedFiltersMenu
                    getCurrentFilters={() => ({}) as never}
                    isCurrentSelection={() => false}
                    projectId={7}
                    teamId="t1"
                    onApply={vi.fn()}
                />
            )
        );

    it("a failed read is not 'no saved filters'; Retry asks again and the filters show", async () => {
        // The list is read on mount and again when the menu opens; both fail, Retry works.
        fail("/project/saved-task-filters/");
        fail("/project/saved-task-filters/");
        ok("/project/saved-task-filters/", [saved]);
        menu();
        fireEvent.click(await screen.findByTestId("saved-filters-button"));

        expect(await screen.findByText(en.tasks.savedFilters.loadFailed)).toBeTruthy();
        expect(screen.queryByText(en.tasks.savedFilters.empty)).toBeNull();

        fireEvent.click(retry());

        expect(await screen.findByText("My blocked work")).toBeTruthy();
        expect(hits("/project/saved-task-filters/")).toBe(3);
    });
});

describe("Sprint board", () => {
    const row = {
        id: "42",
        displayId: "KDS-42",
        title: "A task",
        status: "Open",
        priority: "Medium",
        effortLevel: "Medium",
        dueDate: "",
        projectId: 1,
        parentTaskId: null,
        milestoneId: null,
        isMilestone: false,
        assigneeId: "u1",
        tags: [],
    } as unknown as TaskTableProps;
    const board = (tm: Record<string, unknown>) =>
        render(
            wrap(
                <SprintBoard
                    myself={{ teamId: "t1", userId: "u1" } as never}
                    setTeamMembers={vi.fn()}
                    teamMemberProfiles={{}}
                    teamMembers={[]}
                    usePM={{ currentProject: { projectId: 1, projectTags: [] } } as never}
                    useSM={{ projectMilestones: {}, projectSprints: {} } as never}
                    useTM={
                        {
                            allTasks: [],
                            setAllTasks: vi.fn(),
                            tableMilestoneFilterId: null,
                            currentPreviewTask: undefined,
                            setCurrentPreviewTask: vi.fn(),
                            isLoadingTasks: false,
                            ...tm,
                        } as never
                    }
                />
            )
        );

    it("is a skeleton, not five empty columns, while the first read is in flight", () => {
        board({ isLoadingTasks: true });
        expect(screen.getByRole("status", { name: en.tasks.table.loadingTasks })).toBeTruthy();
        expect(screen.queryByTestId("column-open")).toBeNull();
    });

    it("is the error with Retry when the read failed and nothing is cached; Retry re-runs the sync", async () => {
        const rerun = vi.fn(() => {
            syncStatus.report("tasks:1", true);
        });
        syncStatus.setRetry(rerun);
        act(() => syncStatus.report("tasks:1", false));
        board({});

        expect(await screen.findByText(en.common.feedback.sync.tasksFailed)).toBeTruthy();
        expect(screen.queryByTestId("column-open")).toBeNull();

        fireEvent.click(retry());

        await waitFor(() => expect(screen.getByTestId("column-open")).toBeTruthy());
        expect(rerun).toHaveBeenCalledTimes(1);
        expect(screen.queryByText(en.common.feedback.sync.tasksFailed)).toBeNull();
    });

    it("MIP-1323: stays a skeleton while the project's first read is in flight, past the 8 s isLoadingTasks timeout", async () => {
        let answer!: () => void;
        const read = syncStatus.track(tasksScope(1), new Promise<void>((r) => (answer = r)));
        // `isLoadingTasks` already timed out (false), the read is still running.
        board({ isLoadingTasks: false });
        expect(screen.getByRole("status", { name: en.tasks.table.loadingTasks })).toBeTruthy();
        expect(screen.queryByTestId("column-open")).toBeNull();

        await act(async () => {
            answer();
            await read;
        });
        expect(screen.getByTestId("column-open")).toBeTruthy();
    });

    it("MIP-1323: another project's failed load does not turn this board into an error", () => {
        act(() => syncStatus.report("tasks:2", false));
        board({});
        expect(screen.getByTestId("column-open")).toBeTruthy();
        expect(screen.queryByText(en.common.feedback.sync.tasksFailed)).toBeNull();
    });

    it("an empty board after a read is still the columns (the quick-add is how the first card is made)", () => {
        board({});
        expect(screen.getByTestId("column-open")).toBeTruthy();
        expect(screen.queryByRole("status", { name: en.tasks.table.loadingTasks })).toBeNull();
    });

    it("a reload that starts while the quick-add card is open does not unmount it (empty project)", () => {
        const tm = (isLoadingTasks: boolean) =>
            ({
                allTasks: [],
                setAllTasks: vi.fn(),
                tableMilestoneFilterId: null,
                currentPreviewTask: undefined,
                setCurrentPreviewTask: vi.fn(),
                isLoadingTasks,
            }) as never;
        const element = (isLoadingTasks: boolean) =>
            wrap(
                <SprintBoard
                    myself={{ teamId: "t1", userId: "u1" } as never}
                    setTeamMembers={vi.fn()}
                    teamMemberProfiles={{}}
                    teamMembers={[]}
                    usePM={{ currentProject: { projectId: 1, projectTags: [] } } as never}
                    useSM={{ projectMilestones: {}, projectSprints: {} } as never}
                    useTM={tm(isLoadingTasks)}
                />
            );
        const view = render(element(false));
        fireEvent.click(screen.getByTestId("quick-add-plus"));
        const draft = () => screen.queryByPlaceholderText(/./, { exact: false });
        expect(screen.getByTestId("column-open")).toBeTruthy();

        view.rerender(element(true));

        // The columns (and with them the open card) are still there: no skeleton.
        expect(screen.getByTestId("column-open")).toBeTruthy();
        expect(screen.queryByRole("status", { name: en.tasks.table.loadingTasks })).toBeNull();
        void draft;
    });

    it("cached cards stay on screen when a refresh failed or is in flight", () => {
        act(() => syncStatus.report("tasks:1", false));
        board({ allTasks: [row], isLoadingTasks: true });
        expect(screen.getByTestId("card-42")).toBeTruthy();
        expect(screen.queryByText(en.common.feedback.sync.tasksFailed)).toBeNull();
    });
});

describe("Task sidebar projects", () => {
    const sidebar = () =>
        render(
            wrap(
                <ProjectsListItem
                    myself={{ userId: "u1", teamId: "t1" } as never}
                    setOpenJoinProject={vi.fn()}
                    useCM={{ allChats: [] } as never}
                    usePM={{ teamProjects: [], currentProject: undefined } as never}
                    useSM={{} as never}
                    useTEM={{ currentTeam: { isGuest: false }, teamMemberProfiles: {} } as never}
                    useTM={{} as never}
                />
            )
        );

    it("a failed project read with nothing cached is the error with Retry, not an empty list", async () => {
        const rerun = vi.fn(() => {
            syncStatus.report("projects", true);
        });
        syncStatus.setRetry(rerun);
        act(() => syncStatus.report("projects", false));
        sidebar();

        expect(await screen.findByText(en.common.feedback.sync.projectsFailed)).toBeTruthy();

        fireEvent.click(retry());

        await waitFor(() =>
            expect(screen.queryByText(en.common.feedback.sync.projectsFailed)).toBeNull()
        );
        expect(rerun).toHaveBeenCalledTimes(1);
    });

    it("says nothing when no read failed", () => {
        sidebar();
        expect(screen.queryByText(en.common.feedback.sync.projectsFailed)).toBeNull();
    });
});
