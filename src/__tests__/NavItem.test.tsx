/**
 * MIP-1127: the one sidebar row (`NavItem`) and heading (`SectionHeader`).
 *
 * Pinned here: the contract every sidebar migrated onto (selected is the
 * accent tint with `aria-current`, height is the density token, the row is
 * keyboard reachable with a ring from the tokens, actions are a SIBLING of the
 * row button, hover only on a real pointer, the tree keyboard idiom, indent as
 * a depth or a CSS length), and that nothing in the look is a literal colour or
 * a gradient. jsdom cannot measure layout or resolve `var()` colours: heights
 * and the visible result were checked in a browser (see the evidence page).
 */
import { CacheProvider } from "@emotion/react";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { NavItem, NavItemProps } from "../components/ui/nav/NavItem";
import { NAV_INDENT_STEP, navIndentLength } from "../components/ui/nav/navStyles";
import { SectionHeader } from "../components/ui/nav/SectionHeader";
import { getRtlCache } from "../theme/rtlCache";

afterEach(cleanup);

const mount = (props: Partial<NavItemProps> = {}) =>
    render(
        <CssVarsProvider>
            <ul>
                <NavItem label="Tasks" {...props} />
            </ul>
        </CssVarsProvider>
    );

const row = () => screen.getByRole("listitem");
const button = () => screen.getByRole("button", { name: /Tasks/ });

