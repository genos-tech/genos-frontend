/**
 * MIP-1230: the task table has ONE tab stop.
 *
 * MIP-1129 made every click-to-edit cell a real button, which left hundreds of
 * tab stops in the table (660 on a 47-row project). The standard grid pattern
 * fixes it: the active cell is in the Tab order, the arrows move between cells,
 * Enter / Space press the cell's own button, Escape leaves an editor for its cell,
 * Tab leaves the table.
 *
 * This renders the REAL rows (`DraggableTaskRow`, with the real drag library and
 * the real cell editors) inside the same grid wiring the table uses
 * (`useGridNavController` + `GridNavContext`). jsdom cannot judge layout or the
 * focus ring: that was checked in a real browser (see the PR).
 */
import { useState } from "react";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { PlainButton } from "../components/ui/PlainButton";
import { DraggableTaskRow } from "../features/tasks/components/table/DraggableTaskRow";
import { defaultColumns } from "../features/tasks/components/table/DraggableTaskTable";
import { TaskTableRows } from "../features/tasks/components/table/TaskTableRows";
import {
    GRID_COL_ATTR,
    GRID_HEADER_ROW,
    GRID_ROW_ATTR,
    GridNavContext,
    useGridNavController,
} from "../features/tasks/components/table/useGridNav";
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

const task = (id: number, over: Partial<TaskTableProps> = {}): TaskTableProps =>
    ({
        id: String(id),
        displayId: `PRJ-${id}`,
        title: `Task ${id}`,
        status: "Open",
        priority: "High",
        effortLevel: "Medium",
        dueDate: "2026-12-01",
        assigneeId: "u1",
        assigneeName: "Ken",
        parentTaskId: null,
        rootTaskId: id,
        projectId: 1,
        tags: [{ tagName: "ui", tagColor: "#888" }],
        isMilestone: false,
        milestoneId: null,
        sprintId: null,
        ...over,
    }) as unknown as TaskTableProps;

const useTM = {
    isTaskPreviewVisible: false,
    currentPreviewKind: "task",
    currentPreviewTaskId: -1,
    currentPreviewMilestoneId: -1,
} as unknown as TaskManagementState;

type RowSpec = { task: TaskTableProps; depth?: number; hasChildren?: boolean; isGhost?: boolean };

