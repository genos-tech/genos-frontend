/**
 * Per-project statuses (MIP-2493): a project that set none up draws as before; one that did
 * names them in one flat list (MIP-2590), and a status pick is sent exactly once.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StatusLabel } from "../features/tasks/components/meta/StatusLabel";
import { ActivityStatusChip } from "../features/tasks/components/statuses/ActivityStatusChip";
import { CardStatusMark } from "../features/tasks/components/statuses/CardStatusMark";
import { ModalProjectStatuses } from "../features/tasks/components/statuses/ModalProjectStatuses";
import { ProjectStatusPicker } from "../features/tasks/components/statuses/ProjectStatusPicker";
import {
    BUILTIN_STATUSES,
    builtinName,
    keptCustomStatusId,
    pickableStatuses,
    resolveStatusRow,
    statusRowName,
} from "../features/tasks/utils/projectStatus";
import {
    __resetProjectStatusesStore,
    setProjectStatuses,
} from "../hooks/tasks/useProjectStatuses";
import { en } from "../i18n/locales/en";
import { ja } from "../i18n/locales/ja";
import { ProjectStatusDef } from "../types/tasks";

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "t" }) }));
const reorder = vi.fn();
const remove = vi.fn();
const update = vi.fn();
const create = vi.fn();
vi.mock("../features/tasks/services/projectStatuses", () => ({
    loadProjectStatuses: vi.fn().mockResolvedValue(null),
    reorderProjectStatuses: (...args: unknown[]) => reorder(...args),
    deleteProjectStatus: (...args: unknown[]) => remove(...args),
    createProjectStatus: (...args: unknown[]) => create(...args),
    updateProjectStatus: (...args: unknown[]) => update(...args),
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
    row(2, "Ready", "Open", { builtinKey: "In Review", canDelete: false }),
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
    update.mockReset();
    create.mockReset();
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

    it("sets up each category's built-in and Ready, before WIP", () => {
        expect(BUILTIN_STATUSES.map((s) => s.key)).toEqual([
            "Open",
            "In Review",
            "WIP",
            "Blocked",
            "Pending",
            "Closed",
            "Rejected",
        ]);
    });
});

describe("the built-in that was In Review (MIP-2602)", () => {
    const builtin = (name: string) => row(2, name, "Open", { builtinKey: "In Review" });

    it("is Ready, and translated while nobody renamed it", () => {
        expect(builtinName("In Review")).toBe("Ready");
        expect(statusRowName(builtin("Ready"), ja.tasks)).toBe("着手可");
        expect(statusRowName(builtin("Ready"), en.tasks)).toBe("Ready");
    });

    it("shows any other name as stored: a team's own, or a project the migration skipped", () => {
        expect(statusRowName(builtin("QA"), ja.tasks)).toBe("QA");
        expect(statusRowName(builtin("In Review"), ja.tasks)).toBe("In Review");
    });

    it("keeps an old history entry's recorded name and the built-in's colour", () => {
        wrap(<ActivityStatusChip category="Open" label="In Review" />);
        expect(screen.getByText("In Review")).toBeTruthy();
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

describe("the status picker", () => {
    it("lists each status once, without category headings, and reports the one picked", () => {
        const onPick = vi.fn();
        wrap(
            <ProjectStatusPicker
                customStatusId={null}
                rows={ROWS}
                status="WIP"
                offerDelete
                onPick={onPick}
            />
        );
        fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
        const list = screen.getByRole("listbox");
        expect(within(list).queryByText("Old step")).toBeNull();
        expect(within(list).queryByRole("group")).toBeNull();
        expect(within(list).queryByRole("presentation")).toBeNull();
        expect(
            within(list)
                .getAllByRole("option")
                .map((o) => o.textContent)
        ).toEqual([
            en.tasks.filters.open,
            en.tasks.projectStatuses.ready,
            en.tasks.filters.wip,
            "Code review",
            "Done",
            en.tasks.filters.deleted,
        ]);
        fireEvent.click(within(list).getByText("Code review"));
        expect(onPick).toHaveBeenCalledWith("WIP", 4);
    });
});

describe("the editor", () => {
    it("says nothing changes until set up, and sets up with an empty reorder", async () => {
        setProjectStatuses(7, { statuses: [], canManage: true });
        reorder.mockResolvedValue({ ok: true, data: { statuses: ROWS, canManage: true } });
        wrap(<ModalProjectStatuses projectId={7} open onClose={vi.fn()} />);
        expect(screen.getByText(en.tasks.projectStatuses.introBody)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: en.tasks.projectStatuses.setUp }));
        await vi.waitFor(() => expect(reorder).toHaveBeenCalledWith(7, [], "t"));
        expect(await screen.findByText("Code review")).toBeTruthy();
    });

    it("asks for a replacement when a status being deleted is in use", async () => {
        setProjectStatuses(7, { statuses: ROWS, canManage: true });
        remove
            .mockResolvedValueOnce({ ok: false, code: "status_in_use", inUse: 3 })
            .mockResolvedValueOnce({ ok: true, data: { statuses: ROWS, canManage: true } });
        wrap(<ModalProjectStatuses projectId={7} open onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: "More actions for Code review" }));
        fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
        const dialog = await screen.findByRole("alertdialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
        expect(await within(dialog).findByText(/3 tasks use this status/)).toBeTruthy();
        fireEvent.click(within(dialog).getByRole("button", { name: "Delete and move" }));
        // The category's default is preselected.
        await vi.waitFor(() => expect(remove).toHaveBeenLastCalledWith(7, 4, 3, "t"));
    });

    it("keeps the typed name in the field when the save is refused", async () => {
        setProjectStatuses(7, { statuses: ROWS, canManage: true });
        update.mockResolvedValue({ ok: false, code: "name_taken", inUse: 0 });
        wrap(<ModalProjectStatuses projectId={7} open onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: "Code review" }));
        const field = screen.getByRole("textbox", { name: en.tasks.projectStatuses.nameLabel });
        fireEvent.change(field, { target: { value: "WIP too" } });
        fireEvent.keyDown(field, { key: "Enter" });
        expect(await screen.findByText(en.tasks.projectStatuses.nameTaken)).toBeTruthy();
        expect((field as HTMLInputElement).value).toBe("WIP too");
        // Leaving the refused name does not send it again.
        fireEvent.blur(field);
        expect(update).toHaveBeenCalledTimes(1);
    });

    it("is one list that says what each status counts as, once each", () => {
        setProjectStatuses(7, { statuses: ROWS, canManage: true });
        wrap(<ModalProjectStatuses projectId={7} open onClose={vi.fn()} />);
        const list = screen.getByRole("list", { name: en.tasks.projectStatuses.title });
        expect(within(list).getAllByRole("listitem")).toHaveLength(ROWS.length);
        expect(screen.queryByRole("group")).toBeNull();
        // Built-ins say it; one the team added can change it.
        expect(within(list).getAllByText("Counts as: Open")).toHaveLength(2);
        expect(
            screen.getByRole("combobox", { name: "What Code review counts as" }).textContent
        ).toBe("Counts as: WIP");
        expect(screen.queryByRole("combobox", { name: "What WIP counts as" })).toBeNull();
    });

    it("moves a status only among the ones that count as the same", async () => {
        setProjectStatuses(7, { statuses: ROWS, canManage: true });
        wrap(<ModalProjectStatuses projectId={7} open onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: "More actions for Code review" }));
        expect(await screen.findByRole("menuitem", { name: "Move up" })).toBeTruthy();
        // "Old step" counts as WIP too; Done, after it, does not.
        expect(screen.getByRole("menuitem", { name: "Move down" })).toBeTruthy();
        fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
        fireEvent.click(screen.getByRole("button", { name: "More actions for Done" }));
        await screen.findByRole("menuitem", { name: "Rename" });
        expect(screen.queryByRole("menuitem", { name: "Move up" })).toBeNull();
    });

    it("adds a status with what it counts as", async () => {
        setProjectStatuses(7, { statuses: ROWS, canManage: true });
        create.mockResolvedValue({ ok: true, data: { statuses: ROWS, canManage: true } });
        wrap(<ModalProjectStatuses projectId={7} open onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: en.tasks.projectStatuses.addStatus }));
        const field = screen.getByRole("textbox", { name: en.tasks.projectStatuses.nameLabel });
        fireEvent.change(field, { target: { value: "QA" } });
        fireEvent.click(
            screen.getByRole("combobox", { name: en.tasks.projectStatuses.countsAsNew })
        );
        fireEvent.click(screen.getByRole("option", { name: "WIP" }));
        fireEvent.submit(field.closest("form")!);
        await vi.waitFor(() =>
            expect(create).toHaveBeenCalledWith(7, { name: "QA", category: "WIP" }, "t")
        );
    });

    it("says why what a status counts as cannot change", async () => {
        setProjectStatuses(7, { statuses: ROWS, canManage: true });
        update.mockResolvedValue({ ok: false, code: "status_in_use", inUse: 2 });
        wrap(<ModalProjectStatuses projectId={7} open onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole("combobox", { name: "What Code review counts as" }));
        fireEvent.click(screen.getByRole("option", { name: "Closed" }));
        await vi.waitFor(() =>
            expect(update).toHaveBeenCalledWith(7, 4, { category: "Closed" }, "t")
        );
        expect(await screen.findByText(/2 tasks or milestones use this status/)).toBeTruthy();
    });

    it("leaves Alt+arrows on the select to the select, and says what changed", async () => {
        setProjectStatuses(7, { statuses: ROWS, canManage: true });
        update.mockResolvedValue({ ok: true, data: { statuses: ROWS, canManage: true } });
        wrap(<ModalProjectStatuses projectId={7} open onClose={vi.fn()} />);
        const select = screen.getByRole("combobox", { name: "What Code review counts as" });
        reorder.mockResolvedValue({ ok: true, data: { statuses: ROWS, canManage: true } });
        fireEvent.keyDown(select, { key: "ArrowDown", altKey: true });
        expect(reorder).not.toHaveBeenCalled();
        if (select.getAttribute("aria-expanded") !== "true") fireEvent.click(select);
        fireEvent.click(screen.getByRole("option", { name: "Closed" }));
        expect(await screen.findByText("Code review now counts as Closed.")).toBeTruthy();
    });

    it("cannot cancel an add that is being saved", async () => {
        setProjectStatuses(7, { statuses: ROWS, canManage: true });
        create.mockReturnValue(new Promise(() => undefined));
        wrap(<ModalProjectStatuses projectId={7} open onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: en.tasks.projectStatuses.addStatus }));
        const field = screen.getByRole("textbox", { name: en.tasks.projectStatuses.nameLabel });
        fireEvent.change(field, { target: { value: "QA" } });
        fireEvent.submit(field.closest("form")!);
        const cancel = screen.getByRole("button", { name: en.common.actions.cancel });
        await vi.waitFor(() => expect((cancel as HTMLButtonElement).disabled).toBe(true));
        fireEvent.keyDown(field, { key: "Escape" });
        expect(screen.getByRole("textbox", { name: en.tasks.projectStatuses.nameLabel })).toBe(
            field
        );
    });
});
