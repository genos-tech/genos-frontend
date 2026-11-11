/**
 * MIP-1280: the task table's assignee avatar must not read "?" while the
 * member profiles are still loading.
 *
 * `teamMemberProfiles` (what `UserAvatar` resolves through) fills lazily. The row
 * already prints the assignee's stored `assigneeName` next to the avatar, so that
 * name is the avatar's fallback (MIP-1244 added the prop; this uses it in the table).
 */
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { DraggableTaskRow } from "../features/tasks/components/table/DraggableTaskRow";
import { defaultColumns } from "../features/tasks/components/table/DraggableTaskTable";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import type { UserProps } from "../types/admin";
import type { TaskTableProps } from "../types/tasks";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));
vi.mock("../features/integrations/components/PrStatusCell", () => ({
    PrStatusCell: () => null,
}));

afterEach(cleanup);

const me = { userId: "u1", userName: "Ken", teamId: "t1" } as unknown as UserProps;
const columns = defaultColumns
    .filter((c) => !c.hidden)
    .map((c) => ({ ...c, width: c.width || 100 }));
const useTM = {
    isTaskPreviewVisible: false,
    currentPreviewKind: "task",
    currentPreviewTaskId: -1,
    currentPreviewMilestoneId: -1,
} as unknown as TaskManagementState;

const task = {
    id: "1",
    displayId: "PRJ-1",
    title: "Task 1",
    status: "Open",
    priority: "High",
    effortLevel: "Medium",
    dueDate: "2026-12-01",
    assigneeId: "u-dan",
    assigneeName: "Dan OConnor",
    parentTaskId: null,
    rootTaskId: 1,
    projectId: 1,
    tags: [],
    isMilestone: false,
    milestoneId: null,
    sprintId: null,
} as unknown as TaskTableProps;

const renderRow = (profiles: Record<string, UserProps>) =>
    render(
        <AvatarContextProvider
            value={{
                myself: me,
                setMyself: () => {},
                teamMemberProfiles: profiles,
                setTeamMemberProfiles: () => {},
                socket: null,
                useCM: {} as never,
                useUISM: {} as never,
            }}
        >
            <CssVarsProvider>
                <ThemeProvider theme={{ [THEME_ID]: createTheme() }}>
                    <DragDropContext onDragEnd={() => {}}>
                        <Droppable droppableId="t">
                            {(provided) => (
                                <div ref={provided.innerRef} {...provided.droppableProps}>
                                    <DraggableTaskRow
                                        columns={columns}
                                        customFieldDefs={[]}
                                        depth={0}
                                        expandedRows={new Set()}
                                        hasChildren={false}
                                        index={0}
                                        isSelected={false}
                                        mode="light"
                                        myself={me}
                                        projectTags={[]}
                                        setMyself={vi.fn()}
                                        socket={null}
                                        task={task}
                                        teamMembers={[me]}
                                        toggleExpand={vi.fn()}
                                        useCM={{} as never}
                                        useTEM={{} as never}
                                        useTM={useTM}
                                        useUISM={{} as never}
                                        onDeleteTask={vi.fn()}
                                        onOpenDiagram={vi.fn()}
                                        onQuickAddChild={vi.fn()}
                                        onRequestPreview={vi.fn()}
                                        onRowUpdate={vi.fn(async (t: TaskTableProps) => t)}
                                    />
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                </ThemeProvider>
            </CssVarsProvider>
        </AvatarContextProvider>
    );

const avatarLetters = (container: HTMLElement) =>
    Array.from(container.querySelectorAll(".MuiAvatar-root"))
        .map((el) => el.textContent)
        .join("");

describe("the task table's assignee avatar", () => {
    it("shows the stored name's initial before the member profiles load", () => {
        const { container } = renderRow({});
        expect(avatarLetters(container)).toContain("D");
        expect(avatarLetters(container)).not.toContain("?");
    });

    it("lets the live profile win once it arrives", () => {
        const { container } = renderRow({
            "u-dan": {
                userId: "u-dan",
                userName: "Zed Zane",
                userEmail: "",
                teamId: "t1",
            } as never,
        });
        expect(avatarLetters(container)).toContain("Z");
    });
});
