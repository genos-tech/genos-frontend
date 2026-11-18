/**
 * MIP-1652 (and MIP-1686, which took the chip back out): the Manage tags dialog shows that a tag
 * can be renamed, and the to-do row's ⋮ menu can open that dialog.
 *
 *  - Each tag in the dialog has a pencil that starts its rename (a click on the name always did,
 *    and nothing said so).
 *  - A to-do row has NO tag chip of its own (MIP-1652 added one beside the "Expand notes" button;
 *    it made the row look odd and was removed): the tag is set from the ⋮ menu, which also has
 *    "Manage tags…".
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModalManageTodoTags } from "../features/chat/components/todo/ModalManageTodoTags";
import { TodoCategorySection } from "../features/chat/components/todo/TodoCategorySection";
import { TodoItemRow } from "../features/chat/components/todo/TodoItemRow";
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

const open = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

describe("a to-do row", () => {
    it("has no tag chip of its own, on a desktop or on a phone", () => {
        for (const mobile of [false, true]) {
            isMobileViewport = mobile;
            mountRow(item({ categoryId: 1 }));
            // Its only menu button is the ⋮; nothing is labelled with the tag.
            expect(screen.queryByRole("button", { name: /tag/i })).toBeNull();
            expect(screen.queryByText("Home")).toBeNull();
            cleanup();
        }
    });

    it("sets the tag of THIS to-do from the ⋮ menu", () => {
        const props = mountRow(item({ categoryId: 1 }));
        open(tp.moreOptions);
        fireEvent.click(screen.getByRole("menuitem", { name: "Work" }));
        expect(props.onCategoryChange).toHaveBeenCalledWith(88, 2);
    });

    it("hands Manage tags… on from the ⋮ menu", () => {
        const props = mountRow(item());
        open(tp.moreOptions);
        fireEvent.click(screen.getByRole("menuitem", { name: tp.tags.manageMenu }));
        expect(props.onManageTags).toHaveBeenCalledTimes(1);
    });

    it("a subitem's ⋮ menu has no tag section: it follows its parent's tag", () => {
        mountRow(item({ itemId: 89, parentItemId: 88 }));
        open(tp.moreOptions);
        expect(screen.queryByRole("menuitem", { name: tp.tags.manageMenu })).toBeNull();
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
        open(tp.moreOptions);
        fireEvent.click(screen.getByRole("menuitem", { name: tp.tags.manageMenu }));
        expect(onManageTags).toHaveBeenCalledTimes(1);
    });

    // The day card and the pane are too heavy to mount here (a virtualised list, sockets), so
    // the two hand-overs are pinned in the source; the browser check opened the dialog from the ⋮ menu.
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
