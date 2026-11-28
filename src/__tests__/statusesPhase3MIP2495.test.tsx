/**
 * Statuses phase 3 (MIP-2495): the board's "one column per status" option, the table's filter
 * on the project's own statuses, and the editor's switch. A project without statuses, or with
 * the option off, is as before.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { boardBuckets, boardColumns } from "../features/tasks/components/board/sprintBoardHelpers";
import { ModalProjectStatuses } from "../features/tasks/components/statuses/ModalProjectStatuses";
import { TaskFilterMenu } from "../features/tasks/components/table/TaskFilterMenu";
import { resetProjectScopes } from "../features/tasks/state/projectStatusScopeStore";
import { predefinedStatusFilters } from "../features/tasks/types/TaskTableTypes";
import { quickAddColumnId } from "../features/tasks/utils/boardStatusColumns";
import { savedFilterMatchesSelection } from "../features/tasks/utils/savedFilterPayload";
import {
    orderStatusSelection,
    pruneStatusPicks,
    restoreStatusSelection,
    splitStatusSelection,
    statusMatcher,
    statusPick,
    statusScopeLabels,
    toggleCategory,
    toggleStatus,
} from "../features/tasks/utils/statusFilter";
import {
    __resetProjectStatusesStore,
    setProjectStatuses,
} from "../hooks/tasks/useProjectStatuses";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import { en } from "../i18n/locales/en";
import { ProjectStatusDef, TaskTableProps } from "../types/tasks";

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../features/tasks/services/projectSavedFilters", () => ({
    loadProjectSavedFilters: vi.fn().mockResolvedValue([]),
    createProjectSavedFilter: vi.fn(),
    updateProjectSavedFilter: vi.fn(),
    deleteProjectSavedFilter: vi.fn(),
}));
const setBoard = vi.fn();
vi.mock("../features/tasks/services/projectStatuses", () => ({
    loadProjectStatuses: vi.fn().mockResolvedValue(null),
    reorderProjectStatuses: vi.fn(),
    deleteProjectStatus: vi.fn(),
    createProjectStatus: vi.fn(),
    updateProjectStatus: vi.fn(),
    setBoardColumnsPerStatus: (...args: unknown[]) => setBoard(...args),
}));

const row = (
    statusId: number,
    name: string,
    category: string,
    extra: Partial<ProjectStatusDef> = {}
): ProjectStatusDef => ({
    statusId,
    name,
    category,
    builtinKey: null,
    color: "",
    sortOrder: statusId,
    isDefault: false,
    isArchived: false,
    canTurnOff: true,
    canDelete: true,
    ...extra,
});

const ROWS: ProjectStatusDef[] = [
    row(1, "Open", "Open", { builtinKey: "Open", isDefault: true }),
    row(2, "In Review", "Open", { builtinKey: "In Review" }),
    row(3, "WIP", "WIP", { builtinKey: "WIP", isDefault: true }),
    row(4, "Code review", "WIP", { color: "#8b5cf6" }),
    row(5, "Old step", "WIP", { isArchived: true }),
    row(6, "Blocked", "Blocked", { builtinKey: "Blocked", isDefault: true }),
    row(7, "Parked", "Pending", { isArchived: true }),
    row(8, "Done", "Closed", { builtinKey: "Closed", isDefault: true }),
    row(9, "Rejected", "Rejected", { builtinKey: "Rejected", isDefault: true }),
];

const card = (id: string, customStatusId?: number) =>
    ({ id, customStatusId }) as unknown as TaskTableProps;
const buckets = (extra: Record<string, TaskTableProps[]> = {}) => ({
    open: [],
    wip: [],
    blocked: [],
    pending: [],
    closed: [],
    rejected: [],
    ...extra,
});
const ids = (list: TaskTableProps[] | undefined) => (list ?? []).map((t) => t.id);
const labels = (list: { label: string }[]) => list.map((f) => f.label);
const filter = (label: string) => predefinedStatusFilters.find((f) => f.label === label)!;

beforeEach(() => {
    __resetProjectStatusesStore();
    resetProjectScopes();
    localStorage.clear();
    setBoard.mockReset();
});
afterEach(cleanup);

describe("board columns per status", () => {
    it("is the category board without the option", () => {
        const byCategory = buckets({ wip: [card("a", 4)] });
        expect(boardBuckets(null, byCategory)).toBe(byCategory);
        expect(boardColumns(null, byCategory).map((c) => c.id)).toEqual([
            "open",
            "wip",
            "blocked",
            "closed",
            "pending",
        ]);
    });

    it("keeps the board's category order, with each status in the project's order", () => {
        const columns = boardColumns(ROWS, boardBuckets(ROWS, buckets()));
        // Pending has no status on: its plain column stays. Rejected shows only with cards.
        expect(columns.map((c) => c.id)).toEqual([
            "st:1",
            "st:2",
            "st:3",
            "st:4",
            "st:6",
            "st:8",
            "pending",
        ]);
        expect(columns.filter((c) => c.categoryStart).map((c) => c.id)).toEqual([
            "st:3",
            "st:6",
            "st:8",
            "pending",
        ]);
    });

    it("puts a card on its own status, else the default, and an off status shows only with cards", () => {
        const byCategory = buckets({
            // 4 belongs to WIP, so under Closed (say, a closed parent) it reads as the default.
            closed: [card("under-closed-parent", 4)],
            wip: [card("own", 4), card("none"), card("off", 5)],
            pending: [card("parked", 7), card("plain")],
            rejected: [card("no")],
        });
        const placed = boardBuckets(ROWS, byCategory);
        expect(ids(placed["st:4"])).toEqual(["own"]);
        expect(ids(placed["st:3"])).toEqual(["none"]);
        expect(ids(placed["st:5"])).toEqual(["off"]);
        expect(ids(placed["st:8"])).toEqual(["under-closed-parent"]);
        expect(ids(placed["st:7"])).toEqual(["parked"]);
        expect(ids(placed.pending)).toEqual(["plain"]);
        expect(ids(placed["st:9"])).toEqual(["no"]);
        expect(boardColumns(ROWS, placed).map((c) => c.id)).toEqual([
            "st:1",
            "st:2",
            "st:3",
            "st:4",
            "st:5",
            "st:6",
            "st:8",
            "pending",
            "st:7",
            "st:9",
        ]);
    });

    it("quick-adds into the Open default, or the plain Open column", () => {
        expect(quickAddColumnId(ROWS, "open")).toBe("st:1");
        expect(quickAddColumnId([row(1, "x", "WIP")], "open")).toBe("open");
    });
});

describe("the status filter's selection", () => {
    const start = [filter("Blocked")];

    it("matches a category or a status, a task with no status id reading as the default", () => {
        const match = statusMatcher([filter("Blocked"), statusPick(3)], ROWS)!;
        expect(match("Blocked", null)).toBe(true);
        expect(match("WIP", null)).toBe(true);
        expect(match("WIP", 4)).toBe(false);
        expect(match("Open", null)).toBe(false);
        expect(statusMatcher([filter("All")], ROWS)).toBeNull();
        expect(statusMatcher([filter("Expired")], ROWS)).toBeNull();
    });

    it("ticks a status, collapses to the category, and unticks one out of a category", () => {
        const one = toggleStatus(start, ROWS, ROWS[0]);
        expect(labels(one)).toEqual(["Blocked", "st:1"]);
        const both = toggleStatus(one, ROWS, ROWS[1]);
        expect(labels(both)).toEqual(["Blocked", "Open"]);
        expect(labels(toggleStatus(both, ROWS, ROWS[0]))).toEqual(["Blocked", "st:2"]);
        expect(labels(toggleCategory(one, ROWS, "Open"))).toEqual(["Blocked", "Open"]);
        expect(labels(toggleCategory(both, ROWS, "Open"))).toEqual(["Blocked"]);
        expect(labels(toggleStatus([statusPick(4)], ROWS, ROWS[3]))).toEqual(["All"]);
        expect(labels(toggleStatus([filter("All")], ROWS, ROWS[3]))).toEqual(["st:4"]);
    });

    it("keeps a turned-off status that tasks have when one status is unticked", () => {
        const whole = [filter("WIP")];
        expect(labels(toggleStatus(whole, ROWS, ROWS[3]))).toEqual(["st:3"]);
        expect(labels(toggleStatus(whole, ROWS, ROWS[3], new Set([5])))).toEqual(["st:3", "st:5"]);
    });

    it("names the first of the menu's order, and widens the load to a pick's category", () => {
        const selection = [filter("Expired"), statusPick(4), filter("Open")];
        expect(labels(orderStatusSelection(selection, ROWS))).toEqual(["Open", "st:4", "Expired"]);
        expect(statusScopeLabels(selection, ROWS)).toEqual(["Expired", "WIP", "Open"]);
        // Not read yet: ask for nothing rather than for everything.
        expect(statusScopeLabels([statusPick(4)], [])).toBeNull();
    });

    it("stores ids apart, restores them before the statuses are read, and prunes gone ones", () => {
        expect(splitStatusSelection([statusPick(4)])).toEqual({ status: [], statusIds: [4] });
        expect(splitStatusSelection(start)).toEqual({ status: ["Blocked"] });
        const restored = restoreStatusSelection([], [4], predefinedStatusFilters, start);
        expect(labels(restored)).toEqual(["st:4"]);
        expect(restoreStatusSelection([], undefined, predefinedStatusFilters, start)).toBe(start);
        expect(pruneStatusPicks(restored, ROWS, start)).toBe(restored);
        expect(pruneStatusPicks([statusPick(404)], ROWS, start)).toBe(start);
    });

    it("tells two saved filters apart by their statuses", () => {
        const opts = {
            predefinedStatusFilters,
            defaultStatusFilters: start,
            predefinedTagsFilters: [],
            predefinedPriorityFilters: [filter("All")],
            predefinedEffortLevelFilters: [filter("All")],
        };
        const current = {
            status: [],
            statusIds: [4],
            tags: [],
            priorities: ["All"],
            effortLevels: ["All"],
            sprintKeys: ["all"],
            milestoneKeys: ["all"],
            memberKeys: ["__all__"],
        };
        expect(savedFilterMatchesSelection(current, current, opts)).toBe(true);
        expect(savedFilterMatchesSelection({ ...current, statusIds: [3] }, current, opts)).toBe(
            false
        );
    });
});

const PROJECT = 7;
const KEY = `taskFilters:table:${PROJECT}`;
const ensure = vi.fn();
const shown = vi.fn();
const task = (id: string, status: string, customStatusId?: number) =>
    ({ id, status, customStatusId, projectId: PROJECT, title: id }) as unknown as TaskTableProps;
const useTM = {
    allTasks: [task("wip", "WIP"), task("review", "WIP", 4), task("done", "Closed")],
    tableMilestoneFilterId: null,
    tagsRevision: 0,
    setTableMilestoneFilter: vi.fn(),
    ensureProjectStatuses: ensure,
} as unknown as TaskManagementState;

const mountBar = () =>
    render(
        <CssVarsProvider>
            <TaskFilterMenu
                filterStorageKey={KEY}
                predefinedTagsFilters={[predefinedStatusFilters[0]]}
                savedFiltersProjectId={PROJECT}
                setCurrentDisplayingTasks={shown}
                useTM={useTM}
            />
        </CssVarsProvider>
    );
const statusChip = () =>
    screen.getAllByRole("button").find((b) => /^Status/.test(b.textContent ?? ""))!;
const shownIds = () => ids(shown.mock.calls[shown.mock.calls.length - 1][0]);

describe("the filter bar", () => {
    it("filters on one of the project's statuses and remembers it", async () => {
        setProjectStatuses(PROJECT, { statuses: ROWS, canManage: false });
        mountBar();
        fireEvent.click(statusChip());
        // The default bar has the whole WIP category: unticking WIP leaves the other status.
        fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "WIP in WIP" }));
        expect(shownIds()).toContain("review");
        expect(shownIds()).not.toContain("wip");
        const stored = JSON.parse(localStorage.getItem(KEY)!);
        expect(stored.statusIds).toEqual([4]);
        expect(stored.status).toEqual(["Open", "Blocked", "Pending"]);
    });

    it("restores a stored status pick, and its category's rows are asked for", () => {
        setProjectStatuses(PROJECT, { statuses: ROWS, canManage: false });
        localStorage.setItem(KEY, JSON.stringify({ status: [], statusIds: [4] }));
        mountBar();
        expect(shownIds()).toEqual(["review"]);
        expect(statusChip().textContent).toContain("Code review");
        expect(ensure).toHaveBeenLastCalledWith(PROJECT, ["WIP"]);
    });

    it("drops a stored status the project no longer has", () => {
        setProjectStatuses(PROJECT, { statuses: ROWS, canManage: false });
        localStorage.setItem(KEY, JSON.stringify({ status: [], statusIds: [404] }));
        mountBar();
        expect(shownIds()).toEqual(["wip", "review"]);
        expect(JSON.parse(localStorage.getItem(KEY)!).statusIds).toBeUndefined();
    });

    it("keeps the flat menu for a project with no statuses", async () => {
        setProjectStatuses(PROJECT, { statuses: [], canManage: false });
        mountBar();
        fireEvent.click(statusChip());
        await screen.findByRole("menu");
        expect(screen.queryByRole("menuitemcheckbox")).toBeNull();
        expect(screen.getByRole("menuitem", { name: /Closed/ })).toBeTruthy();
    });
});

describe("the editor's board switch", () => {
    const words = en.tasks.projectStatuses;
    const mountEditor = () =>
        render(
            <CssVarsProvider>
                <ModalProjectStatuses projectId={PROJECT} open onClose={vi.fn()} />
            </CssVarsProvider>
        );

    it("is off until set, and turns on for the project", async () => {
        const payload = { statuses: ROWS, canManage: true, boardColumnsPerStatus: false };
        setProjectStatuses(PROJECT, payload);
        setBoard.mockResolvedValue({
            ok: true,
            data: { ...payload, boardColumnsPerStatus: true },
        });
        mountEditor();
        const toggle = screen.getByRole("switch", { name: words.boardColumnsTitle });
        expect((toggle as HTMLInputElement).checked).toBe(false);
        fireEvent.click(toggle);
        await waitFor(() => expect(screen.getByText(words.boardColumnsOn)).toBeTruthy());
        expect(setBoard).toHaveBeenCalledWith(PROJECT, true, "t");
        expect((toggle as HTMLInputElement).checked).toBe(true);
    });

    it("goes back when the save fails", async () => {
        setProjectStatuses(PROJECT, { statuses: ROWS, canManage: true });
        setBoard.mockResolvedValue({ ok: false, code: "", inUse: 0 });
        mountEditor();
        const toggle = screen.getByRole("switch", { name: words.boardColumnsTitle });
        fireEvent.click(toggle);
        await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(words.saveFailed));
        expect((toggle as HTMLInputElement).checked).toBe(false);
    });

    it("is not offered before the statuses are set up", () => {
        setProjectStatuses(PROJECT, { statuses: [], canManage: true });
        mountEditor();
        expect(screen.queryByRole("switch")).toBeNull();
    });
});
