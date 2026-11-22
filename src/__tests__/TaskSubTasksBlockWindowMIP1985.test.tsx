/**
 * A milestone with ~800 tasks drew every direct task (about 590 rows, 8,800 DOM
 * nodes) in this 300px list, the biggest part of the page when a milestone is
 * opened (MIP-1985). From VIRTUALIZE_SUBTASKS_AT rows the list is windowed;
 * shorter lists keep the plain markup.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor } from "@testing-library/react";
import { VirtuosoMockContext } from "react-virtuoso";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    TaskSubTasksBlock,
    VIRTUALIZE_SUBTASKS_AT,
} from "../features/tasks/components/contents/base/TaskSubTasksBlock";
import { loadSpecificChildTasks } from "../features/tasks/services/loadSpecificChildTasks";
import type { TeamManagementState } from "../hooks/common/useTeamManagement";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import type { TaskProps } from "../types/tasks";

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));

vi.mock("../features/tasks/services/loadSpecificChildTasks", () => ({
    loadSpecificChildTasks: vi.fn(),
}));

// Avatars pull in presence + the team roster; the rows under test are
// unassigned and this block's contract has nothing to do with them.
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({
    AvatarWithStatus: () => null,
}));

const DESTINATION_PROJECT = 46;
const MILESTONE_BACKING_TASK = 323;

const childRow = (id: number, title: string) =>
    ({
        id,
        displayId: `PRJ-${id}`,
        title,
        status: { code: 0, status: "Open", color: "#0044c2", textColor: "white" },
        tags: [],
        project: { projectId: DESTINATION_PROJECT, projectName: "Destination" },
    }) as unknown as TaskProps;

const renderBlock = () => {
    const milestoneAsTask = {
        id: MILESTONE_BACKING_TASK,
        rootTaskId: MILESTONE_BACKING_TASK,
        title: "Ship v2",
        // Already switched to the destination by the picker, which is what
        // made the first (empty) load happen in the first place.
        project: { projectId: DESTINATION_PROJECT, projectName: "Destination" },
    } as unknown as TaskProps;

    render(
        <CssVarsProvider>
            <VirtuosoMockContext.Provider value={{ viewportHeight: 300, itemHeight: 44 }}>
                <TaskSubTasksBlock
                    currentTaskContent={milestoneAsTask}
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
                />
            </VirtuosoMockContext.Provider>
        </CssVarsProvider>
    );
};

describe("TaskSubTasksBlock windowing", () => {
    beforeEach(() => {
        vi.mocked(loadSpecificChildTasks).mockReset();
    });

    it("mounts only the rows in view for a long list", async () => {
        const rows = Array.from({ length: 600 }, (_, i) => childRow(1000 + i, `Row ${i}`));
        vi.mocked(loadSpecificChildTasks).mockResolvedValue(rows);

        renderBlock();
        await waitFor(() => expect(screen.getByText("Row 0")).toBeTruthy());

        const mounted = screen.getAllByText(/^Row \d+$/).length;
        expect(mounted).toBeGreaterThan(0);
        expect(mounted).toBeLessThan(60);
        expect(screen.queryByText("Row 599")).toBeNull();
    });

    it("keeps the plain markup (every row mounted) below the threshold", async () => {
        const rows = Array.from({ length: VIRTUALIZE_SUBTASKS_AT - 1 }, (_, i) =>
            childRow(2000 + i, `Short ${i}`)
        );
        vi.mocked(loadSpecificChildTasks).mockResolvedValue(rows);

        renderBlock();
        await waitFor(() => expect(screen.getByText("Short 0")).toBeTruthy());

        expect(screen.getAllByText(/^Short \d+$/)).toHaveLength(VIRTUALIZE_SUBTASKS_AT - 1);
    });
});
