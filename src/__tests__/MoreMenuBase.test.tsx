/**
 * The one menu system (MIP-1128): `MoreMenu` and the `MenuSurface` / `MenuRow`
 * parts it is built from. Pins the contract every row/overflow menu relies on.
 * jsdom has no layout, so sizes and colors are checked on the CSS the
 * components emit (token references), not on pixels.
 */

import { CssVarsProvider, Dropdown, MenuButton } from "@mui/joy";
import { cleanup, render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteModalHostZIndexProvider } from "../components/modals/noteModalHostZIndex";
import { MENU_ITEM_HEIGHT, MENU_ITEM_HEIGHT_COARSE } from "../components/ui/menu/menuStyles";
import {
    MenuDivider,
    MenuGroupLabel,
    MenuRow,
    MenuSurface,
    MoreMenu,
} from "../components/ui/MoreMenu";
import { g } from "../theme/tokens";

const render = (ui: React.ReactElement) => rtlRender(<CssVarsProvider>{ui}</CssVarsProvider>);

afterEach(cleanup);

const allCss = () =>
    Array.from(document.querySelectorAll("style"))
        .map((s) => s.textContent ?? "")
        .join("\n");

const icon = <span data-testid="icon" />;

const items = (spies: Record<string, () => void> = {}) => [
    // Written out of order on purpose: `kind` decides position (moreMenuOrder.ts).
    {
        id: "del",
        kind: "delete" as const,
        label: "Delete",
        icon,
        danger: true,
        onClick: spies.del ?? vi.fn(),
    },
    {
        id: "rename",
        kind: "rename" as const,
        label: "Rename",
        icon,
        onClick: spies.rename ?? vi.fn(),
    },
    {
        id: "link",
        kind: "copyLink" as const,
        label: "Copy link",
        icon,
        onClick: spies.link ?? vi.fn(),
    },
    { id: "hid", kind: "edit" as const, label: "Hidden", icon, visible: false, onClick: vi.fn() },
];

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByLabelText("More options"));
    return screen.findByRole("menu");
};

describe("MoreMenu", () => {
    it("lists the visible items in the shared order, danger last", async () => {
        const user = userEvent.setup();
        render(<MoreMenu items={items()} />);
        await openMenu(user);
        expect(screen.getAllByRole("menuitem").map((el) => el.textContent)).toEqual([
            "Copy link",
            "Rename",
            "Delete",
        ]);
    });

    it("puts a divider above a danger item and none above the others", async () => {
        const user = userEvent.setup();
        render(<MoreMenu items={items()} />);
        const menu = await openMenu(user);
        const rows = Array.from(menu.children);
        const seps = rows
            .map((el, i) => (el.getAttribute("role") === "separator" ? i : -1))
            .filter((i) => i >= 0);
        expect(seps).toEqual([2]);
    });

    it("fires the item and closes the menu", async () => {
        const user = userEvent.setup();
        const rename = vi.fn();
        render(<MoreMenu items={items({ rename })} />);
        await openMenu(user);
        await user.click(screen.getByRole("menuitem", { name: "Rename" }));
        expect(rename).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    });

    it("does not fire a disabled item", async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        const fn = vi.fn();
        render(
            <MoreMenu items={[{ id: "a", label: "Off", icon, disabled: true, onClick: fn }]} />
        );
        await openMenu(user);
        await user.click(screen.getByRole("menuitem", { name: "Off" }));
        expect(fn).not.toHaveBeenCalled();
    });

    it("reports open and close", async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        render(<MoreMenu items={items()} onOpenChange={onOpenChange} />);
        await openMenu(user);
        expect(onOpenChange).toHaveBeenLastCalledWith(true);
        await user.keyboard("{Escape}");
        await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(false));
    });

    it("keyboard: Arrow keys and Home/End move focus, Escape closes and returns focus to the trigger", async () => {
        const user = userEvent.setup();
        render(<MoreMenu items={items()} />);
        const trigger = screen.getByLabelText("More options");
        await openMenu(user);
        const rows = screen.getAllByRole("menuitem");
        // Opening puts focus on the first row.
        await waitFor(() => expect(document.activeElement).toBe(rows[0]));
        await user.keyboard("{ArrowDown}");
        expect(document.activeElement).toBe(rows[1]);
        await user.keyboard("{End}");
        expect(document.activeElement).toBe(rows[2]);
        await user.keyboard("{Home}");
        expect(document.activeElement).toBe(rows[0]);
        await user.keyboard("{ArrowUp}");
        expect(document.activeElement).toBe(rows[2]);
        await user.keyboard("{Escape}");
        await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
        expect(document.activeElement).toBe(trigger);
    });

    it("Enter on a focused item fires it", async () => {
        const user = userEvent.setup();
        const link = vi.fn();
        render(<MoreMenu items={items({ link })} />);
        await openMenu(user);
        await user.keyboard("{Enter}");
        expect(link).toHaveBeenCalledTimes(1);
    });
});

