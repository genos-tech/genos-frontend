/**
 * Quick status buttons (MIP-2603): which buttons a status offers, how their titles read, the
 * preview header's button and menu, and the "Quick actions" tab.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModalProjectStatuses } from "../features/tasks/components/statuses/ModalProjectStatuses";
import { QuickStatusButtons } from "../features/tasks/components/statuses/QuickStatusButtons";
import {
    actionTitle,
    pairDefaultKey,
    quickActionsFor,
} from "../features/tasks/utils/quickActions";
import {
    __resetProjectStatusActionsStore,
    refreshProjectStatusActions,
    setProjectStatusActions,
} from "../hooks/tasks/useProjectStatusActions";
import {
    __resetProjectStatusesStore,
    setProjectStatuses,
} from "../hooks/tasks/useProjectStatuses";
import { en } from "../i18n/locales/en";
import { ja } from "../i18n/locales/ja";
import { ProjectStatusAction, ProjectStatusDef } from "../types/tasks";

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../features/tasks/services/projectStatuses", () => ({
    loadProjectStatuses: vi.fn().mockResolvedValue(null),
    reorderProjectStatuses: vi.fn(),
    deleteProjectStatus: vi.fn(),
    createProjectStatus: vi.fn(),
    updateProjectStatus: vi.fn(),
    setBoardColumnsPerStatus: vi.fn(),
}));
const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
const reorder = vi.fn();
const load = vi.fn();
vi.mock("../features/tasks/services/projectStatusActions", () => ({
    loadProjectStatusActions: (...args: unknown[]) => load(...args),
    createProjectStatusAction: (...args: unknown[]) => create(...args),
    updateProjectStatusAction: (...args: unknown[]) => update(...args),
    deleteProjectStatusAction: (...args: unknown[]) => remove(...args),
    reorderProjectStatusActions: (...args: unknown[]) => reorder(...args),
}));

const status = (
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
    status(1, "Open", "Open", { builtinKey: "Open", isDefault: true, canDelete: false }),
    status(2, "Ready", "Open", { builtinKey: "In Review", canDelete: false }),
    status(3, "WIP", "WIP", { builtinKey: "WIP", isDefault: true, canDelete: false }),
    status(4, "QA", "WIP"),
    status(5, "Pending", "Pending", { builtinKey: "Pending", isDefault: true, isArchived: true }),
    status(6, "Closed", "Closed", { builtinKey: "Closed", isDefault: true, canDelete: false }),
];

let nextId = 0;
const action = (
    before: number,
    after: number,
    extra: Partial<ProjectStatusAction> = {}
): ProjectStatusAction => {
    const b = ROWS.find((r) => r.statusId === before)!;
    const a = ROWS.find((r) => r.statusId === after)!;
    return {
        actionId: (nextId += 1),
        beforeStatusId: before,
        afterStatusId: after,
        beforeKey: b.builtinKey,
        afterKey: a.builtinKey,
        title: null,
        defaultKey: pairDefaultKey(b.builtinKey, a.builtinKey),
        enabled: true,
        ...extra,
    };
};

const ACTIONS = [
    action(1, 3),
    action(2, 3),
    action(1, 2),
    action(3, 6),
    action(4, 6, { title: "Ship it" }),
    action(5, 3),
    action(6, 1),
];

/** What a project that never set up statuses is served. */
const COMPUTED: ProjectStatusAction[] = (
    [
        ["Open", "WIP"],
        ["WIP", "Closed"],
        ["Blocked", "WIP"],
        ["Closed", "Open"],
    ] as const
).map(([before, after]) => ({
    actionId: null,
    beforeStatusId: null,
    afterStatusId: null,
    beforeKey: before,
    afterKey: after,
    title: null,
    defaultKey: pairDefaultKey(before, after),
    enabled: true,
}));

const wrap = (node: React.ReactNode) => render(<CssVarsProvider>{node}</CssVarsProvider>);

const serve = (actions = ACTIONS, rows = ROWS, canAct = true) => {
    setProjectStatuses(7, { statuses: rows, canManage: true });
    setProjectStatusActions(7, { actions, canManage: true, canAct });
};

beforeEach(() => {
    __resetProjectStatusesStore();
    __resetProjectStatusActionsStore();
    load.mockReset().mockResolvedValue(null);
    create.mockReset();
    update.mockReset();
    remove.mockReset();
    reorder.mockReset();
});
afterEach(cleanup);

const picks = (current: string, id?: number, rows = ROWS, actions = ACTIONS) =>
    quickActionsFor(actions, rows, current, id).map((q) => [q.category, q.statusId]);

