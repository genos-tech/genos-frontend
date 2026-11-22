/**
 * MIP-2000: the filter bar tells the project load which statuses its selection needs, and
 * shows the server's count on a status whose rows are not loaded yet.
 *
 * `useTM.ensureProjectStatuses` is a spy here: that it fetches once, and nothing on a repeat,
 * is pinned in projectStatusScopeMIP2000.test.ts. What this file pins is the SELECTION ->
 * NEED mapping through the real bar: a default bar, a chip, a stored filter, the board.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskFilterMenu } from "../features/tasks/components/table/TaskFilterMenu";
import {
    recordProjectScope,
    resetProjectScopes,
} from "../features/tasks/state/projectStatusScopeStore";
import { predefinedStatusFilters } from "../features/tasks/types/TaskTableTypes";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/tasks/services/projectSavedFilters", () => ({
    loadProjectSavedFilters: vi.fn().mockResolvedValue([]),
    createProjectSavedFilter: vi.fn(),
    updateProjectSavedFilter: vi.fn(),
    deleteProjectSavedFilter: vi.fn(),
}));

const PROJECT = 7;
const ACTIVE = ["Open", "WIP", "Blocked", "Pending"];

const ensure = vi.fn();
const useTM = {
    allTasks: [],
    tableMilestoneFilterId: null,
    tagsRevision: 0,
    setTableMilestoneFilter: vi.fn(),
    ensureProjectStatuses: ensure,
} as unknown as TaskManagementState;

const mount = (props: { hideStatusFilter?: boolean; filterStorageKey?: string } = {}) =>
    render(
        <CssVarsProvider>
            <TaskFilterMenu
                predefinedTagsFilters={[predefinedStatusFilters[0]]}
                savedFiltersProjectId={PROJECT}
                setCurrentDisplayingTasks={vi.fn()}
                useTM={useTM}
                {...props}
            />
        </CssVarsProvider>
    );

const trigger = (re: RegExp) =>
    screen.getAllByRole("button").find((b) => re.test(b.textContent ?? ""))!;

beforeEach(() => {
    localStorage.clear();
    resetProjectScopes();
    ensure.mockClear();
});

describe("what the bar asks the project load for", () => {
    it("the ongoing statuses on a default bar", () => {
        mount();
        expect(ensure).toHaveBeenLastCalledWith(PROJECT, ACTIVE);
    });

    it("every status once Closed is turned on, and the ongoing ones again when it is turned off", async () => {
        mount();
        fireEvent.click(trigger(/^Status/));
        fireEvent.click(await screen.findByRole("menuitem", { name: /Closed/ }));
        expect(ensure).toHaveBeenLastCalledWith(PROJECT, null);
        fireEvent.click(screen.getByRole("menuitem", { name: /Closed/ }));
        expect(ensure).toHaveBeenLastCalledWith(PROJECT, ACTIVE);
    });

    it("every status for All", async () => {
        mount();
        fireEvent.click(trigger(/^Status/));
        fireEvent.click(await screen.findByRole("menuitem", { name: /^All/ }));
        expect(ensure).toHaveBeenLastCalledWith(PROJECT, null);
    });

    it("every status for a stored filter that includes Closed (it is applied through the same state)", () => {
        localStorage.setItem(
            `taskFilters:table:${PROJECT}`,
            JSON.stringify({ status: ["Open", "Closed"] })
        );
        mount({ filterStorageKey: `taskFilters:table:${PROJECT}` });
        expect(ensure).toHaveBeenLastCalledWith(PROJECT, null);
    });

    it("every status on the board, whose status filter is hidden and pinned to All", () => {
        mount({ hideStatusFilter: true });
        expect(ensure).toHaveBeenLastCalledWith(PROJECT, null);
    });

    it("does not apply the previous project's selection to the project just switched to", () => {
        localStorage.setItem("taskFilters:table:7", JSON.stringify({ status: ["Closed"] }));
        const bar = (projectId: number) => (
            <CssVarsProvider>
                <TaskFilterMenu
                    filterStorageKey={`taskFilters:table:${projectId}`}
                    predefinedTagsFilters={[predefinedStatusFilters[0]]}
                    savedFiltersProjectId={projectId}
                    setCurrentDisplayingTasks={vi.fn()}
                    useTM={useTM}
                />
            </CssVarsProvider>
        );
        const { rerender } = render(bar(7));
        expect(ensure).toHaveBeenLastCalledWith(7, null);
        ensure.mockClear();
        rerender(bar(8));
        // Project 8 has no stored filter: it needs the ongoing statuses, and was never asked for All.
        expect(ensure).not.toHaveBeenCalledWith(8, null);
        expect(ensure).toHaveBeenLastCalledWith(8, ACTIVE);
    });

    it("asks again when the project's held statuses change (the first load answering)", () => {
        mount();
        const before = ensure.mock.calls.length;
        act(() => recordProjectScope(PROJECT, { statuses: ACTIVE, statusCounts: null }));
        expect(ensure.mock.calls.length).toBeGreaterThan(before);
    });
});

describe("the count on a status that is not loaded", () => {
    it("shows the server's count for Closed until its rows are loaded", async () => {
        act(() =>
            recordProjectScope(PROJECT, {
                statuses: ACTIVE,
                statusCounts: { Open: 9, WIP: 4, Blocked: 1, Pending: 6, Closed: 780, Deleted: 0 },
            })
        );
        mount();
        fireEvent.click(trigger(/^Status/));
        const menu = await screen.findByRole("menu");
        expect(within(menu).getByRole("menuitem", { name: /Closed/ }).textContent).toContain(
            "780"
        );
        // Statuses whose rows are held show no count: the table counts by effective status.
        expect(within(menu).getByRole("menuitem", { name: /^Open/ }).textContent).not.toMatch(
            /\d/
        );

        act(() => recordProjectScope(PROJECT, { statuses: null, statusCounts: null }));
        expect(within(menu).getByRole("menuitem", { name: /Closed/ }).textContent).not.toContain(
            "780"
        );
    });
});
