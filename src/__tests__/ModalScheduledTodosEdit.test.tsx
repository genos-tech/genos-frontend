/**
 * MIP-1047: Scheduled todos UX.
 *
 *  - the title field is the SAME input as the to-do list's (paste a link over
 *    selected text, `@` / `#` picker);
 *  - a row shows its title the way a to-do does (links clickable, chips);
 *  - an existing schedule can be EDITED, in the form at the top of the modal;
 *  - the three row actions are compact icon buttons;
 *  - deleting asks in the app's own dialog (red, like other deletes), never
 *    the browser's confirm();
 *  - inside the to-do modal the dialogs open ABOVE it (they used to open
 *    behind, at layer 1300).
 */
import { ReactNode } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentMentionCandidate } from "../features/agentQA/mentions/types";
import { ModalScheduledTodos } from "../features/chat/components/todo/ModalScheduledTodos";
import {
    TodoMentionPoolProvider,
    type TodoMentionPool,
} from "../features/chat/components/todo/titleMentions";
import { en } from "../i18n/locales/en";
import type { TodoScheduleProps } from "../types/chat";

const openModalByHref = vi.fn();
vi.mock("../hooks/common/UrlLinkModalContext", () => ({
    useUrlLinkModal: () => ({ openModalByHref }),
}));
vi.mock("../features/tasks/components/TaskMentionHoverCard", () => ({
    TaskMentionHoverCard: () => <div />,
}));

const ts = en.chat.todoPane.schedule;
const TASK_HREF = "/workspace/tasks/project/3/task/7";
const ENTITIES: AgentMentionCandidate[] = [
    {
        ref: { kind: "task", taskId: 7, label: "Fix login" },
        trigger: "#",
        key: "task:7",
        href: TASK_HREF,
        projectId: 3,
        subtitle: "GEN-7",
    },
    {
        // Contains the title above, so it still matches after "#Fix login " is
        // picked (MIP-1051).
        ref: { kind: "task", taskId: 8, label: "Fix login bug" },
        trigger: "#",
        key: "task:8",
        href: TASK_HREF,
        projectId: 3,
        subtitle: "GEN-8",
    },
];
const POOL: TodoMentionPool = {
    members: [],
    entities: ENTITIES,
    refs: ENTITIES.map((c) => c.ref),
    hrefByKey: new Map([
        ["task:7", TASK_HREF],
        ["task:8", TASK_HREF],
    ]),
    taskCardByKey: new Map(),
    refreshEntities: () => {},
};

const schedule = (over: Partial<TodoScheduleProps> = {}): TodoScheduleProps => ({
    scheduleId: 1,
    categoryId: null,
    title: "Daily standup",
    rrule: "RRULE:FREQ=DAILY",
    startDate: "2026-11-01",
    isActive: true,
    lastMaterializedDate: "2026-11-05",
    tsCreatedAt: "2026-11-01T00:00:00Z",
    tsUpdatedAt: "2026-11-01T00:00:00Z",
    ...over,
});

const wrap = (children: ReactNode) => (
    <CssVarsProvider>
        <TodoMentionPoolProvider pool={POOL}>{children}</TodoMentionPoolProvider>
    </CssVarsProvider>
);

type Handlers = {
    onAdd: ReturnType<typeof vi.fn>;
    onUpdate: ReturnType<typeof vi.fn>;
    onRemove: ReturnType<typeof vi.fn>;
};

const mount = (
    schedules: TodoScheduleProps[] = [schedule()],
    extra: Record<string, unknown> = {}
) => {
    const h: Handlers = {
        onAdd: vi.fn(async (input) => ({ ...schedule({ scheduleId: 99 }), ...input })),
        onUpdate: vi.fn(async (id: number, patch) => ({
            ...schedule({ scheduleId: id }),
            ...patch,
        })),
        onRemove: vi.fn(async () => true),
    };
    const props = {
        open: true,
        onClose: vi.fn(),
        categories: [
            { categoryId: 5, name: "Work" },
            { categoryId: 6, name: "Home" },
        ],
        schedules,
        ...h,
        ...extra,
    };
    const view = render(wrap(<ModalScheduledTodos {...(props as never)} />));
    return {
        ...h,
        props,
        rerenderWith: (next: TodoScheduleProps[]) =>
            view.rerender(
                wrap(<ModalScheduledTodos {...({ ...props, schedules: next } as never)} />)
            ),
    };
};