describe("which buttons a status offers", () => {
    it("follows the status row the item reads as, in the editor's order", () => {
        expect(picks("Open")).toEqual([
            ["WIP", 3],
            ["Open", 2],
        ]);
        expect(picks("Open", 2)).toEqual([["WIP", 3]]);
        expect(picks("WIP")).toEqual([["Closed", 6]]);
        // A custom status offers its own actions only.
        expect(picks("WIP", 4)).toEqual([["Closed", 6]]);
        expect(quickActionsFor(ACTIONS, ROWS, "WIP", 4)[0].action.title).toBe("Ship it");
        expect(picks("Closed")).toEqual([["Open", 1]]);
        expect(picks("Blocked")).toEqual([]);
    });

    it("leaves out an action that is off, or whose status is off or gone", () => {
        expect(picks("Pending")).toEqual([]);
        const off = ACTIONS.map((a) => (a.beforeStatusId === 1 ? { ...a, enabled: false } : a));
        expect(picks("Open", undefined, ROWS, off)).toEqual([]);
        const noReady = ROWS.map((r) => (r.statusId === 2 ? { ...r, isArchived: true } : r));
        expect(picks("Open", undefined, noReady)).toEqual([["WIP", 3]]);
        expect(
            picks(
                "Open",
                undefined,
                ROWS.filter((r) => r.statusId !== 2)
            )
        ).toEqual([["WIP", 3]]);
    });

    it("matches the computed defaults by system status, with or without rows", () => {
        expect(picks("Open", undefined, [], COMPUTED)).toEqual([["WIP", undefined]]);
        expect(picks("Closed", undefined, [], COMPUTED)).toEqual([["Open", undefined]]);
        expect(picks("Blocked", undefined, [], COMPUTED)).toEqual([["WIP", undefined]]);
        // Set up since the list was read: the same defaults still find their rows.
        expect(picks("Open", undefined, ROWS, COMPUTED)).toEqual([["WIP", 3]]);
    });
});

describe("titles", () => {
    it("translates a default title per viewer and kind, and shows a typed one as typed", () => {
        const [start, , , done, ship] = ACTIONS;
        expect(actionTitle(start, "task", en.tasks.preview)).toBe("Start Task");
        expect(actionTitle(start, "milestone", en.tasks.preview)).toBe("Start Milestone");
        expect(actionTitle(done, "task", ja.tasks.preview)).toBe(ja.tasks.preview.completeTask);
        expect(actionTitle(ship, "milestone", ja.tasks.preview)).toBe("Ship it");
    });
});

describe("the header button", () => {
    const buttons = (current: string, onPick = vi.fn(), id?: number) => {
        wrap(
            <QuickStatusButtons
                customStatusId={id}
                kind="task"
                projectId={7}
                status={current}
                onPick={onPick}
            />
        );
        return onPick;
    };

    it("is the first action, with the others in the menu beside it", async () => {
        serve();
        const onPick = buttons("Open");
        fireEvent.click(screen.getByRole("button", { name: "Start Task" }));
        expect(onPick).toHaveBeenLastCalledWith("WIP", 3);
        fireEvent.click(screen.getByRole("button", { name: "More status actions" }));
        fireEvent.click(await screen.findByRole("menuitem", { name: "Mark Ready" }));
        expect(onPick).toHaveBeenLastCalledWith("Open", 2);
    });

    it("has no menu with one action, and nothing with none", () => {
        serve();
        buttons("WIP", vi.fn(), 4);
        expect(screen.getByRole("button", { name: "Ship it" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "More status actions" })).toBeNull();
        cleanup();
        buttons("Blocked");
        expect(screen.queryByTestId("quick-status-button")).toBeNull();
    });

    it("is hidden where the person cannot change the item", () => {
        serve(ACTIONS, ROWS, false);
        buttons("Open");
        expect(screen.queryByTestId("quick-status-button")).toBeNull();
    });

    it("waits for both lists", () => {
        setProjectStatusActions(7, { actions: COMPUTED, canManage: true, canAct: true });
        buttons("Open");
        expect(screen.queryByTestId("quick-status-button")).toBeNull();
    });
});

describe("reading the list", () => {
    const button = () => (
        <QuickStatusButtons kind="task" projectId={7} status="Open" onPick={vi.fn()} />
    );

    it("tries again when a header next shows after a failed read", async () => {
        setProjectStatuses(7, { statuses: ROWS, canManage: true });
        const answer = { actions: ACTIONS, canManage: true, canAct: true };
        load.mockResolvedValueOnce(null).mockResolvedValue(answer);
        wrap(button());
        await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
        // The refused read has been put away before the next header shows.
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(screen.queryByTestId("quick-status-button")).toBeNull();
        cleanup();
        wrap(button());
        expect(await screen.findByRole("button", { name: "Start Task" })).toBeTruthy();
    });

    it("does not let a read asked before a change land on it", async () => {
        let answerOld: (value: unknown) => void = () => {};
        load.mockReturnValueOnce(new Promise((resolve) => (answerOld = resolve)));
        const reading = refreshProjectStatusActions(7, "t");
        serve();
        answerOld({ actions: [], canManage: true, canAct: true });
        await reading;
        wrap(button());
        expect(screen.getByRole("button", { name: "Start Task" })).toBeTruthy();
    });
});

