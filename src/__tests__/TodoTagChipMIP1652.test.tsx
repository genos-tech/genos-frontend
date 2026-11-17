/**
 * MIP-1652: a to-do's tag can be changed from a chip on its row, and the Manage tags dialog shows
 * that a tag can be renamed.
 *
 *  - Each top-level row carries its tag as a chip ("General" when it has none). A click opens the
 *    same picker the ⋮ menu has (General, each tag, a new-tag field, Manage tags…). A subitem has
 *    no tag of its own and no chip.
 *  - On a phone the chip is on a line of its own under the title, not beside it (beside it the
 *    title was left about 75px).
 *  - Each tag in the Manage tags dialog has a pencil that starts its rename (a click on the name
 *    always did, and nothing said so).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModalManageTodoTags } from "../features/chat/components/todo/ModalManageTodoTags";
import { TodoCategorySection } from "../features/chat/components/todo/TodoCategorySection";
import { TodoItemRow } from "../features/chat/components/todo/TodoItemRow";
import { TodoTagChip } from "../features/chat/components/todo/TodoTagChip";
import { ChatManagementState } from "../hooks/chats/useChatManagement";
import { TeamManagementState } from "../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import { en } from "../i18n/locales/en";
import { UserProps } from "../types/admin";
import { TodoCategoryProps, TodoItemProps } from "../types/chat";

let isMobileViewport = false;
vi.mock("../hooks/common/useIsMobile", () => ({
    useIsMobile: () => isMobileViewport,
}));
vi.mock("../hooks/common/UrlLinkModalContext", () => ({
    useUrlLinkModal: () => ({ openModalByHref: vi.fn() }),
}));

const cat = (id: number, name: string, color = "#808080") =>
    ({
        categoryId: id,
        name,
        color,
        textColor: "white",
        sortOrder: id,
        tsCreatedAt: "2026-07-12T00:00:00Z",
        tsUpdatedAt: "2026-07-12T00:00:00Z",
    }) as TodoCategoryProps;

const CATEGORIES = [cat(1, "Home", "#0044c2"), cat(2, "Work", "#ff2323")];
const tp = en.chat.todoPane;

beforeEach(() => {
    isMobileViewport = false;
});
afterEach(cleanup);

const mountChip = (over: Partial<React.ComponentProps<typeof TodoTagChip>> = {}) => {
    const props = {
        categories: CATEGORIES,
        currentCategoryId: null as number | null,
        onSelectCategory: vi.fn(),
        onCreateCategory: vi.fn().mockResolvedValue(cat(9, "Fresh")),
        onManageTags: vi.fn(),
        ...over,
    };
    render(
        <CssVarsProvider>
            <TodoTagChip {...props} />
        </CssVarsProvider>
    );
    return props;
};

const open = (name: RegExp | string) => fireEvent.click(screen.getByRole("button", { name }));

describe("the tag chip", () => {
    it("says General for a to-do with no tag, and the tag's name when it has one", () => {
        mountChip();
        expect(screen.getByRole("button", { name: `${tp.changeTag}: General` })).toBeTruthy();
        cleanup();
        mountChip({ currentCategoryId: 2 });
        expect(screen.getByRole("button", { name: `${tp.changeTag}: Work` })).toBeTruthy();
    });

    it("falls back to General when the tag is not in the list (deleted, or not loaded yet)", () => {
        mountChip({ currentCategoryId: 404 });
        expect(screen.getByRole("button", { name: `${tp.changeTag}: General` })).toBeTruthy();
    });

    it("opens a picker with General, every tag and Manage tags…, and marks the current one", () => {
        mountChip({ currentCategoryId: 1 });
        open(/Change tag/);
        const items = screen.getAllByRole("menuitem").map((i) => i.textContent?.trim());
        expect(items).toEqual(["General", "Home", "Work", tp.tags.manageMenu]);
    });

    it("picking a tag, and picking General, report the choice", () => {
        const props = mountChip({ currentCategoryId: 1 });
        open(/Change tag/);
        fireEvent.click(screen.getByRole("menuitem", { name: "Work" }));
        expect(props.onSelectCategory).toHaveBeenLastCalledWith(2);
        open(/Change tag/);
        fireEvent.click(screen.getByRole("menuitem", { name: "General" }));
        expect(props.onSelectCategory).toHaveBeenLastCalledWith(null);
    });

    it("Manage tags… calls the opener, and is not offered without one", () => {
        const props = mountChip();
        open(/Change tag/);
        fireEvent.click(screen.getByRole("menuitem", { name: tp.tags.manageMenu }));
        expect(props.onManageTags).toHaveBeenCalledTimes(1);
        cleanup();
        mountChip({ onManageTags: undefined });
        open(/Change tag/);
        expect(screen.queryByRole("menuitem", { name: tp.tags.manageMenu })).toBeNull();
    });

    it("a new tag made in the picker is chosen at once", async () => {
        const props = mountChip();
        open(/Change tag/);
        fireEvent.change(screen.getByPlaceholderText(tp.newTagPlaceholder), {
            target: { value: "Fresh" },
        });
        fireEvent.click(screen.getByRole("button", { name: tp.addTag }));
        await waitFor(() => expect(props.onSelectCategory).toHaveBeenCalledWith(9));
        expect(props.onCreateCategory).toHaveBeenCalledWith("Fresh");
    });
});

const item = (over: Partial<TodoItemProps> = {}): TodoItemProps => ({
    itemId: 88,
    groupId: 1,
    categoryId: null,
    parentItemId: null,
    title: "ship the fix",
    notes: null,
    isCompleted: false,
    sortOrder: 0,
    tsCreatedAt: "2026-07-12T00:00:00Z",
    tsUpdatedAt: "2026-07-12T00:00:00Z",
    tsCompletedAt: null,
    ...over,
});

const mountRow = (
    it: TodoItemProps,
    over: Partial<React.ComponentProps<typeof TodoItemRow>> = {}
) => {
    const props = {
        categories: CATEGORIES,
        item: it,
        localDate: "2026-07-12",
        myself: {} as UserProps,
        setMyself: vi.fn(),
        socket: null,
        useCM: {} as unknown as ChatManagementState,
        useTEM: {} as unknown as TeamManagementState,
        useUISM: {} as unknown as UIStateManagementState,
        onCategoryChange: vi.fn(),
        onCategoryCreate: vi.fn(),
        onDelete: vi.fn(),
        onManageTags: vi.fn(),
        onNotesCommit: vi.fn(),
        onTitleCommit: vi.fn(),
        onToggleComplete: vi.fn(),
        ...over,
    };
    render(
        <CssVarsProvider>
            <TodoItemRow {...props} />
        </CssVarsProvider>
    );
    return props;
};

describe("a to-do row", () => {
    it("carries a tag chip, and choosing a tag changes THIS to-do's category", () => {
        const props = mountRow(item({ categoryId: 1 }));
        open(`${tp.changeTag}: Home`);
        fireEvent.click(screen.getByRole("menuitem", { name: "Work" }));
        expect(props.onCategoryChange).toHaveBeenCalledWith(88, 2);
    });

    it("hands Manage tags… on, both from the chip and from the ⋮ menu", () => {
        const props = mountRow(item());
        open(/Change tag/);
        fireEvent.click(screen.getByRole("menuitem", { name: tp.tags.manageMenu }));
        expect(props.onManageTags).toHaveBeenCalledTimes(1);
        open(tp.moreOptions);
        fireEvent.click(screen.getByRole("menuitem", { name: tp.tags.manageMenu }));
        expect(props.onManageTags).toHaveBeenCalledTimes(2);
    });

    it("a subitem has no tag chip: it follows its parent's tag", () => {
        mountRow(item({ itemId: 89, parentItemId: 88 }));
        expect(screen.queryByRole("button", { name: /Change tag/ })).toBeNull();
    });

    it("beside the title on a desktop, under it on a phone", () => {
        isMobileViewport = false;
        mountRow(item());
        const desktopChip = screen.getByRole("button", { name: /Change tag/ });
        const desktopRow = desktopChip.closest("[class*=JoyStack-root]") as HTMLElement;
        // The title is in the same row as the chip (one Stack).
        expect(within(desktopRow).getByText("ship the fix")).toBeTruthy();
        cleanup();

        isMobileViewport = true;
        mountRow(item());
        const phoneChip = screen.getByRole("button", { name: /Change tag/ });
        const phoneRow = phoneChip.closest("[class*=JoyStack-root]");
        // Its nearest Stack is NOT the title's: the chip has a line of its own.
        expect(
            phoneRow === null ||
                within(phoneRow as HTMLElement).queryByText("ship the fix") === null
        ).toBe(true);
    });
});

describe("the Manage tags dialog", () => {
    const mountModal = () => {
        const props = {
            open: true,
            categories: CATEGORIES,
            onClose: vi.fn(),
            onCreate: vi.fn().mockResolvedValue(cat(99, "New")),
            onUpdate: vi.fn().mockResolvedValue(cat(1, "x")),
            onDelete: vi.fn().mockResolvedValue(undefined),
        };
        render(
            <CssVarsProvider>
                <ModalManageTodoTags {...props} />
            </CssVarsProvider>
        );
        return props;
    };

    it("says how to rename, and has a pencil on every tag", () => {
        mountModal();
        expect(screen.getByText(tp.tags.privateHint)).toBeTruthy();
        expect(tp.tags.privateHint).toMatch(/pencil/i);
        for (const name of ["Home", "Work"]) {
            expect(
                screen.getByRole("button", { name: `${tp.tags.renameTag}: ${name}` })
            ).toBeTruthy();
        }
    });

    it("the pencil starts the rename of ITS tag, and Enter saves it", async () => {
        const props = mountModal();
        fireEvent.click(screen.getByRole("button", { name: `${tp.tags.renameTag}: Work` }));
        const input = screen.getByDisplayValue("Work");
        // Only that one is being edited.
        expect(screen.queryByDisplayValue("Home")).toBeNull();
        fireEvent.change(input, { target: { value: "Job" } });
        fireEvent.keyDown(input, { key: "Enter" });
        await waitFor(() => expect(props.onUpdate).toHaveBeenCalledWith(2, { name: "Job" }));
    });

    it("clicking the name still renames it", async () => {
        const props = mountModal();
        fireEvent.click(screen.getByText("Home"));
        const input = screen.getByDisplayValue("Home");
        fireEvent.change(input, { target: { value: "House" } });
        fireEvent.keyDown(input, { key: "Enter" });
        await waitFor(() => expect(props.onUpdate).toHaveBeenCalledWith(1, { name: "House" }));
    });
});

describe("Manage tags… is wired from the pane down to the row", () => {
    it("a section hands it to its rows", () => {
        const onManageTags = vi.fn();
        render(
            <CssVarsProvider>
                <TodoCategorySection
                    categories={CATEGORIES}
                    categoryId={null}
                    items={[item()]}
                    localDate="2026-07-12"
                    myself={{} as UserProps}
                    setMyself={vi.fn()}
                    socket={null}
                    title="General"
                    useCM={{} as unknown as ChatManagementState}
                    useTEM={{} as unknown as TeamManagementState}
                    useUISM={{} as unknown as UIStateManagementState}
                    onAddItem={vi.fn()}
                    onAddSubitem={vi.fn()}
                    onCategoryCreate={vi.fn()}
                    onDeleteItem={vi.fn()}
                    onManageTags={onManageTags}
                    onPatchItem={vi.fn()}
                />
            </CssVarsProvider>
        );
        open(/Change tag/);
        fireEvent.click(screen.getByRole("menuitem", { name: tp.tags.manageMenu }));
        expect(onManageTags).toHaveBeenCalledTimes(1);
    });

    // The day card and the pane are too heavy to mount here (a virtualised list, sockets), so
    // the two hand-overs are pinned in the source; the browser check opened the dialog from a chip.
    it("the day card passes it on, and the pane opens its dialog with it", () => {
        const here = dirname(fileURLToPath(import.meta.url));
        const src = (rel: string) => readFileSync(join(here, "..", rel), "utf8");
        expect(src("features/chat/components/todo/TodoGroupCard.tsx")).toContain(
            "onManageTags={onManageTags}"
        );
        const pane = src("features/chat/ToDoPane.tsx");
        expect(pane).toContain("onManageTags={openTagsModal}");
        expect(pane).toMatch(
            /const openTagsModal = useCallback\(\(\) => setTagsModalOpen\(true\), \[\]\)/
        );
    });
});
