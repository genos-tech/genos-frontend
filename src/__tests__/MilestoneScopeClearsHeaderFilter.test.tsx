/**
 * MIP-1751: picking a milestone in the task sidebar must REPLACE the header's
 * milestone multi-select, not sit on top of it.
 *
 * The sidebar scope (`tableMilestoneFilterId`) and the header's milestone
 * multi-select are ANDed by `applyFilters`. A header selection of milestone A
 * (kept in localStorage) with a sidebar scope on milestone B therefore dropped
 * every row of B, including B's own backing row, and the table showed nothing.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskFilterMenu } from "../features/tasks/components/table/TaskFilterMenu";
import { loadProjectSavedFilters } from "../features/tasks/services/projectSavedFilters";
import { writeStoredFilters } from "../features/tasks/utils/taskFilterStorage";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import type { TaskTableProps } from "../types/tasks";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/tasks/services/projectSavedFilters", () => ({
    loadProjectSavedFilters: vi.fn().mockResolvedValue([]),
    createProjectSavedFilter: vi.fn(),
    updateProjectSavedFilter: vi.fn(),
    deleteProjectSavedFilter: vi.fn(),
}));

const KEY = "taskFilters:table:1";

const milestoneRow = (id: string, milestoneId: number): TaskTableProps =>
    ({
        id,
        title: `Milestone ${milestoneId}`,
        isMilestone: true,
        milestoneId,
        projectId: 1,
        status: "Open",
        priority: "Normal",
        effortLevel: "Low",
        parentTaskId: null,
    }) as unknown as TaskTableProps;

const childTask = (id: string, milestoneId: number, parentId: string): TaskTableProps =>
    ({
        id,
        title: `Task ${id}`,
        isMilestone: false,
        milestoneId,
        projectId: 1,
        status: "Open",
        priority: "Normal",
        effortLevel: "Low",
        parentTaskId: parentId,
    }) as unknown as TaskTableProps;

const allTasks: TaskTableProps[] = [
    milestoneRow("110", 10),
    milestoneRow("120", 20),
    childTask("t1", 10, "110"),
    childTask("t2", 20, "120"),
];

const useSM = {
    projectMilestones: {
        1: [
            {
                milestoneId: 10,
                taskId: 110,
                projectId: 1,
                title: "A",
                status: "Open",
                sprintId: null,
                isDeleted: false,
                assignees: [],
                tags: [],
                dueDate: null,
            },
            {
                milestoneId: 20,
                taskId: 120,
                projectId: 1,
                title: "B",
                status: "Open",
                sprintId: null,
                isDeleted: false,
                assignees: [],
                tags: [],
                dueDate: null,
            },
        ],
    },
    projectSprints: { 1: [] },
};

const makeTM = (tableMilestoneFilterId: number | null) =>
    ({
        allTasks,
        tableMilestoneFilterId,
        tagsRevision: 0,
        setTableMilestoneFilter: vi.fn(),
        ensureProjectStatuses: vi.fn(),
    }) as unknown as TaskManagementState;

const renderMenu = (
    tableMilestoneFilterId: number | null,
    setCurrentDisplayingTasks: (t: TaskTableProps[]) => void
) =>
    render(
        <CssVarsProvider>
            <TaskFilterMenu
                filterStorageKey={KEY}
                predefinedTagsFilters={[]}
                setCurrentDisplayingTasks={setCurrentDisplayingTasks}
                useSM={useSM as never}
                useTM={makeTM(tableMilestoneFilterId)}
            />
        </CssVarsProvider>
    );

const idsOf = (calls: TaskTableProps[][]) =>
    calls[calls.length - 1].map((t) => String(t.id)).sort();

beforeEach(() => {
    localStorage.clear();
    // The header multi-select is narrowed to milestone A (id 10).
    writeStoredFilters(KEY, { milestoneKeys: [10] } as never);
});

describe("sidebar milestone scope vs the header milestone multi-select", () => {
    it("scoping to milestone B from the sidebar replaces a stored header selection of A", () => {
        const calls: TaskTableProps[][] = [];
        const set = (t: TaskTableProps[]) => calls.push(t);
        const { rerender } = renderMenu(null, set);
        // Before the sidebar click: only A's rows.
        expect(idsOf(calls)).toEqual(["110", "t1"]);

        rerender(
            <CssVarsProvider>
                <TaskFilterMenu
                    filterStorageKey={KEY}
                    predefinedTagsFilters={[]}
                    setCurrentDisplayingTasks={set}
                    useSM={useSM as never}
                    useTM={makeTM(20)}
                />
            </CssVarsProvider>
        );
        // B's backing row and its child must both show.
        expect(idsOf(calls)).toEqual(["120", "t2"]);
    });

    it("opening the table while a milestone is already scoped does not keep the stale header selection", () => {
        const calls: TaskTableProps[][] = [];
        renderMenu(20, (t) => calls.push(t));
        expect(idsOf(calls)).toEqual(["120", "t2"]);
    });

    it("applying a saved filter that narrows by milestone drops an active sidebar scope", async () => {
        vi.mocked(loadProjectSavedFilters).mockResolvedValue([
            {
                id: 1,
                filterName: "Milestone A",
                filters: { milestoneKeys: [10] },
                createdBy: "u9",
                tsUpdatedAt: "2026-11-01T00:00:00Z",
            } as never,
        ]);
        const setTableMilestoneFilter = vi.fn();
        const useTM = {
            allTasks,
            tableMilestoneFilterId: 20,
            tagsRevision: 0,
            setTableMilestoneFilter,
            ensureProjectStatuses: vi.fn(),
        } as unknown as TaskManagementState;
        render(
            <CssVarsProvider>
                <TaskFilterMenu
                    filterStorageKey={KEY}
                    predefinedTagsFilters={[]}
                    savedFiltersProjectId={1}
                    savedFiltersTeamId="t1"
                    setCurrentDisplayingTasks={vi.fn()}
                    useSM={useSM as never}
                    useTM={useTM}
                />
            </CssVarsProvider>
        );
        fireEvent.click(await screen.findByTestId("saved-filters-button"));
        fireEvent.click(await screen.findByRole("menuitem", { name: /Milestone A/ }));
        expect(setTableMilestoneFilter).toHaveBeenCalledWith(null);
    });
});

describe("sidebar milestone scope vs a stored header sprint filter (MIP-1897)", () => {
    it("scoping to a milestone in another sprint clears the stored sprint filter", () => {
        writeStoredFilters(KEY, { sprintKeys: [1] } as never);
        const inSprint = (t: TaskTableProps, sprintId: number) =>
            ({ ...t, sprintId }) as unknown as TaskTableProps;
        const tasks = [
            inSprint(milestoneRow("110", 10), 1),
            inSprint(milestoneRow("120", 20), 2),
            inSprint(childTask("t1", 10, "110"), 1),
            inSprint(childTask("t2", 20, "120"), 2),
        ];
        const sprint = (sprintId: number) => ({
            sprintId,
            projectId: 1,
            status: "Active",
            isDeleted: false,
            name: `Sprint ${sprintId}`,
        });
        const sm = { ...useSM, projectSprints: { 1: [sprint(1), sprint(2)] } };
        const calls: TaskTableProps[][] = [];
        const tm = { ...makeTM(20), allTasks: tasks } as unknown as TaskManagementState;
        render(
            <CssVarsProvider>
                <TaskFilterMenu
                    filterStorageKey={KEY}
                    predefinedTagsFilters={[]}
                    setCurrentDisplayingTasks={(t) => calls.push(t)}
                    useSM={sm as never}
                    useTM={tm}
                />
            </CssVarsProvider>
        );
        expect(idsOf(calls)).toEqual(["120", "t2"]);
    });
});