describe("NavItem", () => {
    it("renders the label, a leading icon, a count and a trailing node", () => {
        mount({
            icon: <svg data-testid="icon" />,
            count: 7,
            trailing: <span data-testid="trail" />,
        });
        expect(screen.getByText("Tasks")).toBeInTheDocument();
        expect(screen.getByTestId("icon")).toBeInTheDocument();
        expect(screen.getByText("7")).toBeInTheDocument();
        expect(screen.getByTestId("trail")).toBeInTheDocument();
    });

    it("selected: the row says so for assistive tech and styling, unselected does not", () => {
        mount({ selected: true });
        expect(button()).toHaveAttribute("aria-current", "true");
        expect(row()).toHaveAttribute("data-selected", "true");
        cleanup();
        mount();
        expect(button()).not.toHaveAttribute("aria-current");
        expect(row()).not.toHaveAttribute("data-selected");
    });

    it("a navigation row can say it is the current page", () => {
        mount({ selected: true, current: "page" });
        expect(button()).toHaveAttribute("aria-current", "page");
    });

    it("selected is the accent tint, never a gradient or a literal colour", () => {
        mount({ selected: true });
        const css = cssOf(row());
        // The selected rule itself (not its hover twin) paints the tint.
        const selectedRule = css
            .split("\n")
            .find((r) => r.includes('[data-selected="true"]') && !r.includes(":hover"));
        expect(selectedRule).toContain("background: var(--g-accent-subtle)");
        expect(selectedRule).toContain("color: var(--g-accent-text)");
        expect(css).not.toMatch(/gradient|#[0-9a-f]{3,8}\b|rgba?\(\s*\d/i);
    });

    it("sets --Icon-color so icons follow the state (Joy SvgIcon ignores `color`)", () => {
        mount({ selected: true });
        expect(cssOf(row())).toContain("--Icon-color: var(--g-accent-text)");
    });

    it("one row is one density row, a two-line row is the documented multiple", () => {
        mount();
        expect(cssOf(row())).toContain("height: var(--g-row)");
        cleanup();
        mount({ lines: 2, secondary: "Edited 2h ago" });
        const css = cssOf(row());
        expect(css).toContain("min-height: calc(var(--g-row) * 1.5)");
        expect(css).not.toMatch(/(^|[;{\s])height: var\(--g-row\)/);
        expect(screen.getByText("Edited 2h ago")).toBeInTheDocument();
    });

    it("radius comes from the token", () => {
        mount();
        expect(cssOf(row())).toContain("border-radius: var(--g-radius-sm)");
    });

    it("hover is for real pointers only (sticky hover on touch eats the first tap)", () => {
        mount();
        const cls = [...row().classList].find((c) => /JoyListItem-root/.test(c)) as string;
        const top: string[] = [];
        const inMedia: string[] = [];
        for (const sheet of Array.from(document.styleSheets)) {
            for (const rule of Array.from(sheet.cssRules)) {
                const sel = (rule as CSSStyleRule).selectorText;
                if (sel?.includes(cls) && sel.includes(":hover")) top.push(rule.cssText);
                const cond = (rule as CSSMediaRule).conditionText;
                if (cond?.includes("hover: hover")) {
                    for (const inner of Array.from((rule as CSSMediaRule).cssRules)) {
                        if ((inner as CSSStyleRule).selectorText?.includes(cls)) {
                            inMedia.push(inner.cssText);
                        }
                    }
                }
            }
        }
        expect(top).toEqual([]);
        expect(inMedia.join("")).toContain(":hover");
    });

    it("the row button's own hover plate is switched off: the row box is the only plate", () => {
        mount();
        const css = cssOf(button());
        expect(css).toContain("--variant-plainHoverBg: transparent");
        expect(css).toContain("--variant-plainActiveBg: transparent");
    });

    it("the keyboard ring is the token ring, inside the row", () => {
        mount();
        const css = cssOf(button());
        expect(css).toContain("var(--g-focus)");
        expect(css).toContain("outline-offset: -2px");
    });

    it("clicking the row calls onClick, and the row is keyboard reachable", () => {
        const onClick = vi.fn();
        mount({ onClick });
        fireEvent.click(button());
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(button()).toHaveAttribute("tabindex", "0");
    });

    describe("actions", () => {
        it("are a sibling of the row button, never inside it", () => {
            const onAction = vi.fn();
            mount({
                actions: (
                    <button aria-label="Pin" type="button" onClick={onAction}>
                        pin
                    </button>
                ),
            });
            const pin = screen.getByRole("button", { name: "Pin" });
            expect(button().contains(pin)).toBe(false);
            expect(row().contains(pin)).toBe(true);
            fireEvent.click(pin);
            expect(onAction).toHaveBeenCalledTimes(1);
        });

        it("are hidden until hover or focus, shown on touch and while kept visible", () => {
            mount({ actions: <span>a</span> });
            const css = cssOf(screen.getByText("a").parentElement as Element);
            expect(css).toContain("opacity: 0");
            // jsdom flattens @media: the touch rule shows as a second rule.
            expect(css).toContain("opacity: 1");
            expect(cssOf(row())).toMatch(/:focus-within \.NavItem-actions\s*>\s*\*/);
            cleanup();
            mount({ actions: <span>a</span>, actionsVisible: true });
            expect(cssOf(screen.getByText("a").parentElement as Element)).toContain("opacity: 1");
        });
    });

    describe("actionsInPlace (chat rows: the time gives way to the actions)", () => {
        const time = <span className="NavItem-hide-on-actions">12:00</span>;
        const mountInPlace = (extra: Partial<NavItemProps> = {}) =>
            mount({
                actionsInPlace: true,
                trailing: time,
                actions: (
                    <>
                        <button aria-label="More" type="button">
                            m
                        </button>
                        <button aria-label="Pin" className="NavItem-keep" type="button">
                            p
                        </button>
                    </>
                ),
                ...extra,
            });

        it("a hidden action takes no room but stays in the tab order", () => {
            mountInPlace();
            const more = screen.getByRole("button", { name: "More" });
            const css = cssOf(more.parentElement as Element);
            // Out of the flow (so there is no empty column), never display: none (a
            // button that cannot be focused cannot reveal itself to a keyboard user).
            expect(css).toContain("position: absolute");
            expect(css).toContain("pointer-events: none");
            expect(css).not.toMatch(/display:\s*none/);
            // It is still found by role, i.e. it is not hidden from assistive tech.
            expect(more).toBeTruthy();
            more.focus();
            expect(document.activeElement).toBe(more);
        });

        it("hover and keyboard focus bring the actions back and hide what gives way", () => {
            mountInPlace();
            const css = cssOf(row());
            expect(css).toMatch(/:focus-within \.NavItem-actions\s*>\s*\*[^}]*position: static/);
            expect(css).toMatch(/:focus-within \.NavItem-hide-on-actions[^}]*display: none/);
            expect(css).toMatch(/:hover \.NavItem-actions\s*>\s*\*[^}]*position: static/);
            expect(css).toMatch(/:hover \.NavItem-hide-on-actions[^}]*display: none/);
        });

        it("an action with the keep class is never moved out of the row (a pinned chat's pin)", () => {
            mountInPlace();
            expect(cssOf(row())).toBeTruthy();
            expect(
                cssOf(screen.getByRole("button", { name: "More" }).parentElement as Element)
            ).toContain(":not(.NavItem-keep)");
        });

        it("actionsVisible (a menu is open) keeps them in the flow and hides the time", () => {
            mountInPlace({ actionsVisible: true });
            const css = cssOf(
                screen.getByRole("button", { name: "More" }).parentElement as Element
            );
            expect(css).toContain("position: static");
            expect(css).toMatch(/\.NavItem-hide-on-actions[^}]*display: none/);
        });

        it("the row keeps its own end padding, since the actions no longer provide it", () => {
            mountInPlace();
            expect(cssOf(button())).toMatch(/padding-inline-end:\s*var\(--nav-pad-end, 8px\)/);
        });
    });

    describe("actionsOverlay (milestone and folder rows: the actions cover the row's end)", () => {
        const mountOverlay = (extra: Partial<NavItemProps> = {}) =>
            mount({
                actionsOverlay: { top: "17px", reserve: "64px" },
                actions: (
                    <>
                        <button aria-label="Star" type="button">
                            s
                        </button>
                        <button aria-expanded="false" aria-label="More" type="button">
                            m
                        </button>
                    </>
                ),
                ...extra,
            });
        const slot = () => screen.getByRole("button", { name: "More" }).parentElement as Element;
        const rules = (el: Element) => cssOf(el).replace(/\s+/g, " ").replace(/ ?> ?/g, ">");

        it("the slot is out of flow, at the given height, and never takes a click itself", () => {
            mountOverlay();
            const css = rules(slot());
            expect(css).toContain("position: absolute");
            expect(css).toContain("top: 17px");
            expect(css).toContain("pointer-events: none");
            // Out of flow: nothing of the row's width is spent on it.
            expect(rules(button())).toMatch(
                /padding-inline-end: calc\(var\(--nav-pad-end, 8px\) \+ var\(--nav-actions-reserve, 0px\)\)/
            );
        });

        it("a hidden action is invisible and not clickable, but still focusable (never display: none)", () => {
            mountOverlay();
            const more = screen.getByRole("button", { name: "More" });
            const css = rules(slot());
            expect(css).toMatch(/ button \{[^}]*opacity: 0;[^}]*pointer-events: none/);
            expect(css).not.toMatch(/display:\s*none|visibility:\s*hidden/);
            more.focus();
            expect(document.activeElement).toBe(more);
        });

        it("hover, the keyboard ring and an open menu reveal them; a mouse click (focus-within) does not", () => {
            mountOverlay();
            const css = rules(row());
            expect(css).toMatch(
                /:hover \.NavItem-actions button \{[^}]*opacity: 1[^}]*pointer-events: auto/
            );
            expect(css).toContain(".Mui-focusVisible~.NavItem-actions button");
            expect(css).toContain(".NavItem-actions button:focus-visible");
            expect(css).toContain('.NavItem-actions button[aria-expanded="true"]');
            expect(css).not.toContain(":focus-within");
            expect(css).not.toContain(":has(");
        });

        it("touch shows them always and keeps the reserve free for them", () => {
            mountOverlay();
            const row_ = rules(row());
            // `cssOf` lists a rule inside `@media` without its prelude: the 64px is the touch value.
            expect(row_).toContain("--nav-actions-reserve: 64px");
            expect(row_).toContain("--nav-actions-bg: transparent");
            expect(row_).toContain("--nav-actions-fade: none");
            expect(rules(slot())).toMatch(
                /opacity: 1; pointer-events: auto; --IconButton-size: 32px/
            );
        });

        it("the buttons wear an opaque hover-coloured background and a fade, from variables a list can reset", () => {
            mountOverlay();
            const css = rules(slot());
            expect(css).toMatch(
                /background-color: var\(--nav-actions-bg, color-mix\(in srgb, var\(--g-bg-subtle\)/
            );
            expect(css).toMatch(/box-shadow: var\(--nav-actions-fade, -10px 0 8px 0 color-mix/);
        });

        it("actionsVisible (a menu is open) shows them", () => {
            mountOverlay({ actionsVisible: true });
            expect(rules(slot())).toMatch(/ button \{[^}]*opacity: 1;[^}]*pointer-events: auto/);
        });

        it("a row without actions reserves nothing even if asked for the mode", () => {
            mountOverlay({ actions: undefined });
            expect(rules(button())).not.toContain("--nav-actions-reserve");
            expect(rules(row())).not.toContain("--nav-actions-reserve");
        });
    });

    it("an action that carries state opts out of the fade", () => {
        mount({ actions: <span>a</span> });
        const css = cssOf(screen.getByText("a").parentElement as Element);
        expect(css).toContain(":not(.NavItem-keep)");
    });

    describe("unread", () => {
        it("adds the accent bar and a heavier label", () => {
            const { container } = mount({ unread: true });
            const bar = container.querySelector(".NavItem-unread");
            expect(bar).not.toBeNull();
            expect(cssOf(bar as Element)).toContain("var(--g-accent)");
            expect(cssOf(bar as Element)).not.toContain("gradient");
            expect(cssOf(container.querySelector(".NavItem-label") as Element)).toContain(
                "font-weight: 600"
            );
        });

        it("has no bar when read", () => {
            const { container } = mount();
            expect(container.querySelector(".NavItem-unread")).toBeNull();
        });
    });

    describe("tree", () => {
        it("a depth indents by one step per level, a string is used as given", () => {
            expect(navIndentLength(undefined)).toBe("0px");
            expect(navIndentLength(0)).toBe("0px");
            expect(navIndentLength(2)).toBe(`${2 * NAV_INDENT_STEP}px`);
            expect(navIndentLength("calc(var(--x) * 3)")).toBe("calc(var(--x) * 3)");
            mount({ indent: 2 });
            expect(cssOf(button())).toContain(`calc(${2 * NAV_INDENT_STEP + 8}px)`);
        });

        it("expanded draws the chevron and reports aria-expanded; a leaf has neither", () => {
            const { container } = mount({ expanded: true });
            expect(button()).toHaveAttribute("aria-expanded", "true");
            expect(container.querySelector(".NavItem-chevron")).not.toBeNull();
            cleanup();
            const leaf = mount({ reserveChevron: true });
            expect(button()).not.toHaveAttribute("aria-expanded");
            // The column is kept so a leaf lines up with its siblings.
            const chevron = leaf.container.querySelector(".NavItem-chevron") as Element;
            expect(cssOf(chevron)).toContain("visibility: hidden");
        });

        it("a separate chevron target toggles without activating the row", () => {
            const onClick = vi.fn();
            const onToggleExpanded = vi.fn();
            const { container } = mount({ expanded: false, onClick, onToggleExpanded });
            fireEvent.click(container.querySelector(".NavItem-chevron") as Element);
            expect(onToggleExpanded).toHaveBeenCalledTimes(1);
            expect(onClick).not.toHaveBeenCalled();
        });

        it("arrow keys open and close, and only when they would change something", () => {
            const onToggleExpanded = vi.fn();
            mount({ expanded: false, onToggleExpanded });
            fireEvent.keyDown(button(), { key: "ArrowLeft" });
            expect(onToggleExpanded).not.toHaveBeenCalled();
            fireEvent.keyDown(button(), { key: "ArrowRight" });
            expect(onToggleExpanded).toHaveBeenCalledTimes(1);
            cleanup();
            onToggleExpanded.mockClear();
            mount({ expanded: true, onToggleExpanded });
            fireEvent.keyDown(button(), { key: "ArrowRight" });
            expect(onToggleExpanded).not.toHaveBeenCalled();
            fireEvent.keyDown(button(), { key: "ArrowLeft" });
            expect(onToggleExpanded).toHaveBeenCalledTimes(1);
        });

        it("ignores arrows that bubble up from something inside the row", () => {
            const onToggleExpanded = vi.fn();
            const { container } = mount({
                expanded: false,
                onToggleExpanded,
                label: <input data-testid="inner" />,
            });
            expect(container.querySelector("input")).not.toBeNull();
            fireEvent.keyDown(screen.getByTestId("inner"), { key: "ArrowRight" });
            expect(onToggleExpanded).not.toHaveBeenCalled();
        });

        it("keeps the caller's own onKeyDown", () => {
            const onKeyDown = vi.fn();
            mount({ onKeyDown });
            fireEvent.keyDown(button(), { key: "a" });
            expect(onKeyDown).toHaveBeenCalledTimes(1);
        });
    });

    it("renders as a div when it sits in a wrapper li, and forwards root props", () => {
        render(
            <CssVarsProvider>
                <NavItem as="div" label="Tasks" rootProps={{ "data-testid": "root" }} />
            </CssVarsProvider>
        );
        expect(screen.getByTestId("root").tagName).toBe("DIV");
        expect(screen.queryByRole("listitem")).toBeNull();
    });

    it("dashed is an outline, not a fill, and lights up to the accent on hover", () => {
        mount({ variant: "dashed" });
        const css = cssOf(row());
        expect(css).toContain("1px dashed var(--g-border)");
        // A second hover key in the style object would silently replace this one.
        expect(css).toContain("border-color: var(--g-accent-border)");
        // ...without losing the actions reveal that shares the same media query.
        expect(css).toMatch(/:hover \.NavItem-actions\s*>\s*\*/);
    });

    it("renders under the RTL cache and mirrors the chevron", () => {
        document.documentElement.dir = "rtl";
        const { container } = render(
            <CacheProvider value={getRtlCache()}>
                <CssVarsProvider>
                    <ul>
                        <NavItem expanded={false} label="Tasks" />
                    </ul>
                </CssVarsProvider>
            </CacheProvider>
        );
        expect(screen.getByText("Tasks")).toBeInTheDocument();
        expect(cssOf(container.querySelector(".NavItem-chevron") as Element)).toContain(
            "scaleX(-1)"
        );
        document.documentElement.dir = "";
    });
});

