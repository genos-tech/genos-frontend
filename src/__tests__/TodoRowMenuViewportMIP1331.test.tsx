/**
 * MIP-1331: on a phone the to-do row menu (expand, sub-item, copy link, remind, move, task,
 * tags, new-tag field, Delete) is taller than the room under its row. Popper kept it below the
 * row and let it run off the bottom of the screen, so Delete sat under the edge and a tap on
 * it hit the new-tag field or nothing.
 *
 * jsdom lays nothing out, so this pins the two pieces of the fix: every `MenuSurface` asks
 * Popper to slide a menu into the viewport on the cross axis, and the new-tag field and its
 * add button are 44px targets on a touch screen like the rows around them. The measured
 * result (every row reachable by a real tap at 390 and 1440) is in the PR and in
 * `design/evidence/MIP-1331.md`.
 */
import { Dropdown, MenuButton } from "@mui/joy";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cssWithMediaOf } from "./utils/cssOf";

import { MENU_POPPER_MODIFIERS } from "../components/ui/menu/menuStyles";
import { MenuRow, MenuSurface } from "../components/ui/MoreMenu";
import { TodoItemMoreMenu } from "../features/chat/components/todo/TodoItemMoreMenu";

const menu = vi.hoisted(() => ({ modifiers: [] as unknown[] }));
vi.mock("@mui/joy", async (importOriginal) => {
    const real = await importOriginal<typeof import("@mui/joy")>();
    const RealMenu = real.Menu;
    return {
        ...real,
        // Records what `MenuSurface` hands to the Joy Menu (which forwards it to Popper).
        Menu: (props: React.ComponentProps<typeof RealMenu>) => {
            menu.modifiers = (props.modifiers as unknown[]) ?? [];
            return <RealMenu {...props} />;
        },
    };
});

afterEach(() => {
    cleanup();
    menu.modifiers = [];
});

const openMenu = () => {
    render(
        <CssVarsProvider>
            <TodoItemMoreMenu
                categories={[]}
                currentCategoryId={null}
                isChild={false}
                linkCopied={false}
                notesExpanded={false}
                onCopyLink={vi.fn()}
                onCreateCategory={vi.fn()}
                onCreateTask={vi.fn()}
                onDelete={vi.fn()}
                onRemindMe={vi.fn()}
                onSelectCategory={vi.fn()}
                onToggleNotes={vi.fn()}
            />
        </CssVarsProvider>
    );
    fireEvent.click(screen.getByRole("button"));
};

describe("the menu stays inside the viewport", () => {
    it("slides on the cross axis, with room to spare at the edge, still tethered", () => {
        expect(MENU_POPPER_MODIFIERS).toContainEqual({
            name: "preventOverflow",
            options: { altAxis: true, padding: 8 },
        });
    });

    it("the surface hands those modifiers to the Joy Menu (and so to Popper)", () => {
        openMenu();
        expect(menu.modifiers).toBe(MENU_POPPER_MODIFIERS);
    });
});

describe("a caller's own modifiers", () => {
    it("are added to the viewport guard, not instead of it", () => {
        const own = [{ name: "offset", options: { offset: [0, 12] } }];
        render(
            <CssVarsProvider>
                <Dropdown>
                    <MenuButton>open</MenuButton>
                    <MenuSurface modifiers={own}>
                        <MenuRow>row</MenuRow>
                    </MenuSurface>
                </Dropdown>
            </CssVarsProvider>
        );
        fireEvent.click(screen.getByRole("button"));
        expect(menu.modifiers).toEqual([...MENU_POPPER_MODIFIERS, ...own]);
    });
});

describe("the new-tag controls on a touch screen", () => {
    it("the field and its add button are 44px", () => {
        openMenu();
        const field = screen.getByPlaceholderText(/new tag/i);
        const add = field.closest("div")!.parentElement!.querySelector("button")!;
        for (const el of [field.closest("div")!, add]) {
            const css = cssWithMediaOf(el);
            expect(css, el.outerHTML.slice(0, 60)).toMatch(
                /@media \(pointer: coarse\)[^{]*\{[^}]*min-height: var\(--g-row-comfortable/
            );
        }
    });
});
