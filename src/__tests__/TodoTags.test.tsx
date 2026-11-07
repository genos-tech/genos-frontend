// To Do tags as colour chips (MIP-759): the section header and the manage
// modal render a tag with its colour, the default stays neutral, and a
// rename onto an existing name is stopped before it reaches the server.

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModalManageTodoTags } from "../features/chat/components/todo/ModalManageTodoTags";
import { TodoCategorySection } from "../features/chat/components/todo/TodoCategorySection";
import { ChatManagementState } from "../hooks/chats/useChatManagement";
import { TeamManagementState } from "../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import { UserProps } from "../types/admin";
import { TodoCategoryProps } from "../types/chat";

vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));

const cat = (id: number, name: string, color = "#808080", textColor = "white") =>
    ({
        categoryId: id,
        name,
        color,
        textColor,
        sortOrder: id,
        tsCreatedAt: "2026-07-12T00:00:00Z",
        tsUpdatedAt: "2026-07-12T00:00:00Z",
    }) as TodoCategoryProps;

// The tag chip is neutral and carries the tag colour as a small dot beside the
// label (MIP-1122); jsdom serialises it as rgb(r, g, b), so read it back.
const borderOf = (el: HTMLElement) =>
    (el.parentElement!.querySelector('span[aria-hidden="true"]') as HTMLElement).style.background;

const renderSection = (categoryId: number | null, categories: TodoCategoryProps[]) =>
    render(
        <CssVarsProvider>
            <TodoCategorySection
                categories={categories}
                categoryId={categoryId}
                items={[]}
                localDate="2026-07-12"
                myself={{} as UserProps}
                setMyself={vi.fn()}
                socket={null}
                title={categories.find((c) => c.categoryId === categoryId)?.name ?? "General"}
                useCM={{} as unknown as ChatManagementState}
                useTEM={{} as unknown as TeamManagementState}
                useUISM={{} as unknown as UIStateManagementState}
                onAddItem={vi.fn()}
                onAddSubitem={vi.fn()}
                onCategoryCreate={vi.fn()}
                onDeleteItem={vi.fn()}
                onPatchItem={vi.fn()}
            />
        </CssVarsProvider>
    );

describe("TodoCategorySection — tag chip", () => {
    it("shows a tag's name as a chip in its colour", () => {
        renderSection(7, [cat(7, "Deep work", "#ff2323")]);
        const chip = screen.getByText("Deep work");
        // The chip is a styled span carrying the tag colour in its dot.
        expect(chip.tagName).toBe("SPAN");
        expect(borderOf(chip)).toContain("255, 35, 35");
    });

    it("uses the neutral default colour for an uncoloured tag", () => {
        renderSection(7, [cat(7, "Plain")]);
        expect(borderOf(screen.getByText("Plain"))).toContain("128, 128, 128");
    });

    it("falls back to the neutral colour when the payload has none (older API)", () => {
        renderSection(7, [{ ...cat(7, "Old"), color: undefined } as unknown as TodoCategoryProps]);
        expect(borderOf(screen.getByText("Old"))).toContain("128, 128, 128");
    });

    it("leaves the untagged General section as plain text", () => {
        renderSection(null, [cat(7, "Deep work", "#ff2323")]);
        const general = screen.getByText("General");
        expect(general.tagName).not.toBe("SPAN");
        expect(general.style.borderColor).toBe("");
    });
});

const renderModal = (
    categories: TodoCategoryProps[],
    overrides: Partial<React.ComponentProps<typeof ModalManageTodoTags>> = {}
) => {
    const props = {
        open: true,
        categories,
        onClose: vi.fn(),
        onCreate: vi.fn().mockResolvedValue(cat(99, "New")),
        onUpdate: vi.fn().mockResolvedValue(cat(1, "x")),
        onDelete: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
    render(
        <CssVarsProvider>
            <ModalManageTodoTags {...props} />
        </CssVarsProvider>
    );
    return props;
};

describe("ModalManageTodoTags", () => {
    beforeEach(() => vi.clearAllMocks());

    it("lists each tag as a coloured chip", () => {
        renderModal([cat(1, "Home", "#0044c2"), cat(2, "Work")]);
        expect(borderOf(screen.getByText("Home"))).toContain("0, 68, 194");
        expect(screen.getByText("Work")).toBeTruthy();
    });

    it("recolours a tag from the palette", async () => {
        const props = renderModal([cat(1, "Home")]);
        const row = screen.getByTestId("todo-tag-row-1");
        fireEvent.click(within(row).getAllByRole("button")[0]);
        fireEvent.click(await screen.findByText("Red"));
        await waitFor(() =>
            expect(props.onUpdate).toHaveBeenCalledWith(1, {
                color: "#ff2323",
                textColor: "white",
            })
        );
    });

    it("renames a tag", async () => {
        const props = renderModal([cat(1, "Home")]);
        fireEvent.click(screen.getByText("Home"));
        const input = screen.getByDisplayValue("Home");
        fireEvent.change(input, { target: { value: "House" } });
        fireEvent.keyDown(input, { key: "Enter" });
        await waitFor(() => expect(props.onUpdate).toHaveBeenCalledWith(1, { name: "House" }));
    });

    it("stops a rename onto another tag's name before it is sent", async () => {
        const props = renderModal([cat(1, "Home"), cat(2, "Work")]);
        fireEvent.click(screen.getByText("Home"));
        const input = screen.getByDisplayValue("Home");
        fireEvent.change(input, { target: { value: "Work" } });
        fireEvent.keyDown(input, { key: "Enter" });
        await screen.findByText(/that you do not already use/);
        expect(props.onUpdate).not.toHaveBeenCalled();
    });

    it("says so when the server refuses a change", async () => {
        const props = renderModal([cat(1, "Home")], {
            onUpdate: vi.fn().mockResolvedValue(undefined),
        });
        fireEvent.click(screen.getByText("Home"));
        const input = screen.getByDisplayValue("Home");
        fireEvent.change(input, { target: { value: "Elsewhere" } });
        fireEvent.keyDown(input, { key: "Enter" });
        await screen.findByText(/Could not save that change/);
        expect(props.onUpdate).toHaveBeenCalledTimes(1);
    });

    it("creates a tag with the chosen colour (purple by default)", async () => {
        const props = renderModal([]);
        fireEvent.change(screen.getByPlaceholderText("New tag"), { target: { value: "Errands" } });
        fireEvent.click(screen.getByText("Add"));
        await waitFor(() =>
            expect(props.onCreate).toHaveBeenCalledWith("Errands", {
                color: "#8e23ff",
                textColor: "white",
            })
        );
    });

    it("refuses a duplicate name on create", async () => {
        const props = renderModal([cat(1, "Home")]);
        fireEvent.change(screen.getByPlaceholderText("New tag"), { target: { value: "Home" } });
        fireEvent.click(screen.getByText("Add"));
        await screen.findByText(/that you do not already use/);
        expect(props.onCreate).not.toHaveBeenCalled();
    });

    it("deletes only after a second click", async () => {
        const props = renderModal([cat(1, "Home")]);
        const row = screen.getByTestId("todo-tag-row-1");
        const buttons = within(row).getAllByRole("button");
        fireEvent.click(buttons[buttons.length - 1]);
        expect(props.onDelete).not.toHaveBeenCalled();
        fireEvent.click(await screen.findByText("Delete"));
        expect(props.onDelete).toHaveBeenCalledWith(1);
    });
});