describe("the Quick actions tab", () => {
    it("offers a retry, not an endless wait, when the rows cannot be read after a set-up", async () => {
        serve(COMPUTED, ROWS);
        wrap(<ModalProjectStatuses projectId={7} open onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole("tab", { name: en.tasks.quickActions.tab }));
        expect(await screen.findByText(en.tasks.quickActions.loadFailed)).toBeTruthy();
    });

    const openTab = () => {
        wrap(<ModalProjectStatuses projectId={7} open onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole("tab", { name: en.tasks.quickActions.tab }));
        return screen.getByTestId("quick-actions");
    };
    const ok = { ok: true, data: { actions: ACTIONS, canManage: true, canAct: true } };

    it("shows the defaults and offers the set-up before there are statuses", () => {
        serve(COMPUTED, []);
        const tab = openTab();
        expect(within(tab).getByText(en.tasks.quickActions.setUpHint)).toBeTruthy();
        expect(within(tab).getByText("Reopen")).toBeTruthy();
        expect(within(tab).queryByRole("switch")).toBeNull();
        expect(
            within(tab).getByRole("button", { name: en.tasks.projectStatuses.setUp })
        ).toBeTruthy();
    });

    it("lists each action, marks a typed title and one that is not shown, and turns it off", async () => {
        update.mockResolvedValue(ok);
        serve();
        const tab = openTab();
        expect(within(tab).getByText("Ship it")).toBeTruthy();
        expect(within(tab).getAllByText(en.tasks.quickActions.customTitle)).toHaveLength(1);
        expect(within(tab).getAllByText(en.tasks.quickActions.notShown)).toHaveLength(1);
        fireEvent.click(within(tab).getByRole("switch", { name: "Show Ship it" }));
        await vi.waitFor(() =>
            expect(update).toHaveBeenCalledWith(7, ACTIONS[4].actionId, { enabled: false }, "t")
        );
    });

    it("resets a typed title to the default and saves null", async () => {
        update.mockResolvedValue(ok);
        const edited = ACTIONS.map((a, i) => (i === 3 ? { ...a, title: "Done!" } : a));
        serve(edited);
        const tab = openTab();
        fireEvent.click(within(tab).getByRole("button", { name: "Done!" }));
        const input = within(tab).getByRole("textbox", {
            name: en.tasks.quickActions.titleLabel,
        });
        expect((input as HTMLInputElement).placeholder).toBe("Default: Complete Task");
        fireEvent.click(
            within(tab).getByRole("button", { name: en.tasks.quickActions.resetTitle })
        );
        fireEvent.click(within(tab).getByRole("button", { name: en.tasks.quickActions.save }));
        await vi.waitFor(() =>
            expect(update).toHaveBeenCalledWith(
                7,
                edited[3].actionId,
                { before_status_id: 3, after_status_id: 6, title: null },
                "t"
            )
        );
    });

    it("says why a save is refused and keeps the form", async () => {
        update.mockResolvedValue({ ok: false, code: "duplicate" });
        serve();
        const tab = openTab();
        fireEvent.click(within(tab).getByRole("button", { name: "Ship it" }));
        fireEvent.click(within(tab).getByRole("button", { name: en.tasks.quickActions.save }));
        expect((await within(tab).findByRole("alert")).textContent).toBe(
            en.tasks.quickActions.duplicate
        );
        expect(within(tab).getByRole("textbox")).toBeTruthy();
    });

    it("asks for a title when the pair has no default", async () => {
        serve();
        const tab = openTab();
        fireEvent.click(within(tab).getByRole("button", { name: "Ship it" }));
        fireEvent.change(within(tab).getByRole("textbox"), { target: { value: "" } });
        fireEvent.click(within(tab).getByRole("button", { name: en.tasks.quickActions.save }));
        expect((await within(tab).findByRole("alert")).textContent).toBe(
            en.tasks.quickActions.titleRequired
        );
        expect(update).not.toHaveBeenCalled();
    });

    it("moves an action from its menu", async () => {
        reorder.mockResolvedValue(ok);
        serve();
        const tab = openTab();
        fireEvent.click(
            within(tab).getAllByRole("button", { name: "More actions for Start Task" })[0]
        );
        fireEvent.click(
            await screen.findByRole("menuitem", { name: en.tasks.quickActions.moveDown })
        );
        const ids = ACTIONS.map((a) => a.actionId);
        await vi.waitFor(() =>
            expect(reorder).toHaveBeenCalledWith(7, [ids[1], ids[0], ...ids.slice(2)], "t")
        );
    });

    it("says how many quick actions a deleted status takes with it", async () => {
        serve();
        wrap(<ModalProjectStatuses projectId={7} open onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: "More actions for QA" }));
        fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText(/1 quick action uses it/)).toBeTruthy();
    });
});
