// MIP-1337: a cold load of a project URL that is not the project boot picked (boot loads
// `lastProjectId`, or the first joined project) showed "No tasks to display" for about 60 s.
// The router switched to the URL's project with the bare `setCurrentProject`, which only
// reads IndexedDB; nothing fetched that project's rows until the 60 s change tick. The
// router must open it with `openProject`, which also fetches its rows.
import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { useTaskRouting } from "../../features/tasks/hooks/useTaskRouting";
import type { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import type { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import type { ProjectProps } from "../../types/tasks";

const project = (projectId: number) =>
    ({ projectId, title: `P${projectId}` }) as unknown as ProjectProps;

const setup = (path: string, currentProjectId: number) => {
    const openProject = vi.fn();
    const setCurrentProject = vi.fn();
    const usePM = {
        teamProjects: [project(7), project(2)],
        currentProject: project(currentProjectId),
        openProject,
        setCurrentProject,
    } as unknown as ProjectManagementState;
    const useTM = {
        currentPreviewTaskId: -1,
        currentPreviewKind: "task",
        currentPreviewMilestoneId: -1,
        isTaskPreviewVisible: false,
        currentPreviewTask: undefined,
        setCurrentPreviewTaskId: vi.fn(),
        setCurrentPreviewMilestoneId: vi.fn(),
        setIsTaskPreviewVisible: vi.fn(),
        loadTask: vi.fn(() => Promise.resolve()),
    } as unknown as TaskManagementState;
    const wrapper = ({ children }: { children: ReactNode }) => (
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    );
    const { rerender } = renderHook(
        ({ pm }) => useTaskRouting({ usePM: pm, useTM, isActiveRoute: true }),
        { wrapper, initialProps: { pm: usePM } }
    );
    // Boot picking another project after the URL's one was matched.
    const bootMovesTo = (projectId: number) =>
        rerender({ pm: { ...usePM, currentProject: project(projectId) } });
    return { openProject, setCurrentProject, bootMovesTo };
};

describe("useTaskRouting opens the URL's project with its rows (MIP-1337)", () => {
    it("a project URL other than the open project goes through openProject", () => {
        const { openProject, setCurrentProject } = setup("/workspace/tasks/project/2", 7);
        expect(openProject).toHaveBeenCalledWith(expect.objectContaining({ projectId: 2 }));
        expect(setCurrentProject).not.toHaveBeenCalled();
    });

    it("a milestone link into another project also fetches that project's rows", () => {
        const { openProject } = setup("/workspace/tasks/project/2/milestone/3", 7);
        expect(openProject).toHaveBeenCalledWith(expect.objectContaining({ projectId: 2 }));
    });

    it("boot moving the project away while the URL's open is in flight brings it back with its rows", () => {
        // Cold-load order: the URL effect opens 2 (and holds its 100 ms "navigating from URL"
        // window), the project becomes 2, then boot's pick of 7 lands inside that window.
        vi.useFakeTimers();
        try {
            const { openProject, setCurrentProject, bootMovesTo } = setup(
                "/workspace/tasks/project/2",
                7
            );
            bootMovesTo(2);
            openProject.mockClear();
            bootMovesTo(7);
            expect(openProject).toHaveBeenCalledWith(expect.objectContaining({ projectId: 2 }));
            expect(setCurrentProject).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it("the URL's project already open: no second open, no refetch", () => {
        const { openProject, setCurrentProject } = setup("/workspace/tasks/project/2", 2);
        expect(openProject).not.toHaveBeenCalled();
        expect(setCurrentProject).not.toHaveBeenCalled();
    });
});