const titleInput = () => screen.getByPlaceholderText(ts.titlePlaceholder) as HTMLInputElement;
const rowOf = (title: string) =>
    screen.getByText(title).closest("[data-schedule-row]") as HTMLElement;

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("the title field is the to-do list's own input", () => {
    it("paste a URL over a selected word → [word](url)", () => {
        mount([]);
        fireEvent.change(titleInput(), { target: { value: "Read spec" } });
        titleInput().focus();
        titleInput().setSelectionRange(5, 9);
        fireEvent.paste(titleInput(), { clipboardData: { getData: () => "example.com" } });
        expect(titleInput().value).toBe("Read [spec](https://example.com)");
    });

    it("# opens the picker, and Enter completes the mention instead of adding", async () => {
        const { onAdd } = mount([]);
        fireEvent.change(titleInput(), { target: { value: "#Fix" } });
        expect(await screen.findByTestId("agent-mention-dropdown")).toBeInTheDocument();
        fireEvent.keyDown(titleInput(), { key: "Enter" });
        await waitFor(() => expect(titleInput().value).toBe("#Fix login "));
        expect(onAdd).not.toHaveBeenCalled();
    });

    it("Enter adds the schedule when the picker is closed", async () => {
        const { onAdd } = mount([]);
        fireEvent.change(titleInput(), { target: { value: "Water plants" } });
        await act(async () => {
            fireEvent.keyDown(titleInput(), { key: "Enter" });
        });
        expect(onAdd).toHaveBeenCalledTimes(1);
        expect(onAdd.mock.calls[0][0]).toMatchObject({ title: "Water plants" });
    });
});

describe("the @ / # menu closes (MIP-1051)", () => {
    const openMenu = async (value = "#Fix") => {
        const view = mount([]);
        titleInput().focus();
        fireEvent.change(titleInput(), { target: { value } });
        await screen.findByTestId("agent-mention-dropdown");
        return view;
    };
    const menu = () => screen.queryByTestId("agent-mention-dropdown");

    it("picking an item with the mouse closes it, even when a longer title still matches", async () => {
        await openMenu();
        // "Fix login" is a prefix of "Fix login bug": the menu used to stay up.
        fireEvent.mouseDown(screen.getByTestId("agent-mention-option-task:7"));
        await waitFor(() => expect(titleInput().value).toBe("#Fix login "));
        expect(menu()).toBeNull();
    });

    it("picking with Enter closes it too", async () => {
        await openMenu();
        fireEvent.keyDown(titleInput(), { key: "Enter" });
        await waitFor(() => expect(titleInput().value).toBe("#Fix login "));
        expect(menu()).toBeNull();
    });

    it("typing a fresh # after a pick opens the menu again", async () => {
        await openMenu();
        fireEvent.mouseDown(screen.getByTestId("agent-mention-option-task:7"));
        await waitFor(() => expect(titleInput().value).toBe("#Fix login "));
        fireEvent.change(titleInput(), { target: { value: "#Fix login #Fix" } });
        expect(await screen.findByTestId("agent-mention-dropdown")).toBeInTheDocument();
    });

    it("Escape closes the menu, and only the menu (the modal stays open)", async () => {
        const { props } = await openMenu();
        fireEvent.keyDown(titleInput(), { key: "Escape" });
        expect(menu()).toBeNull();
        expect(props.onClose).not.toHaveBeenCalled();
    });

    it("clicking away (the field loses focus) closes it; coming back shows it again", async () => {
        await openMenu();
        act(() => titleInput().blur());
        expect(menu()).toBeNull();
        // Back in the field with the caret still inside the token.
        act(() => titleInput().focus());
        expect(await screen.findByTestId("agent-mention-dropdown")).toBeInTheDocument();
    });
});

describe("a schedule row", () => {
    it("shows a link as a link, not as [word](url)", () => {
        mount([schedule({ title: "Read [spec](https://example.com)" })]);
        const link = screen.getByText("spec").closest("a") as HTMLAnchorElement;
        expect(link.getAttribute("href")).toBe("https://example.com");
        expect(screen.queryByText(/\[spec\]/)).toBeNull();
    });

    it("shows a # mention as a chip that opens its preview", () => {
        mount([schedule({ title: "Blocked by #Fix login" })]);
        fireEvent.click(screen.getByText("#Fix login"));
        expect(openModalByHref).toHaveBeenCalledWith(TASK_HREF);
    });

    it("has three compact actions, in the order Edit, Pause, Delete", () => {
        mount();
        const row = rowOf("Daily standup");
        const names = within(row)
            .getAllByRole("button")
            .map((b) => b.getAttribute("aria-label"));
        expect(names).toEqual([ts.edit, ts.pause, ts.delete]);
    });

    it("leaves a gap between the three actions (they used to touch)", () => {
        mount();
        const buttons = within(rowOf("Daily standup")).getAllByRole("button");
        // Joy's Stack spaces siblings with a margin on every child after the first.
        const marginLeft = (el: HTMLElement) => parseFloat(getComputedStyle(el).marginLeft || "0");
        expect(buttons).toHaveLength(3);
        expect(marginLeft(buttons[1])).toBeGreaterThan(0);
        expect(marginLeft(buttons[2])).toBeGreaterThan(0);
    });

    it("a paused schedule offers Resume in the same slot", () => {
        mount([schedule({ isActive: false })]);
        const names = within(rowOf("Daily standup"))
            .getAllByRole("button")
            .map((b) => b.getAttribute("aria-label"));
        expect(names).toEqual([ts.edit, ts.resume, ts.delete]);
    });
});