const Table = ({
    rows,
    rtl = false,
    onRowUpdate = vi.fn(async (t: TaskTableProps) => t),
}: {
    rows: RowSpec[];
    rtl?: boolean;
    onRowUpdate?: (task: TaskTableProps) => Promise<TaskTableProps>;
}) => {
    const { nav, gridRef } = useGridNavController();
    const [updates, setUpdates] = useState(0);
    return (
        <GridNavContext.Provider value={nav}>
            <button data-testid="before">before</button>
            <div
                ref={gridRef}
                aria-label="Tasks table"
                data-updates={updates}
                role="treegrid"
                style={{ direction: rtl ? "rtl" : "ltr" }}
            >
                <div role="row" {...{ [GRID_ROW_ATTR]: GRID_HEADER_ROW }}>
                    {columns.map((c) => (
                        // As the real header: the expand column has no header cell to stop on.
                        <div
                            key={c.field}
                            role="columnheader"
                            {...(c.field === "__expand" ? {} : { [GRID_COL_ATTR]: c.field })}
                        >
                            <PlainButton tabIndex={c.field === "__expand" ? -1 : undefined}>
                                {c.field}
                            </PlainButton>
                        </div>
                    ))}
                </div>
                <DragDropContext onDragEnd={() => {}}>
                    <Droppable droppableId="t">
                        {(provided) => (
                            <div
                                ref={provided.innerRef}
                                role="rowgroup"
                                {...provided.droppableProps}
                            >
                                {rows.map((r, index) => (
                                    <DraggableTaskRow
                                        key={r.task.id}
                                        columns={columns}
                                        customFieldDefs={[]}
                                        depth={r.depth ?? 0}
                                        expandedRows={new Set()}
                                        hasChildren={r.hasChildren ?? false}
                                        index={index}
                                        isGhost={r.isGhost}
                                        isSelected={false}
                                        mode="light"
                                        myself={me}
                                        projectTags={[]}
                                        setMyself={vi.fn()}
                                        socket={null}
                                        task={r.task}
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
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            </div>
            <button data-testid="after">after</button>
            <button data-testid="bump" onClick={() => setUpdates((n) => n + 1)} />
        </GridNavContext.Provider>
    );
};

const wrap = (node: React.ReactNode) => (
    <AvatarContextProvider
        value={{
            myself: me,
            setMyself: () => {},
            teamMemberProfiles: { u1: me },
            setTeamMemberProfiles: () => {},
            socket: null,
            useCM: {} as never,
            useUISM: {} as never,
        }}
    >
        <CssVarsProvider>
            <ThemeProvider theme={{ [THEME_ID]: createTheme() }}>{node}</ThemeProvider>
        </CssVarsProvider>
    </AvatarContextProvider>
);

const ROWS: RowSpec[] = [
    { task: task(1), hasChildren: true },
    { task: task(2), depth: 1 },
    { task: task(3), depth: 1, hasChildren: true },
    { task: task(4) },
];

const FOCUSABLE =
    'button, [role="button"], a[href], input, select, textarea, [role="combobox"], [tabindex]';
const grid = () => screen.getByRole("treegrid");
const stops = () =>
    [...grid().querySelectorAll<HTMLElement>(FOCUSABLE)].filter((e) => e.tabIndex >= 0);
const everything = () => [...grid().querySelectorAll<HTMLElement>(FOCUSABLE)];
const where = () => {
    const active = document.activeElement as HTMLElement | null;
    const cell = active?.closest(`[${GRID_COL_ATTR}]`);
    return cell
        ? `${cell.closest(`[${GRID_ROW_ATTR}]`)?.getAttribute(GRID_ROW_ATTR)}/${cell.getAttribute(GRID_COL_ATTR)}`
        : "outside";
};
const focusCell = (rowId: string, col: string) => {
    const cell = grid().querySelector<HTMLElement>(
        `[${GRID_ROW_ATTR}="${rowId}"] [${GRID_COL_ATTR}="${col}"], [${GRID_ROW_ATTR}="${rowId}"][${GRID_COL_ATTR}="${col}"]`
    )!;
    const target = cell.matches("[role=gridcell],[role=columnheader]")
        ? (cell.querySelector<HTMLElement>(FOCUSABLE) ?? cell)
        : cell;
    act(() => target.focus());
};

describe("the table has one tab stop", () => {
    it("every row and header cell is focusable, yet exactly one is in the Tab order", () => {
        render(wrap(<Table rows={ROWS} />));
        // Not vacuous: 4 rows x (buttons, editors, avatars, handles) + a header button each.
        expect(everything().length).toBeGreaterThan(40);
        expect(stops()).toHaveLength(1);
    });

    it("the stop is the first row's title, so Tab lands where the work is", () => {
        render(wrap(<Table rows={ROWS} />));
        expect(stops()[0].closest(`[${GRID_COL_ATTR}]`)?.getAttribute(GRID_COL_ATTR)).toBe(
            "title"
        );
        expect(stops()[0].closest(`[${GRID_ROW_ATTR}]`)?.getAttribute(GRID_ROW_ATTR)).toBe("1");
    });

    it("an assignee avatar is not a second stop inside the assignee cell", () => {
        render(wrap(<Table rows={ROWS} />));
        const assignee = grid().querySelector(
            `[${GRID_ROW_ATTR}="1"] [${GRID_COL_ATTR}="assigneeId"]`
        )!;
        // The cell's button is the target; the avatar inside it is inert (not a button).
        expect(assignee.querySelectorAll('[role="button"]')).toHaveLength(1);
    });

    it("Tab enters the table at the stop, and leaves after one stop (Shift+Tab comes back)", async () => {
        const user = userEvent.setup();
        render(wrap(<Table rows={ROWS} />));
        screen.getByTestId("before").focus();

        await user.tab();
        expect(where()).toBe("1/title");
        await user.tab();
        expect(document.activeElement).toBe(screen.getByTestId("after"));
        await user.tab({ shift: true });
        expect(where()).toBe("1/title");
        await user.tab({ shift: true });
        expect(document.activeElement).toBe(screen.getByTestId("before"));
    });

    it("a ghost row is inert: out of the tab order and out of the arrow keys", async () => {
        const user = userEvent.setup();
        const rows: RowSpec[] = [
            { task: task(1) },
            { task: task(2), isGhost: true },
            { task: task(3) },
        ];
        render(wrap(<Table rows={rows} />));
        const ghost = grid().querySelector("[inert]")!;
        expect(ghost).not.toBeNull();
        expect(ghost.hasAttribute(GRID_ROW_ATTR)).toBe(false);

        focusCell("1", "title");
        await user.keyboard("{ArrowDown}");
        expect(where()).toBe("3/title");
    });
});

describe("arrow keys", () => {
    it("move between cells and rows, keeping the column", async () => {
        const user = userEvent.setup();
        render(wrap(<Table rows={ROWS} />));
        focusCell("1", "title");

        await user.keyboard("{ArrowRight}");
        expect(where()).toBe("1/assigneeId");
        await user.keyboard("{ArrowDown}");
        expect(where()).toBe("2/assigneeId");
        await user.keyboard("{ArrowLeft}{ArrowLeft}");
        expect(where()).toBe("2/tags");
        await user.keyboard("{ArrowUp}{ArrowUp}");
        expect(where()).toBe(`${GRID_HEADER_ROW}/tags`);
        expect(stops()).toHaveLength(1);
        expect(stops()[0]).toBe(document.activeElement);
    });

    it("walk a row in the order the cells are drawn, nothing skipped, nothing out of place", async () => {
        const user = userEvent.setup();
        render(wrap(<Table rows={ROWS} />));
        const row = grid().querySelector(`[${GRID_ROW_ATTR}="1"]`)!;
        const drawn = [...row.querySelectorAll(`[${GRID_COL_ATTR}]`)].map((c) =>
            c.getAttribute(GRID_COL_ATTR)
        );
        // The first row has children, so it has every cell: gutter, chevron, columns.
        expect(drawn.slice(0, 5)).toEqual(["__drag", "__graph", "__add", "__expand", "id"]);

        focusCell("1", "title");
        await user.keyboard("{Home}");
        const walked = [where().split("/")[1]];
        for (let i = 1; i < drawn.length; i++) {
            await user.keyboard("{ArrowRight}");
            walked.push(where().split("/")[1]);
        }
        expect(walked).toEqual(drawn);
    });

    it("Home / End / Ctrl+Home / Ctrl+End / PageDown", async () => {
        const user = userEvent.setup();
        render(wrap(<Table rows={ROWS} />));
        focusCell("3", "title");

        await user.keyboard("{Home}");
        expect(where()).toBe("3/__drag");
        await user.keyboard("{End}");
        expect(where().startsWith("3/")).toBe(true);
        expect(where()).not.toBe("3/__drag");
        await user.keyboard("{Control>}{End}{/Control}");
        expect(where().startsWith("4/")).toBe(true);
        await user.keyboard("{Control>}{Home}{/Control}");
        expect(where().startsWith(`${GRID_HEADER_ROW}/`)).toBe(true);
        // jsdom has no layout, so a "page" is one row; the page size is unit-tested
        // in the model test and measured in the browser.
        await user.keyboard("{PageDown}");
        expect(where().startsWith("1/")).toBe(true);
    });

    it("do not scroll the page: the key is handled", async () => {
        render(wrap(<Table rows={ROWS} />));
        focusCell("1", "title");
        const event = new KeyboardEvent("keydown", {
            key: "ArrowDown",
            bubbles: true,
            cancelable: true,
        });
        act(() => {
            document.activeElement!.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(true);
    });

    it("Left and Right mirror in RTL", async () => {
        const user = userEvent.setup();
        render(wrap(<Table rows={ROWS} rtl />));
        focusCell("1", "title");
        // In RTL the next column is to the LEFT.
        await user.keyboard("{ArrowLeft}");
        expect(where()).toBe("1/assigneeId");
        await user.keyboard("{ArrowRight}");
        expect(where()).toBe("1/title");
    });

    it("leave a drag in progress to the drag library (a handled key is not ours)", () => {
        render(wrap(<Table rows={ROWS} />));
        focusCell("1", "title");
        const before = where();
        const event = new KeyboardEvent("keydown", {
            key: "ArrowDown",
            bubbles: true,
            cancelable: true,
        });
        event.preventDefault();
        act(() => {
            document.activeElement!.dispatchEvent(event);
        });
        expect(where()).toBe(before);
    });

    it("keys typed in an editor stay in the editor", async () => {
        const user = userEvent.setup();
        render(wrap(<Table rows={ROWS} />));
        focusCell("1", "title");
        await user.keyboard("{Enter}");
        const input = await screen.findByDisplayValue("Task 1");
        expect(document.activeElement).toBe(input);
        await user.keyboard("{ArrowLeft}{ArrowRight}{Home}{End}{ArrowDown}");
        expect(document.activeElement).toBe(input);
        expect(where()).toBe("1/title");
    });
});

describe("Enter / Space open the editor, Escape returns to the cell", () => {
    it("title: Enter opens, Escape closes and the keyboard is back on the title cell", async () => {
        const user = userEvent.setup();
        render(wrap(<Table rows={ROWS} />));
        focusCell("2", "title");

        await user.keyboard("{Enter}");
        expect(screen.getByDisplayValue("Task 2")).toBeTruthy();
        await user.keyboard("{Escape}");
        await waitFor(() => expect(screen.queryByDisplayValue("Task 2")).toBeNull());
        await waitFor(() => expect(where()).toBe("2/title"));
        expect(stops()).toHaveLength(1);
        // And the arrows work from there.
        await user.keyboard("{ArrowDown}");
        expect(where()).toBe("3/title");
    });

    it("due date: Space opens, Enter commits and returns to the cell", async () => {
        const user = userEvent.setup();
        render(wrap(<Table rows={ROWS} />));
        focusCell("1", "dueDate");

        await user.keyboard(" ");
        expect(screen.getByLabelText("Due Date")).toBeTruthy();
        await user.keyboard("{Enter}");
        await waitFor(() => expect(screen.queryByLabelText("Due Date")).toBeNull());
        await waitFor(() => expect(where()).toBe("1/dueDate"));
    });

    it.each([
        ["status", "Open"],
        ["priority", "High"],
    ])(
        "%s: Enter opens the list with focus in it, arrows and Enter pick, the cell gets focus back",
        async (col, current) => {
            const user = userEvent.setup();
            const onRowUpdate = vi.fn(async (t: TaskTableProps) => t);
            render(wrap(<Table rows={ROWS} onRowUpdate={onRowUpdate} />));
            focusCell("1", col);

            await user.keyboard("{Enter}");
            // The editor mounts where the button was: focus must be IN the open select,
            // or the arrows below would do nothing.
            const listbox = await screen.findByRole("listbox");
            expect(
                listbox.contains(document.activeElement) ||
                    !!document.activeElement?.closest("[role=combobox]")
            ).toBe(true);
            await user.keyboard("{ArrowDown}");
            await user.keyboard("{Enter}");

            await waitFor(() => expect(onRowUpdate).toHaveBeenCalledTimes(1));
            const updated = onRowUpdate.mock.calls[0][0] as unknown as Record<string, string>;
            expect(updated[col]).not.toBe(current);
            await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
            await waitFor(() => expect(where()).toBe(`1/${col}`));
            expect(stops()).toHaveLength(1);
        }
    );

    it("a mouse blur does not pull focus back to the cell", async () => {
        const user = userEvent.setup();
        render(wrap(<Table rows={ROWS} />));
        focusCell("2", "title");
        await user.keyboard("{Enter}");
        const input = await screen.findByDisplayValue("Task 2");
        // The user clicks away (a pointer interaction), so the editor closes and
        // focus stays wherever the click put it.
        await user.pointer({ keys: "[MouseLeft]", target: screen.getByTestId("after") });
        await waitFor(() => expect(input.isConnected).toBe(false));
        expect(document.activeElement).toBe(screen.getByTestId("after"));
    });
});

describe("the active cell survives", () => {
    it("a re-render of the table or of a row keeps the cell", async () => {
        const user = userEvent.setup();
        const { rerender } = render(wrap(<Table rows={ROWS} />));
        focusCell("3", "assigneeId");
        await user.click(screen.getByTestId("bump"));
        screen.getByTestId("before").focus();
        expect(stops()).toHaveLength(1);
        expect(stops()[0].closest(`[${GRID_ROW_ATTR}]`)?.getAttribute(GRID_ROW_ATTR)).toBe("3");

        // A row's task changes (an edit arrives): a new object, same id.
        const edited = ROWS.map((r, i) =>
            i === 2 ? { ...r, task: task(3, { title: "Renamed" }) } : r
        );
        rerender(wrap(<Table rows={edited} />));
        await screen.findByText("Renamed");
        expect(stops()).toHaveLength(1);
        expect(stops()[0].closest(`[${GRID_ROW_ATTR}]`)?.getAttribute(GRID_ROW_ATTR)).toBe("3");
        expect(stops()[0].closest(`[${GRID_COL_ATTR}]`)?.getAttribute(GRID_COL_ATTR)).toBe(
            "assigneeId"
        );
    });

    it("when the row disappears (a filter) the stop moves to the nearest row, in the same column", async () => {
        const { rerender } = render(wrap(<Table rows={ROWS} />));
        focusCell("3", "priority");
        screen.getByTestId("before").focus();

        // Row 3 is filtered out: the row now at its position is task 4.
        rerender(wrap(<Table rows={ROWS.filter((r) => r.task.id !== "3")} />));
        await waitFor(() => {
            const [only] = stops();
            expect(only.closest(`[${GRID_ROW_ATTR}]`)?.getAttribute(GRID_ROW_ATTR)).toBe("4");
        });
        expect(stops()).toHaveLength(1);
        expect(stops()[0].closest(`[${GRID_COL_ATTR}]`)?.getAttribute(GRID_COL_ATTR)).toBe(
            "priority"
        );
    });

    it("new rows (a task created, a filter cleared) join the model with no extra stop", async () => {
        const { rerender } = render(wrap(<Table rows={ROWS.slice(0, 2)} />));
        rerender(wrap(<Table rows={ROWS} />));
        await waitFor(() => expect(grid().querySelectorAll(`[${GRID_ROW_ATTR}]`)).toHaveLength(5));
        expect(stops()).toHaveLength(1);
    });
});

describe("the quick-add form", () => {
    const QuickAddTable = () => {
        const { nav, gridRef } = useGridNavController();
        const [parent, setParent] = useState<string | null>(null);
        const rows = ROWS.map((r) => r.task);
        return (
            <GridNavContext.Provider value={nav}>
                <div ref={gridRef} aria-label="Tasks table" role="treegrid">
                    <div role="row" {...{ [GRID_ROW_ATTR]: GRID_HEADER_ROW }}>
                        <div role="columnheader" {...{ [GRID_COL_ATTR]: "title" }} />
                    </div>
                    <DragDropContext onDragEnd={() => {}}>
                        <Droppable droppableId="t">
                            {(provided) => (
                                <div ref={provided.innerRef} {...provided.droppableProps}>
                                    <TaskTableRows
                                        childrenByParent={new Map()}
                                        columns={columns}
                                        customFieldDefs={[]}
                                        depthMap={new Map()}
                                        displayRows={rows}
                                        expandedRows={new Set()}
                                        familyKeyByRow={new Map()}
                                        ghostIds={new Set()}
                                        mode="light"
                                        myself={me}
                                        projectTags={[]}
                                        quickAddFieldRules={null}
                                        quickAddParentId={parent}
                                        quickAddProjectTags={[]}
                                        resolveIsSelected={() => false}
                                        setMyself={vi.fn()}
                                        socket={null}
                                        sprintNamesById={new Map()}
                                        teamMembers={[me]}
                                        toggleExpand={vi.fn()}
                                        useCM={{} as never}
                                        useTEM={{} as never}
                                        useTM={useTM}
                                        useUISM={{} as never}
                                        onOpenDiagram={vi.fn()}
                                        onQuickAddChild={(t) => setParent(String(t.id))}
                                        onQuickAddClose={() => setParent(null)}
                                        onQuickAddDirtyChange={() => {}}
                                        onQuickAddSubmit={async () => {}}
                                        onRequestPreview={vi.fn()}
                                        onRowUpdate={vi.fn(async (t) => t)}
                                    />
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                </div>
            </GridNavContext.Provider>
        );
    };

    it("Enter on the + cell opens it; Escape closes it and the keyboard is back on the + cell", async () => {
        const user = userEvent.setup();
        render(wrap(<QuickAddTable />));
        focusCell("2", "__add");

        await user.keyboard("{Enter}");
        const title = await screen.findByPlaceholderText(/Type a title/);
        expect(title).toBeTruthy();
        await user.keyboard("{Escape}");
        await waitFor(() => expect(screen.queryByPlaceholderText(/Type a title/)).toBeNull());
        await waitFor(() => expect(where()).toBe("2/__add"));
    });
});
