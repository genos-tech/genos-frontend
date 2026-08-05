/**
 * The sub-task block after a project move.
 *
 * Moving a milestone (or a root task) carries every task filed under it
 * into the destination project, but this block had no way to hear that.
 * The project picker switches the preview's project optimistically, so the
 * block's load effect fires under the DESTINATION project id before the
 * server has moved anything there, gets an empty list, and then has no
 * reason to run again: its deps (parent id, project id) are unchanged by
 * the move landing, and `genos:task-touched` names a single task — it
 * cannot describe which tasks travelled. The tasks were in the new project
 * and the block said there were none, through remounts, until a reload.
 *
 * `genos:tasks-bulk-changed` is emitted for both projects once the move
 * has landed, which is the signal this block needs.
 */

import { act } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskSubTasksBlock } from "../features/tasks/components/contents/base/TaskSubTasksBlock";
import { loadSpecificChildTasks } from "../features/tasks/services/loadSpecificChildTasks";
import { emitTasksBulkChanged } from "../features/tasks/services/taskEvents";
import type { TeamManagementState } from "../hooks/common/useTeamManagement";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import type { TaskProps } from "../types/tasks";

vi.mock("../context/AuthContext", () => ({
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
        </CssVarsProvider>
    );
};

describe("TaskSubTasksBlock after a project move", () => {
    beforeEach(() => {
        // Reset, not clear: each case queues its own responses, and a
        // `...Once` left unconsumed by one would answer the next one's
        // first load.
        vi.mocked(loadSpecificChildTasks).mockReset();
    });

    it("re-asks for its children when the move lands", async () => {
        const load = vi.mocked(loadSpecificChildTasks);
        load.mockResolvedValueOnce([]);
        load.mockResolvedValueOnce([childRow(701, "Wire the endpoint")]);

        renderBlock();
        await waitFor(() => expect(screen.getByText("No tasks yet")).toBeTruthy());

        await act(async () => {
            emitTasksBulkChanged(DESTINATION_PROJECT);
        });

        await waitFor(() => expect(screen.getByText("Wire the endpoint")).toBeTruthy());
        expect(load).toHaveBeenCalledTimes(2);
    });

    it("ignores a bulk change in a project it is not showing", async () => {
        const load = vi.mocked(loadSpecificChildTasks);
        load.mockResolvedValue([childRow(702, "Already here")]);

        renderBlock();
        await waitFor(() => expect(screen.getByText("Already here")).toBeTruthy());

        await act(async () => {
            emitTasksBulkChanged(DESTINATION_PROJECT + 1);
        });

        // A move emits for the source AND the destination; refetching on
        // both would double every move's network cost for no new data.
        expect(load).toHaveBeenCalledTimes(1);
    });
});
