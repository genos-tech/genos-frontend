// MIP-1156: a milestone row's hover actions replace the progress counter (and a favorite's
// small star) instead of overlaying them, the way the chat row's time gives way to Pin and
// "..." (MIP-1167). jsdom cannot evaluate :hover or @media, so these tests pin the emitted
// rules and the row structure; the look was checked in a browser (see the evidence page).

import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MilestonesListItem } from "../features/tasks/components/sidebar/projects_subs/MilestonesListItem";
import type { Milestone } from "../features/tasks/sprint-milestone/types";

const P = 1;
const ms = (milestoneId: number, title: string): Milestone =>
    ({
        milestoneId,
        projectId: P,
        title,
        status: "Open",
        sprintId: null,
        folderId: null,
        isDeleted: false,
        dueDate: "2026-11-20",
        assignees: [],
        tasksClosed: 1,
        tasksTotal: 3,
    }) as unknown as Milestone;

const toggle = vi.fn();
const mount = (favorites: number[] = []) =>
    render(
        <CssVarsProvider>
            <MilestonesListItem
                currentProjectId={P}
                myself={{ userId: "me" } as never}
                usePM={{ currentProject: { projectId: P }, teamProjects: [] } as never}
                useTEM={{ teamMemberProfiles: {} } as never}
                useTM={{} as never}
                useSM={
                    {
                        projectSprints: { [P]: [] },
                        projectMilestones: { [P]: [ms(1, "Plain one"), ms(2, "Starred one")] },
                        projectFolders: { [P]: [] },
                        tsLastMilestonesLoaded: 1,
                        loadFoldersForProject: vi.fn().mockResolvedValue([]),
                        milestoneFavorites: [],
                        isMilestoneFavorited: (id: number) => favorites.includes(id),
                        toggleMilestoneFavorite: toggle,
                        noteMilestoneOpened: vi.fn(),
                    } as never
                }
            />
        </CssVarsProvider>
    );

const rowOf = (text: string) => screen.getByText(text).closest("li") as HTMLElement;
const menuOf = (text: string) =>
    rowOf(text).querySelector('.NavItem-actions button[aria-haspopup="menu"]') as HTMLElement;
const starOf = (text: string) =>
    rowOf(text).querySelector('[data-testid="milestone-favorite-star"]') as HTMLElement | null;

const allRules = () =>
    [...document.querySelectorAll("style")].flatMap((s) =>
        [...(s.sheet?.cssRules ?? [])].map((r) =>
            r.cssText.replace(/\s+/g, " ").replace(/ ?> ?/g, ">")
        )
    );
const rowClass = (text: string) =>
    [...rowOf(text).classList].find((c) => c.startsWith("css-")) as string;
/** The row's own rules that mention `part`, with the @media text kept around them. */
const rowRules = (text: string, part: string) =>
    allRules().filter((r) => r.includes(`.${rowClass(text)}`) && r.includes(part));

const HOVER_MEDIA = "@media (hover: hover) and (pointer: fine)";

