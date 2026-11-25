// MIP-2229: SprintManagerDialog loads sprints and milestones when it opens (or the project
// changes) and NOT again when the sprint-manager state object is replaced by a re-render.
import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SprintManagerDialog } from "../features/tasks/sprint-milestone/components/SprintManagerDialog";

const makeSM = () => {
    const loadSprintsForProject = vi.fn();
    const loadMilestonesForProject = vi.fn();
    const useSM = {
        projectSprints: { 1: [], 2: [] },
        projectMilestones: {},
        loadSprintsForProject,
        loadMilestonesForProject,
    } as never;
    return { useSM, loadSprintsForProject, loadMilestonesForProject };
};

const ui = (open: boolean, projectId: number, useSM: never) => (
    <CssVarsProvider>
        <SprintManagerDialog open={open} projectId={projectId} useSM={useSM} onClose={vi.fn()} />
    </CssVarsProvider>
);

describe("SprintManagerDialog load timing", () => {
    it("loads once on open, again only for a new project or a re-open", () => {
        const a = makeSM();
        const { rerender } = render(ui(false, 1, a.useSM));
        expect(a.loadSprintsForProject).not.toHaveBeenCalled();
        rerender(ui(true, 1, a.useSM));
        expect(a.loadSprintsForProject).toHaveBeenCalledTimes(1);

        // A new state object (same project, still open) must not reload.
        const b = makeSM();
        rerender(ui(true, 1, b.useSM));
        expect(a.loadSprintsForProject).toHaveBeenCalledTimes(1);
        expect(b.loadSprintsForProject).not.toHaveBeenCalled();

        // Another project loads through the LATEST state object.
        rerender(ui(true, 2, b.useSM));
        expect(b.loadSprintsForProject).toHaveBeenCalledWith(2);
        expect(b.loadMilestonesForProject).toHaveBeenCalledTimes(1);
    });
});
