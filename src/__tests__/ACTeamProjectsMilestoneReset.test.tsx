/**
 * Project switch vs milestone linkage in the create form.
 *
 * Milestone/sprint are project-scoped, and the milestone picker also
 * derives parentTaskId/rootTaskId (the milestone's backing task). When
 * the create form's project picker changes project, that whole selection
 * is stale: if it rides into the finalize PUT the backend clears it
 * server-side (it belongs to the old project), but the form kept
 * *showing* it, and `addTask` cached the stale milestoneId onto the
 * created row in IDB. `resetMilestoneOnChange` clears the four ids
 * locally on an actual project change — create-form mounts only
 * (preview/edit relies on the backend move handler and must keep an
 * existing sub-task's parent edge).
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ACTeamProjects } from "../features/tasks/components/autocompletes/ACTeamProjects";
import type { ProjectManagementState } from "../hooks/common/useProjectManagement";
import type { TaskProps } from "../types/tasks";

const projectA = {
    projectId: 1,
    projectName: "Alpha",
    projectTags: [],
    systemUserId: "sys-1",
};
const projectB = {
    projectId: 2,
    projectName: "Beta",
    projectTags: [],
    systemUserId: "sys-2",
};

const makeTaskContent = (): TaskProps =>
    ({
        id: 10,
        // A CLONE on purpose: in production `taskContent.project` is a
        // rebuilt object (from setTaskContent spreads), never the same
        // reference as the `usePM.teamProjects` option — and MUI decides
        // whether to fire onChange partly on identity.
        project: { ...projectA },
        title: "T",
        tags: [{ id: 1, tagName: "keepme" }],
        milestoneId: 5,
        sprintId: 3,
        parentTaskId: 90,
        rootTaskId: 90,
    }) as unknown as TaskProps;

const renderPicker = (opts: { reset?: boolean; taskContent?: TaskProps }) => {
    const setTaskContent = vi.fn();
    const usePM = {
        teamProjects: [projectA, projectB],
        setCurrentProject: vi.fn(),
    } as unknown as ProjectManagementState;
    render(
        <CssVarsProvider>
            <ACTeamProjects
                isOpenProjectList={false}
                resetMilestoneOnChange={opts.reset}
                setIsOpenProjectList={vi.fn()}
                setTaskContent={setTaskContent}
                taskContent={opts.taskContent ?? makeTaskContent()}
                usePM={usePM}
            />
        </CssVarsProvider>
    );
    return { setTaskContent };
};

const pickProject = (name: string) => {
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    // ArrowDown opens the listbox with the UNFILTERED option set — typing
    // the current value's own label doesn't reopen it.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name }));
};

describe("ACTeamProjects milestone reset on project change", () => {
    it("clears milestone/sprint/parent/root when switching project with the flag on", () => {
        const { setTaskContent } = renderPicker({ reset: true });

        pickProject("Beta");

        expect(setTaskContent).toHaveBeenCalledTimes(1);
        const next = setTaskContent.mock.calls[0][0];
        expect(next.project.projectId).toBe(2);
        expect(next.milestoneId).toBeNull();
        expect(next.sprintId).toBeNull();
        expect(next.parentTaskId).toBeNull();
        expect(next.rootTaskId).toBeNull();
        expect(next.tags).toEqual([]);
    });

    it("keeps the milestone selection when the flag is off (preview/edit mounts)", () => {
        const { setTaskContent } = renderPicker({ reset: false });

        pickProject("Beta");

        const next = setTaskContent.mock.calls[0][0];
        expect(next.project.projectId).toBe(2);
        expect(next.milestoneId).toBe(5);
        expect(next.parentTaskId).toBe(90);
    });

    it("does not clear when re-selecting the already-current project", () => {
        const { setTaskContent } = renderPicker({ reset: true });

        pickProject("Alpha");

        const next = setTaskContent.mock.calls[0][0];
        expect(next.project.projectId).toBe(1);
        expect(next.milestoneId).toBe(5);
        expect(next.parentTaskId).toBe(90);
    });
});
