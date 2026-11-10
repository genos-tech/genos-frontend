/**
 * MIP-1239: the task table's header and body have the same columns for a screen reader.
 *
 * Every body row starts with ONE gutter cell (drag, graph, +) and has one cell per column,
 * the expand chevron's among them. The header used to hide its gutter placeholder
 * (`aria-hidden`, no role), so a row announced one more column than the header, and the
 * expand column's header had no name (and a nameless, do-nothing button in it).
 *
 * The REAL table and the REAL rows are rendered (the filter menu, the column settings and the
 * network are stubs); jsdom cannot judge what a screen reader says, so the cell counts, the
 * names and the roles are what is checked here, and the announcement itself was read from the
 * browser's accessibility tree (see the PR).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { DraggableTaskTable } from "../features/tasks/components/table/DraggableTaskTable";
import { GRID_COL_ATTR, GRID_ROW_ATTR } from "../features/tasks/components/table/useGridNav";
import { en } from "../i18n/locales/en";
import type { UserProps } from "../types/admin";
import type { TaskTableProps } from "../types/tasks";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/integrations/components/PrStatusCell", () => ({
    PrStatusCell: () => null,
}));
vi.mock("../features/tasks/components/table/TaskFilterMenu", async () => {
    const React = await import("react");
    return {
        TaskFilterMenu: ({
            useTM,
            setCurrentDisplayingTasks,
        }: {
            useTM: { allTasks: TaskTableProps[] };
            setCurrentDisplayingTasks: (rows: TaskTableProps[]) => void;
        }) => {
            React.useEffect(() => {
                setCurrentDisplayingTasks(useTM.allTasks);
            }, [useTM.allTasks, setCurrentDisplayingTasks]);
            return null;
        },
    };
});
vi.mock("../features/tasks/components/table/TaskTableColumnSettings", () => ({
    TaskTableColumnSettings: () => null,
}));
vi.mock("../features/tasks/diagram/components/LazyTaskDiagram", () => ({
    LazyTaskDiagram: () => null,
}));
vi.mock("../hooks/tasks/useProjectCustomFields", () => ({
    useProjectCustomFields: () => ({ fields: [] }),
}));
vi.mock("../features/admin/services/popTeamMembers", () => ({
    popTeamMembers: vi.fn().mockResolvedValue([]),
}));

const me = { userId: "u1", userName: "Ken", teamId: "t1" } as unknown as UserProps;

const row = (id: string, extra: Partial<TaskTableProps> = {}): TaskTableProps =>
    ({
        id,
        displayId: `KDS-${id}`,
        title: `Task ${id}`,
        status: "Open",
        priority: "Medium",
        effortLevel: "Medium",
        dueDate: "",
        projectId: 1,
        parentTaskId: null,
        rootTaskId: Number(id),
        milestoneId: null,
        sprintId: null,
        isMilestone: false,
        assigneeId: "u1",
        tags: [],
        ...extra,
    }) as unknown as TaskTableProps;

// A parent with a child (an expand chevron) and a leaf (none): the cells must line up for both.
const ROWS = [row("42"), row("43", { parentTaskId: "42" }), row("44")];

const renderTable = async () => {
    const useTM = {
        allTasks: ROWS,
        setAllTasks: vi.fn(),
        tableMilestoneFilterId: null,
        currentPreviewTaskId: -1,
        currentPreviewMilestoneId: -1,
        currentPreviewKind: "task",
        currentPreviewTask: null,
        setCurrentPreviewTask: vi.fn(),
        syncPreviewEdit: vi.fn(),
        isLoadingTasks: false,
        isTaskPreviewVisible: false,
    };
    render(
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
                <ThemeProvider theme={{ [THEME_ID]: createTheme() }}>
                    <DraggableTaskTable
                        myself={me}
                        setMyself={vi.fn()}
                        setTeamMembers={vi.fn()}
                        socket={null}
                        teamMembers={[me]}
                        useCM={{} as never}
                        usePM={{ currentProject: { projectId: 1, projectTags: [] } } as never}
                        useSM={{ projectSprints: {} } as never}
                        useTEM={{} as never}
                        useTM={useTM as never}
                        useUISM={{} as never}
                    />
                </ThemeProvider>
            </CssVarsProvider>
        </AvatarContextProvider>
    );
    await waitFor(() => expect(screen.getAllByRole("row").length).toBeGreaterThan(2));
};

const nameOf = (el: Element) =>
    el.getAttribute("aria-label")?.trim() || el.textContent?.trim() || "";

describe("the task table header matches the body, column for column", () => {
    it("every body row has exactly as many cells as the header has column headers", async () => {
        await renderTable();
        const headers = screen.getAllByRole("columnheader");
        const bodyRows = screen
            .getAllByRole("row")
            .filter(
                (r) =>
                    r.getAttribute(GRID_ROW_ATTR) !== "header" &&
                    r.querySelector("[role=gridcell]")
            );
        expect(bodyRows.length).toBeGreaterThanOrEqual(2);
        for (const r of bodyRows) {
            expect(within(r).getAllByRole("gridcell")).toHaveLength(headers.length);
        }
    });

    it("the gutter has a header cell with a name; it is not a place to stop", async () => {
        await renderTable();
        const [gutter] = screen.getAllByRole("columnheader");
        expect(gutter.getAttribute("aria-label")).toBe(en.tasks.table.rowActionsHeader);
        expect(gutter.hasAttribute(GRID_COL_ATTR)).toBe(false);
        expect(gutter.getAttribute("aria-hidden")).toBeNull();
    });

    it("the expand column's header has a name and no button at all; no column header is nameless", async () => {
        await renderTable();
        const headers = screen.getAllByRole("columnheader");
        const expand = headers[1];
        expect(expand.getAttribute("aria-label")).toBe(en.tasks.table.expandHeader);
        // nothing to sort by: no button at all, so no nameless control to land on
        expect(expand.querySelector("button")).toBeNull();
        expect(expand.hasAttribute(GRID_COL_ATTR)).toBe(false);
        for (const h of headers) expect(nameOf(h)).not.toBe("");
    });

    it("the other headers still sort, are grid cells, and are not hidden", async () => {
        await renderTable();
        const title = screen
            .getAllByRole("columnheader")
            .find((h) => h.getAttribute(GRID_COL_ATTR) === "title");
        expect(title).toBeTruthy();
        expect(nameOf(title!)).not.toBe("");
        const button = title!.querySelector("button")!;
        expect(button.hasAttribute("disabled")).toBe(false);
        expect(button.getAttribute("aria-hidden")).toBeNull();
    });
});