describe("portal guard (clicks and keys inside a menu never reach the host row)", () => {
    it("an item click and a key press do not bubble to the host's React handlers", async () => {
        const user = userEvent.setup();
        const hostClick = vi.fn();
        const hostKey = vi.fn();
        const hostDown = vi.fn();
        render(
            <div onClick={hostClick} onKeyDown={hostKey} onPointerDown={hostDown}>
                <MoreMenu items={items()} />
            </div>
        );
        await openMenu(user);
        hostClick.mockClear();
        hostKey.mockClear();
        hostDown.mockClear();
        await user.keyboard("{ArrowDown}{ArrowDown}");
        await user.click(screen.getByRole("menuitem", { name: "Rename" }));
        expect(hostKey).not.toHaveBeenCalled();
        expect(hostClick).not.toHaveBeenCalled();
        expect(hostDown).not.toHaveBeenCalled();
    });

    it("the trigger's own click does not reach the host either", async () => {
        const user = userEvent.setup();
        const hostClick = vi.fn();
        render(
            <div onClick={hostClick}>
                <MoreMenu items={items()} />
            </div>
        );
        await user.click(screen.getByLabelText("More options"));
        expect(hostClick).not.toHaveBeenCalled();
    });
});

describe("tokens", () => {
    it("rows are the control-scale height (comfortable on touch), not a literal", async () => {
        const user = userEvent.setup();
        render(<MoreMenu items={items()} />);
        await openMenu(user);
        expect(MENU_ITEM_HEIGHT).toBe(g.control.md);
        expect(MENU_ITEM_HEIGHT_COARSE).toBe(g.row.comfortable);
        const css = allCss();
        expect(css).toContain("--ListItem-minHeight:var(--g-control-md)");
        expect(css).toContain("--ListItem-minHeight:var(--g-row-comfortable)");
    });

    it("the surface is raised/border/shadow/radius from tokens", async () => {
        const user = userEvent.setup();
        render(<MoreMenu items={items()} />);
        await openMenu(user);
        const css = allCss();
        expect(css).toContain("background:var(--g-surface-raised)");
        expect(css).toContain("border:1px solid var(--g-border)");
        expect(css).toContain("box-shadow:var(--g-shadow-md)");
        expect(css).toContain("border-radius:var(--g-radius-md)");
    });

    it("a danger row takes the danger token, not a literal red", async () => {
        const user = userEvent.setup();
        render(<MoreMenu items={items()} />);
        await openMenu(user);
        const css = allCss();
        expect(css).toContain("color:var(--g-danger-text)");
        expect(css).toContain("background:var(--g-danger-subtle)");
        expect(css).not.toMatch(/#dc2626|#f87171|rgba\(220/i);
    });
});

describe("layer", () => {
    const zOf = (menu: HTMLElement) => getComputedStyle(menu).zIndex;

    it("an explicit zIndex wins", async () => {
        const user = userEvent.setup();
        render(<MoreMenu items={items()} zIndex={10021} />);
        expect(zOf(await openMenu(user))).toBe("10021");
    });

    it("a modal-hosted note menu opens one above its host", async () => {
        const user = userEvent.setup();
        render(
            <NoteModalHostZIndexProvider value={10020}>
                <MoreMenu items={items()} />
            </NoteModalHostZIndexProvider>
        );
        expect(zOf(await openMenu(user))).toBe("10021");
    });

    it("on a page surface it clears Joy modals (1300) and BlockNote (1400)", async () => {
        const user = userEvent.setup();
        render(<MoreMenu items={items()} />);
        expect(Number(zOf(await openMenu(user)))).toBeGreaterThan(1400);
    });
});

describe("composing the parts around your own trigger", () => {
    const Custom = ({ onPick }: { onPick: (v: string) => void }) => (
        <Dropdown>
            <MenuButton>Open</MenuButton>
            <MenuSurface>
                <MenuGroupLabel>Group</MenuGroupLabel>
                <MenuRow selected onClick={() => onPick("a")}>
                    A
                </MenuRow>
                <MenuRow keepOpen onClick={() => onPick("b")}>
                    B
                </MenuRow>
                <MenuDivider />
                <MenuRow danger onClick={() => onPick("c")}>
                    C
                </MenuRow>
            </MenuSurface>
        </Dropdown>
    );

    it("keepOpen rows leave the menu open, others close it; the group label is not a menuitem", async () => {
        const user = userEvent.setup();
        const onPick = vi.fn();
        render(<Custom onPick={onPick} />);
        await user.click(screen.getByText("Open"));
        expect(screen.getAllByRole("menuitem")).toHaveLength(3);
        await user.click(screen.getByRole("menuitem", { name: "B" }));
        expect(onPick).toHaveBeenCalledWith("b");
        expect(screen.queryByRole("menu")).not.toBeNull();
        await user.click(screen.getByRole("menuitem", { name: "C" }));
        await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    });

    it("selected rows carry Joy's selected state", async () => {
        const user = userEvent.setup();
        render(<Custom onPick={vi.fn()} />);
        await user.click(screen.getByText("Open"));
        expect(screen.getByRole("menuitem", { name: "A" }).className).toContain("Mui-selected");
    });
});
