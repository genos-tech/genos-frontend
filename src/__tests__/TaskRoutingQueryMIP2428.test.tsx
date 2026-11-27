/**
 * MIP-2428: a fresh load of `/workspace/tasks?view=custom&dashboard=<note>` keeps the whole query
 * when the Tasks home fills in the project. It used to navigate to the bare project path, which
 * dropped `dashboard`: `view` was put back by the dashboard tab, `dashboard` by nobody, so the
 * first dashboard was selected instead of the named one.
 */
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { useDashboardTab } from "../features/tasks/components/dashboard/dashboardTab";
import { useTaskRouting } from "../features/tasks/hooks/useTaskRouting";

const TM = {
    isTaskPreviewVisible: false,
    currentPreviewKind: "task",
    currentPreviewTaskId: -1,
    currentPreviewMilestoneId: -1,
    currentPreviewTask: undefined,
};

// A cold load: the projects and the current one arrive after the first render.
const open = (entry: string, isActiveRoute = true) => {
    const openProject = vi.fn();
    const hook = renderHook(
        ({ projectId }: { projectId?: number }) => {
            useTaskRouting({
                usePM: {
                    teamProjects: projectId ? [{ projectId }] : [],
                    currentProject: projectId ? { projectId } : undefined,
                    openProject,
                } as never,
                useTM: TM as never,
                isActiveRoute,
            });
            useDashboardTab("u1");
            const { pathname, search } = useLocation();
            return pathname + search;
        },
        {
            initialProps: {} as { projectId?: number },
            wrapper: ({ children }: { children: ReactNode }) => (
                <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
            ),
        }
    );
    return {
        address: () => hook.result.current,
        projectArrives: (projectId: number) => act(() => hook.rerender({ projectId })),
    };
};

describe("the Tasks home filling in the project", () => {
    it("keeps the dashboard a link names", () => {
        const page = open("/workspace/tasks?view=custom&dashboard=2");
        page.projectArrives(1);
        expect(page.address()).toBe("/workspace/tasks/project/1?view=custom&dashboard=2");
    });

    it("keeps it on a reload of the filled-in address", () => {
        const page = open("/workspace/tasks/project/1?view=custom&dashboard=2");
        page.projectArrives(1);
        expect(page.address()).toBe("/workspace/tasks/project/1?view=custom&dashboard=2");
    });

    it("also from the address with a trailing slash", () => {
        const page = open("/workspace/tasks/?view=custom&dashboard=2");
        page.projectArrives(1);
        expect(page.address()).toBe("/workspace/tasks/project/1?view=custom&dashboard=2");
    });

    it("leaves the address alone while the Tasks home is hidden", () => {
        const page = open("/workspace/tasks?view=custom&dashboard=2", false);
        page.projectArrives(1);
        expect(page.address()).toContain("/workspace/tasks?");
        expect(page.address()).toContain("dashboard=2");
    });
});
