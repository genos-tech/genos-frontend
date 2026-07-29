/**
 * The milestone table-scope belongs to a project.
 *
 * Repro this fixes: scope the table to milestone-a in project-a, then
 * open a task from ANOTHER project via the sidebar's Recents. The scope
 * survived the project switch, project-b has no milestone-a, and the
 * table went empty even though project-b was full of tasks.
 *
 * The scope is stored WITH its project and reported as inactive
 * elsewhere, rather than cleared by whoever happens to switch projects —
 * that clearing lived at individual call sites, and the ones that forgot
 * (Recents, task search, URL navigation) each produced the empty table.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useTaskManagement } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";

vi.mock("../../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: vi.fn().mockResolvedValue([]),
}));

const myself = {
    userId: "u1",
    teamId: "t1",
    userName: "Me",
    userEmail: "me@example.com",
} as UserProps;

const PROJECT_A = 1;
const PROJECT_B = 2;
const MILESTONE_A = 55;

/** Render with a switchable "current project", as the workspace does. */
const renderWithProject = (initialProjectId: number | null | undefined) =>
    renderHook(
        ({ projectId }: { projectId: number | null | undefined }) =>
            useTaskManagement(myself, "token", projectId),
        { initialProps: { projectId: initialProjectId } }
    );

describe("useTaskManagement — milestone scope is project-scoped", () => {
    it("applies while the user is in the milestone's project", () => {
        const { result } = renderWithProject(PROJECT_A);

        act(() =>
            result.current.setTableMilestoneFilter({
                milestoneId: MILESTONE_A,
                projectId: PROJECT_A,
            })
        );

        expect(result.current.tableMilestoneFilterId).toBe(MILESTONE_A);
    });

    it("stops applying once the user is in a different project", () => {
        // The reported bug: this is what emptied the table.
        const { result, rerender } = renderWithProject(PROJECT_A);
        act(() =>
            result.current.setTableMilestoneFilter({
                milestoneId: MILESTONE_A,
                projectId: PROJECT_A,
            })
        );

        rerender({ projectId: PROJECT_B });

        expect(result.current.tableMilestoneFilterId).toBeNull();
    });

    it("applies again when the user returns to that project", () => {
        // Deactivated, not destroyed — the scope still describes
        // project-a, so going back restores what the user set. The
        // filter chip makes it visible and dismissible either way.
        const { result, rerender } = renderWithProject(PROJECT_A);
        act(() =>
            result.current.setTableMilestoneFilter({
                milestoneId: MILESTONE_A,
                projectId: PROJECT_A,
            })
        );

        rerender({ projectId: PROJECT_B });
        rerender({ projectId: PROJECT_A });

        expect(result.current.tableMilestoneFilterId).toBe(MILESTONE_A);
    });

    it("survives the momentary gap where no project is set", () => {
        // A switch runs `setAllTasks([])` → `loadProjectsAndTasks` →
        // `setCurrentProject`. If a transient null invalidated the scope,
        // the cross-project milestone click — which switches project and
        // scopes in one gesture — would lose the scope it just set.
        const { result, rerender } = renderWithProject(PROJECT_A);
        act(() =>
            result.current.setTableMilestoneFilter({
                milestoneId: MILESTONE_A,
                projectId: PROJECT_A,
            })
        );

        rerender({ projectId: null });
        expect(result.current.tableMilestoneFilterId).toBe(MILESTONE_A);

        rerender({ projectId: undefined });
        expect(result.current.tableMilestoneFilterId).toBe(MILESTONE_A);
    });

    it("never invalidates for a useTM built without project context", () => {
        // `useServiceInitialization` builds one of these; it has no
        // project and must not have its state second-guessed.
        const { result } = renderWithProject(undefined);

        act(() =>
            result.current.setTableMilestoneFilter({
                milestoneId: MILESTONE_A,
                projectId: PROJECT_A,
            })
        );

        expect(result.current.tableMilestoneFilterId).toBe(MILESTONE_A);
    });

    it("clears on null", () => {
        const { result } = renderWithProject(PROJECT_A);
        act(() =>
            result.current.setTableMilestoneFilter({
                milestoneId: MILESTONE_A,
                projectId: PROJECT_A,
            })
        );

        act(() => result.current.setTableMilestoneFilter(null));

        expect(result.current.tableMilestoneFilterId).toBeNull();
    });
});
