/**
 * MIP-1400: a task with no priority or no effort used to have no cell button, so its first
 * value could not be set from the table (92 of 98 open tasks of the big local project).
 * The empty cell is now a button with the same pick menu as a filled cell.
 *
 * jsdom cannot see layout or hover: the look (quiet at rest, the hint on hover, row height
 * 36px) was measured in a browser, see the evidence page.
 */
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { DraggableTaskRow } from "../features/tasks/components/table/DraggableTaskRow";
import { defaultColumns } from "../features/tasks/components/table/DraggableTaskTable";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import { en } from "../i18n/locales/en";
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
const base = {
    id: "1",
    displayId: "PRJ-1",
    title: "Task 1",
    status: "Open",
    parentTaskId: null,
    rootTaskId: 1,
    projectId: 1,
    tags: [],
    isMilestone: false,
    milestoneId: null,
    sprintId: null,
};

const renderRow = (over: Record<string, unknown> = {}) => {
    const onRowUpdate = vi.fn(async (t: TaskTableProps) => t);
    const tree = (task: TaskTableProps) => (
        <AvatarContextProvider
            value={{
                myself: me,
                setMyself: () => {},
                teamMemberProfiles: {},
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
                                        onOpenDiagram={vi.fn()}
                                        onQuickAddChild={vi.fn()}
                                        onRequestPreview={vi.fn()}
                                        onRowUpdate={onRowUpdate}
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
    const view = render(tree({ ...base, ...over } as unknown as TaskTableProps));
    // The same row again with new values, as when the server's answer lands.
    const update = (next: Record<string, unknown>) =>
        view.rerender(tree({ ...base, ...over, ...next } as unknown as TaskTableProps));
    return Object.assign(onRowUpdate, { update });
};

const cellOf = (col: string) => document.querySelector<HTMLElement>(`[data-grid-col="${col}"]`)!;

describe.each([
    ["priority", en.tasks.table.setPriority, "priority", /^High/],
    ["effortLevel", en.tasks.table.setEffort, "effortLevel", /^Low/],
] as const)("an empty %s cell", (col, name, field, option) => {
    it("is a button with the action's name, where a filled cell has its value", () => {
        renderRow();
        const button = within(cellOf(col)).getByRole("button", { name });
        // It is what the roving grid focuses in this cell (the cell's first focusable).
        expect(cellOf(col).querySelector("[role=button]")).toBe(button);
    });

    it("opens the pick menu on a click and sends the picked value", async () => {
        const onRowUpdate = renderRow();
        fireEvent.click(within(cellOf(col)).getByRole("button", { name }));
        fireEvent.click(screen.getByRole("option", { name: option }));
        await waitFor(() => expect(onRowUpdate).toHaveBeenCalledTimes(1));
        const sent = onRowUpdate.mock.calls[0][0] as unknown as Record<string, unknown>;
        expect(String(sent[field])).toMatch(option);
        // Only that field changed.
        expect(sent.title).toBe("Task 1");
        expect(sent.status).toBe("Open");
    });

    it("opens the pick menu from the keyboard (Enter, and Space)", () => {
        for (const key of ["Enter", " "]) {
            renderRow();
            fireEvent.keyDown(within(cellOf(col)).getByRole("button", { name }), { key });
            expect(screen.getAllByRole("option").length).toBeGreaterThan(2);
            cleanup();
        }
    });

    it("Escape closes the menu and sends nothing", async () => {
        const onRowUpdate = renderRow();
        fireEvent.click(within(cellOf(col)).getByRole("button", { name }));
        expect(screen.getAllByRole("option").length).toBeGreaterThan(2);
        fireEvent.keyDown(document, { key: "Escape" });
        await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0));
        expect(onRowUpdate).not.toHaveBeenCalled();
    });
});

describe("when the first value lands", () => {
    it("the cell keeps its button (and so the keyboard focus the grid put back on it)", () => {
        const row = renderRow();
        const before = within(cellOf("priority")).getByRole("button");
        row.update({ priority: "High" });
        const after = within(cellOf("priority")).getByRole("button");
        expect(after).toBe(before);
        expect(after.getAttribute("aria-label")).toBeNull();
        expect(after.textContent).toMatch(/High/);
    });
});

describe("a value the table does not know (legacy data)", () => {
    it("is left as it was: no cell, and no offer to overwrite it", () => {
        renderRow({ priority: "Bogus", effortLevel: "Bogus" });
        expect(cellOf("priority").querySelector("[role=button]")).toBeNull();
        expect(cellOf("effortLevel").querySelector("[role=button]")).toBeNull();
    });
});

describe("a task with values", () => {
    it("has the filled buttons and no empty-cell button", () => {
        renderRow({ priority: "High", effortLevel: "Low" });
        expect(screen.queryByRole("button", { name: en.tasks.table.setPriority })).toBeNull();
        expect(screen.queryByRole("button", { name: en.tasks.table.setEffort })).toBeNull();
        expect(within(cellOf("priority")).getByRole("button")).toBeTruthy();
        expect(within(cellOf("effortLevel")).getByRole("button")).toBeTruthy();
    });

    it("sets only the empty one: a filled priority is not offered again as empty", () => {
        renderRow({ priority: "High" });
        expect(screen.queryByRole("button", { name: en.tasks.table.setPriority })).toBeNull();
        expect(screen.getByRole("button", { name: en.tasks.table.setEffort })).toBeTruthy();
    });
});
