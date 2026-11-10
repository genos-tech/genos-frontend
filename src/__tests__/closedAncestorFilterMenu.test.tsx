/**
 * MIP-1389: the table's filter pass reads a row under a Closed ancestor as Closed
 * and one under a Deleted ancestor as Deleted, whatever the rows themselves say.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskFilterMenu } from "../features/tasks/components/table/TaskFilterMenu";
import { predefinedStatusFilters } from "../features/tasks/types/TaskTableTypes";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import type { TaskTableProps } from "../types/tasks";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/tasks/services/projectSavedFilters", () => ({
    loadProjectSavedFilters: vi.fn().mockResolvedValue([]),
    createProjectSavedFilter: vi.fn(),
    updateProjectSavedFilter: vi.fn(),
    deleteProjectSavedFilter: vi.fn(),
}));

const row = (fields: Record<string, unknown>) =>
    ({ projectId: 1, ...fields }) as unknown as TaskTableProps;

const allTasks = [
    row({ id: "1", status: "Open" }),
    row({ id: "2", status: "Closed" }),
    row({ id: "3", status: "Open", parentTaskId: "2" }),
    row({ id: "4", status: "WIP", parentTaskId: "3" }),
    row({ id: "5", status: "Deleted" }),
    row({ id: "6", status: "Open", parentTaskId: "5" }),
];

const mount = () => {
    const shown = vi.fn();
    const children = vi.fn();
    const useTM = {
        allTasks,
        tableMilestoneFilterId: null,
        tagsRevision: 0,
        setTableMilestoneFilter: vi.fn(),
    } as unknown as TaskManagementState;
    render(
        <CssVarsProvider>
            <TaskFilterMenu
                predefinedTagsFilters={[predefinedStatusFilters[0]]}
                setCurrentDisplayingTasks={shown}
                setVisibleChildTaskIds={children}
                useTM={useTM}
            />
        </CssVarsProvider>
    );
    // What the table can show: the roots that pass, and the sub-tasks that pass.
    const lastIds = () => {
        const roots = shown.mock.calls[shown.mock.calls.length - 1]?.[0] as TaskTableProps[];
        const subs = children.mock.calls[children.mock.calls.length - 1]?.[0] as Set<string>;
        return [...roots.map((t) => String(t.id)), ...subs].sort();
    };
    return { lastIds };
};

beforeEach(() => localStorage.clear());

describe("the filter pass and a Closed or Deleted ancestor (MIP-1389)", () => {
    it("lists neither the children of a Closed task nor those of a Deleted one on the default statuses", async () => {
        const { lastIds } = mount();
        await waitFor(() => expect(lastIds()).toEqual(["1"]));
    });

    it("ticking Closed lists the children of a Closed task, still not those of a Deleted one", async () => {
        const { lastIds } = mount();
        await waitFor(() => expect(lastIds()).toEqual(["1"]));
        const status = screen
            .getAllByRole("button")
            .find((b) => /^Status/.test(b.textContent ?? ""))!;
        fireEvent.click(status);
        fireEvent.click(await screen.findByRole("menuitem", { name: /Closed/ }));
        await waitFor(() => expect(lastIds()).toEqual(["1", "2", "3", "4"]));
    });
});