describe("SectionHeader", () => {
    it("a collapsible heading is a button that reports and toggles its state", () => {
        const onToggleExpanded = vi.fn();
        render(
            <CssVarsProvider>
                <SectionHeader label="Projects" expanded onToggleExpanded={onToggleExpanded} />
            </CssVarsProvider>
        );
        const toggle = screen.getByRole("button", { name: "Projects" });
        expect(toggle).toHaveAttribute("aria-expanded", "true");
        fireEvent.click(toggle);
        expect(onToggleExpanded).toHaveBeenCalledTimes(1);
    });

    it("a plain heading is only text", () => {
        render(
            <CssVarsProvider>
                <SectionHeader label="Pinned" />
            </CssVarsProvider>
        );
        expect(screen.getByText("Pinned")).toBeInTheDocument();
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("actions sit beside the toggle, not inside it", () => {
        render(
            <CssVarsProvider>
                <SectionHeader
                    actions={<button aria-label="Filter" type="button" />}
                    expanded={false}
                    label="Projects"
                    onToggleExpanded={vi.fn()}
                />
            </CssVarsProvider>
        );
        const toggle = screen.getByRole("button", { name: "Projects" });
        expect(toggle.contains(screen.getByRole("button", { name: "Filter" }))).toBe(false);
    });

    it("weights stay at 600 and no colour is literal", () => {
        render(
            <CssVarsProvider>
                <SectionHeader label="Pinned" />
            </CssVarsProvider>
        );
        const css = cssOf(screen.getByRole("listitem"));
        expect(css).toContain("font-weight: 600");
        expect(css).not.toMatch(/font-weight: 700|gradient|#[0-9a-f]{3,8}\b|rgba?\(\s*\d/i);
    });
});