describe("a milestone row's actions take the progress counter's place (MIP-1156)", () => {
    it("at rest the row is unchanged: the counter shows and the spacer is not rendered", () => {
        mount();
        const li = rowOf("Plain one");
        const chip = li.querySelector(".MsRowProgress") as HTMLElement;
        expect(chip.textContent).toBe("1/3");
        const spacer = li.querySelector(".MsRowActionsSpacer") as HTMLElement;
        expect(spacer).not.toBeNull();
        // Inline-free: the rest rule is `display: none`, so the first line is what it was.
        expect(getComputedStyle(spacer).display).toBe("none");
        expect(getComputedStyle(chip).display).not.toBe("none");
    });

    it("on hover, on the row button's keyboard ring and while the actions are engaged, the counter and the favorite mark go and the spacer holds their room", () => {
        mount();
        for (const when of ["&:hover", "& > .Mui-focusVisible", "&[data-actions-engaged]"]) {
            const sel = when.replace("&", `.${rowClass("Plain one")}`).replace(/ ?> ?/g, ">");
            const rules = allRules().filter((r) => r.startsWith(HOVER_MEDIA));
            const text = rules.join(" ");
            for (const [cls, display] of [
                ["MsRowProgress", "none"],
                ["MsRowFavoriteMark", "none"],
                ["MsRowActionsSpacer", "block"],
            ]) {
                expect(text, `${when} ${cls}`).toMatch(
                    new RegExp(
                        `${sel.replace(/[.[\]>&]/g, "\\$&")} \\.${cls} \\{ display: ${display};`
                    )
                );
            }
        }
    });

    it("the reveal is for a real pointer only: touch keeps the counter and shows the buttons beside it", () => {
        mount();
        const text = allRules().join(" ");
        // Every give-way rule sits in the hover media query, never at top level.
        const topLevel = allRules().filter(
            (r) => !r.startsWith("@") && r.includes(".MsRowActionsSpacer") && r.includes("block")
        );
        expect(topLevel).toEqual([]);
        expect(text).toContain("--nav-actions-reserve: calc(32px*2)");
    });

    it("the buttons have no plate and no fade where nothing is under them (hover-capable)", () => {
        mount();
        const rules = rowRules("Plain one", "--nav-actions-bg").filter((r) =>
            r.startsWith(HOVER_MEDIA)
        );
        const text = rules.join(" ");
        expect(text).toContain("--nav-actions-bg: transparent");
        expect(text).toContain("--nav-actions-fade: none");
    });

    it("touch in a compact list still gets the opaque plate: the buttons overlay the chips there", () => {
        mount();
        const text = rowRules("Plain one", "@container ms-list (max-width: 299px)")
            .filter((r) => r.startsWith("@media (hover: none)"))
            .join(" ");
        expect(text).toMatch(/--nav-actions-bg: color-mix\(in srgb,\s*var\(--g-bg-subtle\)/);
        expect(text).toContain("--nav-actions-fade: -10px 0 8px 0");
    });

    it("a tight list (<= 199px) has no room to hold: the plate and fade come back and the spacer goes", () => {
        mount();
        const text = rowRules("Plain one", "@container ms-list (max-width: 199px)")
            .filter((r) => r.startsWith(HOVER_MEDIA))
            .join(" ");
        expect(text).toMatch(/--nav-actions-bg: color-mix\(in srgb,\s*var\(--g-bg-subtle\)/);
        expect(text).toContain("--nav-actions-fade: -10px 0 8px 0");
        expect(text).toMatch(/\.MsRowActionsSpacer \{ width: 0(px)?;?/);
    });

    it("both buttons show while the actions are engaged (focus on one, or an open menu)", () => {
        mount();
        const text = rowRules("Plain one", "[data-actions-engaged] .NavItem-actions button").join(
            " "
        );
        expect(text).toMatch(/\.NavItem-actions button \{ opacity: 1; pointer-events: auto;/);
    });

    it("the spacer is as wide as the buttons that replace the counter: two, or one for a favorite", () => {
        mount([2]);
        const width = (title: string) => {
            const spacer = rowOf(title).querySelector(".MsRowActionsSpacer") as HTMLElement;
            const cls = [...spacer.classList].find((c) => c.startsWith("css-")) as string;
            return allRules()
                .filter((r) => r.startsWith(`.${cls}`))
                .join(" ");
        };
        expect(width("Plain one")).toContain("calc(2 * 28px + 4px - var(--nav-pad-end, 8px))");
        expect(width("Starred one")).toContain("calc(1 * 28px + 4px - var(--nav-pad-end, 8px))");
    });

    it("a favorite has no star button (its star is the mark after the title, the menu removes it)", () => {
        mount([2]);
        expect(starOf("Plain one")).not.toBeNull();
        expect(starOf("Starred one")).toBeNull();
        expect(rowOf("Starred one").querySelector(".MsRowFavoriteMark")).not.toBeNull();
        expect(rowOf("Plain one").querySelector(".MsRowFavoriteMark")).toBeNull();
        // The menu is still there and still toggles it.
        expect(menuOf("Starred one")).not.toBeNull();
    });

    it("the hidden buttons stay in the tab order (a keyboard user reaches them)", () => {
        mount();
        for (const el of [starOf("Plain one"), menuOf("Plain one")] as HTMLElement[]) {
            expect(el.tabIndex).not.toBe(-1);
            el.focus();
            expect(document.activeElement).toBe(el);
        }
    });
});

describe("the row is told when its actions are in use (keyboard focus, open menu)", () => {
    const ATTR = "data-actions-engaged";
    // jsdom has no :focus-visible; a keyboard focus is the case this stands in for.
    const keyboardFocus = (el: HTMLElement, visible = true) => {
        const orig = el.matches.bind(el);
        el.matches = ((sel: string) => (sel === ":focus-visible" ? visible : orig(sel))) as never;
        act(() => el.focus());
    };

    it("keyboard focus on the star sets it, and leaving the actions clears it", () => {
        mount();
        const li = rowOf("Plain one");
        keyboardFocus(starOf("Plain one") as HTMLElement);
        expect(li.hasAttribute(ATTR)).toBe(true);
        act(() => (document.activeElement as HTMLElement).blur());
        expect(li.hasAttribute(ATTR)).toBe(false);
    });

    it("moving between the star and the menu button keeps it", () => {
        mount();
        const li = rowOf("Plain one");
        keyboardFocus(starOf("Plain one") as HTMLElement);
        keyboardFocus(menuOf("Plain one"));
        expect(li.hasAttribute(ATTR)).toBe(true);
    });

    it("a mouse click's focus does not (the row would stay given way after the pointer left)", () => {
        mount();
        keyboardFocus(starOf("Plain one") as HTMLElement, false);
        expect(rowOf("Plain one").hasAttribute(ATTR)).toBe(false);
    });

    it("an open menu sets it, and closing the menu clears it", () => {
        mount();
        const li = rowOf("Plain one");
        fireEvent.click(menuOf("Plain one"));
        expect(li.hasAttribute(ATTR)).toBe(true);
        fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
        expect(li.hasAttribute(ATTR)).toBe(false);
    });

    it("only the row whose actions are in use is marked", () => {
        mount();
        keyboardFocus(starOf("Plain one") as HTMLElement);
        expect(rowOf("Starred one").hasAttribute(ATTR)).toBe(false);
    });

    it("the star toggles the favorite and focus stays among the actions (on the menu button)", () => {
        mount();
        toggle.mockClear();
        const star = starOf("Plain one") as HTMLElement;
        act(() => star.focus());
        fireEvent.click(star);
        expect(toggle).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(menuOf("Plain one"));
    });
});
