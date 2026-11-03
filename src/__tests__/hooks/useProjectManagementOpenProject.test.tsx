/**
 * Opening a project from the UI (MIP-969, step 2).
 *
 * A click on a project in the sidebar used to await `loadProjectsAndTasks`,
 * which first waits for the whole `GET /project/projects/` answer, then picks
 * the project out of it, sets it as the open one and only then loads its tasks:
 * two network round trips in series, with the open project (and so the URL, the
 * filters and the sort) unchanged until the first of them returned.
 *
 * `openProject(project)` does the two things the click needs and nothing else:
 *   - the project becomes the open one in the SAME render as the click;
 *   - its rows are refreshed from the server (`refreshProjectTasks`). The
 *     project list is not asked for again: the click already holds the project,
 *     and the 60 s refresh keeps the list current.
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadProjectTasks } from "../../features/tasks/services/loadProjectTasks";
import { loadTeamProjects } from "../../features/tasks/services/loadTeamProjects";
import { useProjectManagement } from "../../hooks/common/useProjectManagement";
import { UserProps } from "../../types/admin";
import { ProjectProps } from "../../types/tasks";

vi.mock("../../features/tasks/services/loadTeamProjects", () => ({
    loadTeamProjects: vi.fn(async () => undefined),
}));
vi.mock("../../features/tasks/services/loadProjectTasks", () => ({
    loadProjectTasks: vi.fn(async () => []),
}));

// No userId: the hook's own "load on mount" effect stays out of the way.
const myself = { userId: "", teamId: "t1", userName: "Me" } as unknown as UserProps;

const project = (projectId: number, over: Partial<ProjectProps> = {}): ProjectProps => ({
    projectId,
    projectName: `P${projectId}`,
    projectTags: [],
    ...over,
});

const setup = () => {
    const view = renderHook(() => useProjectManagement(myself, "token", "t1"));
    return view;
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("useProjectManagement.openProject", () => {
    it("makes the project the open one in the same act, before anything is awaited", () => {
        const view = setup();

        act(() => {
            view.result.current.openProject(project(20));
        });

        expect(view.result.current.currentProject?.projectId).toBe(20);
    });

    it("refreshes the project's rows, and does not ask for the project list again", async () => {
        const view = setup();

        await act(async () => {
            view.result.current.openProject(project(20));
        });

        expect(loadProjectTasks).toHaveBeenCalledTimes(1);
        expect(vi.mocked(loadProjectTasks).mock.calls[0][1]).toBe(20);
        expect(loadTeamProjects).not.toHaveBeenCalled();
        // The rows' arrival is announced, so the table reads them again.
        expect(view.result.current.tsTasksLoadedToIDB?.projectId).toBe(20);
    });

    it("opens the complete record from the team's list when the caller's object is partial", () => {
        const view = setup();
        const listed = project(20, {
            isExternal: true,
            hostTeamId: "t9",
            hostTeamName: "Partner Co",
            projectLabels: [{ labelId: 1, name: "L", color: "#000", textColor: "#fff" }],
            isPrivate: true,
            isJoined: true,
        });
        act(() => view.result.current.setTeamProjects([project(10), listed]));

        // What the dashboard picker and the milestone click used to build: no
        // isExternal / hostTeamName / projectLabels.
        act(() => {
            view.result.current.openProject(project(20, { isPrivate: true }));
        });

        expect(view.result.current.currentProject).toEqual(listed);
    });

    it("opens the caller's object when the project is not in the list", () => {
        const view = setup();
        const given = project(77, { projectName: "Not listed" });

        act(() => {
            view.result.current.openProject(given);
        });

        expect(view.result.current.currentProject).toEqual(given);
    });

    it("a failed refresh leaves the project open and does not throw", async () => {
        vi.mocked(loadProjectTasks).mockRejectedValueOnce(new Error("offline"));
        const errors = vi.spyOn(console, "error").mockImplementation(() => {});
        const view = setup();

        await act(async () => {
            view.result.current.openProject(project(20));
        });

        expect(view.result.current.currentProject?.projectId).toBe(20);
        expect(view.result.current.tsTasksLoadedToIDB).toBeUndefined();
        errors.mockRestore();
    });
});