describe("editing a schedule", () => {
    const startEdit = (title = "Daily standup") =>
        fireEvent.click(within(rowOf(title)).getByRole("button", { name: ts.edit }));

    it("Edit loads the schedule into the form at the top, which becomes 'Edit'", () => {
        mount([schedule({ categoryId: 5 })]);
        expect(screen.getByText(ts.heading)).toBeTruthy();
        startEdit();
        expect(screen.getByText(ts.editHeading)).toBeTruthy();
        expect(titleInput().value).toBe("Daily standup");
        expect(screen.getByRole("button", { name: ts.save })).toBeTruthy();
        expect(screen.getByRole("button", { name: en.common.actions.cancel })).toBeTruthy();
        expect(screen.queryByRole("button", { name: ts.add })).toBeNull();
        // The row being edited says so.
        expect(rowOf("Daily standup").getAttribute("data-editing")).toBe("true");
    });

    it("a title with a link comes back as its raw markdown to edit", () => {
        mount([schedule({ title: "Read [spec](https://example.com)" })]);
        startEdit("spec");
        expect(titleInput().value).toBe("Read [spec](https://example.com)");
    });

    it("Save sends ONLY what changed (the title), never the start date or cursor", async () => {
        const { onUpdate } = mount();
        startEdit();
        fireEvent.change(titleInput(), { target: { value: "Daily sync" } });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: ts.save }));
        });
        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onUpdate).toHaveBeenCalledWith(1, { title: "Daily sync" });
        // Leaves edit mode: the form is the Add form again, and empty.
        expect(screen.getByText(ts.heading)).toBeTruthy();
        expect(titleInput().value).toBe("");
    });

    it("changing the tag sends only the tag", async () => {
        const { onUpdate } = mount([schedule({ categoryId: 5 })]);
        startEdit();
        fireEvent.click(screen.getByRole("combobox", { name: ts.categoryLabel }));
        fireEvent.click(await screen.findByRole("option", { name: "Home" }));
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: ts.save }));
        });
        expect(onUpdate).toHaveBeenCalledWith(1, { categoryId: 6 });
    });

    it("changing how often it repeats sends only the rule", async () => {
        const { onUpdate } = mount();
        startEdit();
        fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "2" } });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: ts.save }));
        });
        expect(onUpdate).toHaveBeenCalledTimes(1);
        const [id, patch] = onUpdate.mock.calls[0];
        expect(id).toBe(1);
        expect(Object.keys(patch)).toEqual(["rrule"]);
        expect(patch.rrule).toContain("INTERVAL=2");
    });

    it("Save with nothing changed sends nothing and leaves edit mode", async () => {
        const { onUpdate } = mount();
        startEdit();
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: ts.save }));
        });
        expect(onUpdate).not.toHaveBeenCalled();
        expect(screen.getByText(ts.heading)).toBeTruthy();
    });

    it("Cancel throws the edits away", () => {
        const { onUpdate } = mount();
        startEdit();
        fireEvent.change(titleInput(), { target: { value: "Something else" } });
        fireEvent.click(screen.getByRole("button", { name: en.common.actions.cancel }));
        expect(onUpdate).not.toHaveBeenCalled();
        expect(screen.getByText(ts.heading)).toBeTruthy();
        expect(titleInput().value).toBe("");
        expect(screen.getByText("Daily standup")).toBeTruthy();
    });

    it("a blank title cannot be saved", () => {
        mount();
        startEdit();
        fireEvent.change(titleInput(), { target: { value: "   " } });
        expect((screen.getByRole("button", { name: ts.save }) as HTMLButtonElement).disabled).toBe(
            true
        );
    });

    it("a failed save keeps the form open with the error", async () => {
        const { onUpdate } = mount();
        onUpdate.mockResolvedValueOnce(undefined);
        startEdit();
        fireEvent.change(titleInput(), { target: { value: "Daily sync" } });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: ts.save }));
        });
        expect(screen.getByText(ts.failed)).toBeTruthy();
        expect(screen.getByText(ts.editHeading)).toBeTruthy();
        expect(titleInput().value).toBe("Daily sync");
    });

    it("if the schedule being edited disappears, the form goes back to Add", () => {
        const { rerenderWith } = mount([schedule(), schedule({ scheduleId: 2, title: "Other" })]);
        startEdit();
        expect(screen.getByText(ts.editHeading)).toBeTruthy();
        rerenderWith([schedule({ scheduleId: 2, title: "Other" })]);
        expect(screen.getByText(ts.heading)).toBeTruthy();
        expect(titleInput().value).toBe("");
    });

    it("adding still works when nothing is being edited", async () => {
        const { onAdd, onUpdate } = mount([]);
        fireEvent.change(titleInput(), { target: { value: "Water plants" } });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: ts.add }));
        });
        expect(onAdd).toHaveBeenCalledTimes(1);
        expect(onUpdate).not.toHaveBeenCalled();
    });
});

