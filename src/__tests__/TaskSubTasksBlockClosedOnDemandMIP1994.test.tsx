/**
 * An 800-task milestone (20 active, 780 Closed) downloaded every Closed task to draw a 300 px
 * list (MIP-1994). The first request now carries only the active statuses; the Closed sub-tasks
 * are fetched when the user asks, and the server's count says how many there are.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VirtuosoMockContext } from "react-virtuoso";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskSubTasksBlock } from "../features/tasks/components/contents/base/TaskSubTasksBlock";
import { loadSpecificChildTasks } from "../features/tasks/services/loadSpecificChildTasks";
import type { TeamManagementState } from "../hooks/common/useTeamManagement";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import type { TaskProps } from "../types/tasks";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));

vi.mock("../features/tasks/services/loadSpecificChildTasks", async (importOriginal) => ({
    ...(await importOriginal<
        typeof import("../features/tasks/services/loadSpecificChildTasks")
    >()),
    loadSpecificChildTasks: vi.fn(),
}));

vi.mock("../components/ui/avatars/avatarWithStatus", () => ({
    AvatarWithStatus: () => null,
}));

const PROJECT = 46;
const PARENT = 323;

const row = (id: number, title: string, status: string) =>
    ({
        id,
        displayId: `PRJ-${id}`,
        title,
        status: { code: 0, status, color: "#0044c2", textColor: "white" },
        tags: [],
        project: { projectId: PROJECT, projectName: "P" },
    }) as unknown as TaskProps;

const renderBlock = () =>
    render(
        <CssVarsProvider>
            <VirtuosoMockContext.Provider value={{ viewportHeight: 300, itemHeight: 44 }}>
                <TaskSubTasksBlock
                    emptyText="No tasks yet"
                    forceLoad={true}
                    myself={{ userId: "u1" } as never}
                    SectionHeader={({ children }) => <div>{children}</div>}
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{} as never}
                    useTEM={{ teamMemberProfiles: {} } as unknown as TeamManagementState}
                    useTM={{ currentPreviewTaskId: -1 } as unknown as TaskManagementState}
                    useUISM={{} as never}
                    currentTaskContent={
                        {
                            id: PARENT,
                            rootTaskId: PARENT,
                            title: "Ship v2",
                            project: { projectId: PROJECT, projectName: "P" },
                        } as unknown as TaskProps
                    }
                />
            </VirtuosoMockContext.Provider>
        </CssVarsProvider>
    );

describe("TaskSubTasksBlock: Closed sub-tasks on demand (MIP-1994)", () => {
    beforeEach(() => {
        vi.mocked(loadSpecificChildTasks).mockReset();
    });

    it("asks only for the active statuses first, and offers the Closed count", async () => {
        vi.mocked(loadSpecificChildTasks).mockResolvedValue({
            tasks: [row(1, "Active one", "Open")],
            statusCounts: { Open: 1, Closed: 780, Deleted: 0 },
        } as never);

        renderBlock();
        await waitFor(() => expect(screen.getByText("Active one")).toBeTruthy());

        const statuses = vi.mocked(loadSpecificChildTasks).mock.calls[0][4] as string[];
        expect(statuses).toEqual(["Open", "WIP", "Blocked", "Pending"]);
        expect(screen.getByTestId("sub-tasks-show-hidden").textContent).toContain("780");
        expect(screen.queryByText("Old closed one")).toBeNull();
    });

    it("fetches the Closed ones only when asked, then shows them", async () => {
        const load = vi.mocked(loadSpecificChildTasks);
        load.mockResolvedValueOnce({
            tasks: [row(1, "Active one", "Open")],
            statusCounts: { Open: 1, Closed: 1 },
        } as never);
        load.mockResolvedValueOnce({
            tasks: [row(1, "Active one", "Open"), row(2, "Old closed one", "Closed")],
            statusCounts: { Open: 1, Closed: 1 },
        } as never);

        renderBlock();
        await waitFor(() => expect(screen.getByText("Active one")).toBeTruthy());
        expect(load).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByTestId("sub-tasks-show-hidden"));

        await waitFor(() => expect(screen.getByText("Old closed one")).toBeTruthy());
        expect(load).toHaveBeenCalledTimes(2);
        expect(load.mock.calls[1][4]).toContain("Closed");
        expect(screen.queryByTestId("sub-tasks-show-hidden")).toBeNull();
    });

    it("an older server (bare list) still works and offers no button", async () => {
        vi.mocked(loadSpecificChildTasks).mockResolvedValue([row(1, "Only", "Closed")] as never);
        renderBlock();
        await waitFor(() => expect(screen.getByText("Only")).toBeTruthy());
        expect(screen.queryByTestId("sub-tasks-show-hidden")).toBeNull();
    });

    it("says there are none only when there are no hidden ones either", async () => {
        vi.mocked(loadSpecificChildTasks).mockResolvedValue({
            tasks: [],
            statusCounts: { Closed: 5 },
        } as never);
        renderBlock();
        await waitFor(() => expect(screen.getByTestId("sub-tasks-show-hidden")).toBeTruthy());
        expect(screen.queryByText("No tasks yet")).toBeNull();
    });
});
