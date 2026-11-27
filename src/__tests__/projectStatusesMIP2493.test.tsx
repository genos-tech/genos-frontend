/**
 * Per-project statuses (MIP-2493): a project that set none up draws as before; one that did
 * names and groups them, and a status pick is sent exactly once.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StatusLabel } from "../features/tasks/components/meta/StatusLabel";
import { CardStatusMark } from "../features/tasks/components/statuses/CardStatusMark";
import { GroupedStatusPicker } from "../features/tasks/components/statuses/GroupedStatusPicker";
import { ModalProjectStatuses } from "../features/tasks/components/statuses/ModalProjectStatuses";
import {
    BUILTIN_STATUSES,
    keptCustomStatusId,
    pickableStatuses,
    resolveStatusRow,
} from "../features/tasks/utils/projectStatus";
import {
    __resetProjectStatusesStore,
    setProjectStatuses,
} from "../hooks/tasks/useProjectStatuses";
import { en } from "../i18n/locales/en";
import { ProjectStatusDef } from "../types/tasks";

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "t" }) }));
const reorder = vi.fn();
const remove = vi.fn();
vi.mock("../features/tasks/services/projectStatuses", () => ({
    loadProjectStatuses: vi.fn().mockResolvedValue(null),
    reorderProjectStatuses: (...args: unknown[]) => reorder(...args),
    deleteProjectStatus: (...args: unknown[]) => remove(...args),
    createProjectStatus: vi.fn(),
    updateProjectStatus: vi.fn(),
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
    row(1, "Open", "Open", { builtinKey: "Open", isDefault: true, canDelete: false }),
    row(2, "In Review", "Open", { builtinKey: "In Review", canDelete: false }),
    row(3, "WIP", "WIP", { builtinKey: "WIP", isDefault: true, canDelete: false }),
    row(4, "Code review", "WIP", { color: "#8b5cf6" }),
    row(5, "Old step", "WIP", { isArchived: true }),
    row(6, "Done", "Closed", { builtinKey: "Closed", isDefault: true, canDelete: false }),
];

const wrap = (node: React.ReactNode) => render(<CssVarsProvider>{node}</CssVarsProvider>);

beforeEach(() => {
    __resetProjectStatusesStore();
    reorder.mockReset();
    remove.mockReset();
});
afterEach(cleanup);

describe("which status a task reads as", () => {
    it("is its own row only while the category matches, else the category's default", () => {
        expect(resolveStatusRow(ROWS, "WIP", 4)?.name).toBe("Code review");
        // Moved to Closed: the stale id is ignored.
        expect(resolveStatusRow(ROWS, "Closed", 4)?.name).toBe("Done");
        expect(resolveStatusRow(ROWS, "WIP")?.name).toBe("WIP");
        expect(resolveStatusRow([], "WIP", 4)).toBeUndefined();
        expect(resolveStatusRow(ROWS, "Deleted")).toBeUndefined();
    });

    it("offers the rows that are on, and the current one even when off", () => {
        expect(pickableStatuses(ROWS).map((r) => r.statusId)).toEqual([1, 2, 3, 4, 6]);
        expect(pickableStatuses(ROWS, 5).map((r) => r.statusId)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("drops the custom id when the category changes, and keeps it otherwise", () => {
        expect(keptCustomStatusId("WIP", "Closed", 4)).toBeNull();
        expect(keptCustomStatusId("WIP", "WIP", 4)).toBe(4);
    });

    it("sets up each category's built-in and In Review, before WIP", () => {
        expect(BUILTIN_STATUSES.map((s) => s.key)).toEqual([
            "Open",
            "In Review",
            "WIP",
            "Blocked",
            "Pending",
            "Closed",
        ]);
    });
});

describe("a chip", () => {
    it("is as before for a project with no statuses", () => {
        setProjectStatuses(7, { statuses: [], canManage: false });
        wrap(<StatusLabel customStatusId={4} projectId={7} status="WIP" />);
        expect(screen.getByText(en.tasks.filters.wip)).toBeTruthy();
    });

    it("says what the project calls the status, including a renamed default", () => {
        setProjectStatuses(7, { statuses: ROWS, canManage: false });
        wrap(
            <>
                <StatusLabel customStatusId={4} projectId={7} status="WIP" />
                <StatusLabel projectId={7} status="Closed" />
            </>
        );
        expect(screen.getByText("Code review")).toBeTruthy();
        expect(screen.getByText("Done")).toBeTruthy();
    });

    it("marks a board card only when it is not the category's default", () => {
        setProjectStatuses(7, { statuses: ROWS, canManage: false });
        wrap(<CardStatusMark customStatusId={4} projectId={7} status="WIP" />);
        expect(screen.getByTestId("card-status-mark").textContent).toBe("Code review");
        cleanup();
        wrap(<CardStatusMark projectId={7} status="WIP" />);
        expect(screen.queryByTestId("card-status-mark")).toBeNull();
    });
});

describe("the grouped picker", () => {
    it("lists the statuses under their categories and reports the one picked", () => {
        const onPick = vi.fn();
        wrap(
            <GroupedStatusPicker
                offerDelete
                customStatusId={null}
                rows={ROWS}
                status="WIP"
                onPick={onPick}
            />
        );
        fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
        const list = screen.getByRole("listbox");
        expect(within(list).queryByText("Old step")).toBeNull();
        fireEvent.click(within(list).getByText("Code review"));
        expect(onPick).toHaveBeenCalledWith("WIP", 4);
    });
});

describe("the editor", () => {
    it("says nothing changes until set up, and sets up with an empty reorder", async () => {
        setProjectStatuses(7, { statuses: [], canManage: true });
        reorder.mockResolvedValue({ ok: true, data: { statuses: ROWS, canManage: true } });
        wrap(<ModalProjectStatuses open projectId={7} onClose={vi.fn()} />);
        expect(screen.getByText(en.tasks.projectStatuses.introBody)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: en.tasks.projectStatuses.setUp }));
        expect(reorder).toHaveBeenCalledWith(7, [], "t");
        expect(await screen.findByText("Code review")).toBeTruthy();
    });

    it("asks for a replacement when a status being deleted is in use", async () => {
        setProjectStatuses(7, { statuses: ROWS, canManage: true });
        remove
            .mockResolvedValueOnce({ ok: false, code: "status_in_use", inUse: 3 })
            .mockResolvedValueOnce({ ok: true, data: { statuses: ROWS, canManage: true } });
        wrap(<ModalProjectStatuses open projectId={7} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: "More actions for Code review" }));
        fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
        const dialog = await screen.findByRole("alertdialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
        expect(await within(dialog).findByText(/3 tasks use this status/)).toBeTruthy();
        fireEvent.click(within(dialog).getByRole("button", { name: "Delete and move" }));
        // The category's default is preselected.
        await vi.waitFor(() => expect(remove).toHaveBeenLastCalledWith(7, 4, 3, "t"));
    });
});