describe("deleting a schedule", () => {
    const askToDelete = () =>
        fireEvent.click(within(rowOf("Daily standup")).getByRole("button", { name: ts.delete }));

    it("asks in the app's own dialog, not the browser's", () => {
        const spy = vi.spyOn(window, "confirm").mockReturnValue(true);
        const { onRemove } = mount();
        askToDelete();
        expect(spy).not.toHaveBeenCalled();
        const dialogs = screen.getAllByRole("dialog");
        const confirm = dialogs[dialogs.length - 1];
        expect(confirm.textContent).toContain(ts.deleteTitle);
        expect(confirm.textContent).toContain(ts.deleteBody);
        expect(confirm.textContent).toContain("Daily standup");
        expect(onRemove).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it("is the red, destructive style", () => {
        mount();
        askToDelete();
        const dialogs = screen.getAllByRole("dialog");
        expect(dialogs[dialogs.length - 1].getAttribute("data-tone")).toBe("danger");
    });

    it("Delete removes it; Cancel keeps it", async () => {
        const { onRemove } = mount();
        askToDelete();
        fireEvent.click(screen.getByRole("button", { name: en.common.actions.cancel }));
        expect(onRemove).not.toHaveBeenCalled();
        askToDelete();
        const dialogs = screen.getAllByRole("dialog");
        await act(async () => {
            fireEvent.click(
                within(dialogs[dialogs.length - 1]).getByRole("button", { name: ts.delete })
            );
        });
        expect(onRemove).toHaveBeenCalledTimes(1);
        expect(onRemove).toHaveBeenCalledWith(1);
    });
});

describe("a delete that fails", () => {
    it("keeps the dialog open and says so, so the schedule is not silently still there", async () => {
        const { onRemove } = mount();
        onRemove.mockResolvedValueOnce(false);
        fireEvent.click(within(rowOf("Daily standup")).getByRole("button", { name: ts.delete }));
        const dialogs = screen.getAllByRole("dialog");
        const confirm = dialogs[dialogs.length - 1];
        await act(async () => {
            fireEvent.click(within(confirm).getByRole("button", { name: ts.delete }));
        });
        const after = screen.getAllByRole("dialog");
        expect(after[after.length - 1].textContent).toContain(en.common.errors.generic);
        expect(after[after.length - 1].getAttribute("data-tone")).toBe("danger");
    });
});

describe("stacking inside the to-do modal", () => {
    const layerOf = (el: HTMLElement) =>
        Number(getComputedStyle(el.closest('[role="presentation"]') as HTMLElement).zIndex);

    it("sits above the layer it is told it is hosted at, and its delete dialog above that", () => {
        mount([schedule()], { zIndex: 10030 });
        const [schedDialog] = screen.getAllByRole("dialog");
        expect(layerOf(schedDialog)).toBe(10030);
        fireEvent.click(within(rowOf("Daily standup")).getByRole("button", { name: ts.delete }));
        const dialogs = screen.getAllByRole("dialog");
        expect(layerOf(dialogs[dialogs.length - 1])).toBeGreaterThan(10030);
    });

    it("keeps the page default when not hosted in a modal", () => {
        mount();
        const [schedDialog] = screen.getAllByRole("dialog");
        // No raised layer of its own: it keeps the theme's usual modal layer.
        const z = layerOf(schedDialog);
        expect(Number.isNaN(z) || z < 10000).toBe(true);
    });
});
