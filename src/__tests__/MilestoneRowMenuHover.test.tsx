// MIP-1021: the "..." menu of a milestone/folder row shows only on hover (and
// keyboard focus, and while its menu is open), always on touch, and never
// reserves row width while hidden; the row title keeps a minimum width.
// MIP-1163 moved the rows onto `NavItem`'s `actionsOverlay` mode: the same
// contract, queried through the row's `.NavItem-actions` slot and the
// `--nav-*` variables instead of Joy's `endAction` and `--ms-menu-*`.
// jsdom can't evaluate :hover, @media or container queries, so these tests
// pin what it can see: the emitted CSS rules, the row structure, and that the
// hidden button is still a focusable control (keyboard / screen-reader reach).

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MilestonesListItem } from "../features/tasks/components/sidebar/projects_subs/MilestonesListItem";
import type { Milestone, MilestoneFolder, Sprint } from "../features/tasks/sprint-milestone/types";

const P = 1;
const ms = (milestoneId: number, title: string, over: Partial<Milestone> = {}): Milestone =>
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
        ...over,
    }) as unknown as Milestone;

const SPRINTS = [
    {
        sprintId: 1,
        name: "Old sprint",
        status: "archived",
        isDeleted: false,
        endDate: "2026-10-14",
    },
] as unknown as Sprint[];
const FOLDERS: MilestoneFolder[] = [
    { folderId: 1, projectId: P, name: "Q4", sortOrder: 1, tsCreatedAt: "", tsUpdatedAt: "" },
];
const MILESTONES = [
    ms(1, "Unfiled one"),
    ms(2, "In a folder", { folderId: 1 }),
    ms(3, "Archived", { status: "Closed", sprintId: 1 }),
];

const renderSidebar = () =>
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
                        projectSprints: { [P]: SPRINTS },
                        projectMilestones: { [P]: MILESTONES },
                        projectFolders: { [P]: FOLDERS },
                        tsLastMilestonesLoaded: 1,
                        loadFoldersForProject: vi.fn().mockResolvedValue(FOLDERS),
                        milestoneFavorites: [],
                        isMilestoneFavorited: () => false,
                        toggleMilestoneFavorite: vi.fn(),
                        noteMilestoneOpened: vi.fn(),
                    } as never
                }
            />
        </CssVarsProvider>
    );

const rowOf = (text: string) => screen.getByText(text).closest("li") as HTMLElement;
const buttonOf = (text: string) =>
    screen.getByText(text).closest(".MuiListItemButton-root") as HTMLElement;

// Every emitted CSS rule as text, whitespace collapsed and none around ">".
// A rule inside @media / @container is kept inside its parent's text.
const allRules = () =>
    [...document.querySelectorAll("style")].flatMap((s) =>
        [...(s.sheet?.cssRules ?? [])].map((r) =>
            r.cssText.replace(/\s+/g, " ").replace(/ ?> ?/g, ">")
        )
    );
const rulesMatching = (...parts: (string | RegExp)[]) =>
    allRules().filter((r) =>
        parts.every((p) => (typeof p === "string" ? r.includes(p) : p.test(r)))
    );
// The actions slot is a box of its own class, so its rules read `.css-x button`;
// the row's rules (reveal on hover / focus) read `.css-row .NavItem-actions button`.
const REVEAL_BUTTON = ".NavItem-actions button";
const actionsClassOf = (text: string) =>
    [...(rowOf(text).querySelector(".NavItem-actions") as HTMLElement).classList].find((c) =>
        c.startsWith("css-")
    ) as string;
// Rules of the actions box's own class that style its buttons, plain or inside `@media`.
const slotButtonRules = (text: string, ...parts: (string | RegExp)[]) =>
    rulesMatching(`.${actionsClassOf(text)} button`, ...parts);
// The element's own emotion class rules, as one string.
const ruleOf = (el: HTMLElement) => {
    const cls = [...el.classList].filter((c) => c.startsWith("css-"));
    return allRules()
        .filter((r) => cls.some((c) => r.startsWith(`.${c}`) || r.includes(`{ .${c}`)))
        .join(" ");
};

describe("MilestonesListItem: the row menu shows on hover (MIP-1021)", () => {
    it("keeps the menu a real, focusable button even while it is visually hidden", () => {
        renderSidebar();
        for (const label of ["Unfiled one", "In a folder", "Q4"]) {
            const li = rowOf(label);
            const btn = li.querySelector(
                '.NavItem-actions button[aria-haspopup="menu"]'
            ) as HTMLButtonElement;
            expect(btn).not.toBeNull();
            expect(btn.disabled).toBe(false);
            expect(btn.tabIndex).not.toBe(-1);
            expect(btn.hasAttribute("hidden")).toBe(false);
            expect(btn.getAttribute("aria-haspopup")).toBe("menu");
            expect(btn.getAttribute("aria-label")).toBeTruthy();
            btn.focus();
            expect(document.activeElement).toBe(btn);
        }
    });

    it("hides the button (opacity 0, not clickable) until the row is revealed", () => {
        renderSidebar();
        const hidden = slotButtonRules("Unfiled one", "opacity: 0", "pointer-events: none").filter(
            (r) => !r.startsWith("@")
        );
        expect(hidden.length).toBeGreaterThan(0);
        // `display:none` / `visibility:hidden` would take it out of the tab order.
        for (const r of hidden) expect(r).not.toMatch(/display: none|visibility: hidden/);
    });

    it("reveals it on row hover, keyboard focus and while its menu is open", () => {
        renderSidebar();
        const shown = rulesMatching(REVEAL_BUTTON, "opacity: 1", "pointer-events: auto");
        const selectors = shown.join(" ");
        expect(selectors).toContain(":hover");
        expect(selectors).toContain(".Mui-focusVisible");
        expect(selectors).toContain(":focus-visible");
        expect(selectors).toContain('[aria-expanded="true"]');
    });

    it("never uses :has() for it (one :has() cost a second of style recalc, MIP-963)", () => {
        renderSidebar();
        const offenders = rulesMatching(":has(").filter((r) => r.includes("NavItem-actions"));
        expect(offenders).toEqual([]);
    });

    it("always shows it on touch devices, which have no hover", () => {
        renderSidebar();
        const touch = slotButtonRules("Unfiled one").filter((r) =>
            r.startsWith("@media (hover: none)")
        );
        expect(touch.length).toBeGreaterThan(0);
        expect(touch.join(" ")).toMatch(/opacity: 1; pointer-events: auto/);
    });

    it("reserves no end padding for the hidden menu on a mouse device", () => {
        renderSidebar();
        // Was a fixed 32px (`mr: 4`) on every menu row; now one variable that
        // is 0 for a mouse (the `0px` fallback) and the buttons' width only on touch.
        // A milestone row ends in two buttons (the star and the menu), so it keeps
        // twice the touch reserve (MIP-1053); a folder row has one.
        for (const label of ["Unfiled one", "In a folder", "Q4"]) {
            const rule = ruleOf(buttonOf(label));
            expect(rule, label).toContain("var(--nav-actions-reserve, 0px)");
            expect(rule, label).not.toContain("32px");
        }
        const touch = (label: string) =>
            rulesMatching("@media (hover: none)", "--nav-actions-reserve").filter((r) =>
                r.includes(`.${[...rowOf(label).classList].find((c) => c.startsWith("css-"))}`)
            );
        for (const label of ["Unfiled one", "In a folder"]) {
            expect(touch(label).join(" "), label).toContain("--nav-actions-reserve: calc(32px*2)");
        }
        expect(touch("Q4").join(" ")).toContain("--nav-actions-reserve: 32px");
    });

    it("does not reserve it on a compact (<= 299px) list even on touch", () => {
        renderSidebar();
        const compact = rulesMatching(
            "@container ms-list (max-width: 299px)",
            "--nav-actions-reserve"
        );
        expect(compact.join(" ")).toContain("--nav-actions-reserve: 0px");
        // On every row kind that has a menu.
        const rowRules = (label: string) =>
            compact.filter((r) =>
                r.includes(`.${[...rowOf(label).classList].find((c) => c.startsWith("css-"))}`)
            );
        for (const label of ["Unfiled one", "Q4"])
            expect(rowRules(label).length, label).toBeGreaterThan(0);
    });

    it("gives the overlaying button a background, but not where it has its own space", () => {
        renderSidebar();
        // Milestone rows, hover-capable: transparent (the buttons take the progress counter's
        // place, nothing is under them, MIP-1156: see MilestoneRowHoverActions.test). Touch
        // in a wide list: transparent, no fade (it sits in the reserved 32px). Touch
        // in a compact list: overlay again, so the background comes back. Folder rows
        // still overlay their count: they keep the opaque default.
        const row = (label: string) =>
            `.${[...rowOf(label).classList].find((c) => c.startsWith("css-"))}`;
        const touch = rulesMatching(
            "@media (hover: none)",
            "--nav-actions-reserve",
            row("Unfiled one")
        ).join(" ");
        expect(touch).toContain("--nav-actions-bg: transparent");
        expect(touch).toContain("--nav-actions-fade: none");
        const compact = rulesMatching(
            "@container ms-list (max-width: 299px)",
            "--nav-actions-bg",
            row("Unfiled one")
        ).join(" ");
        // Opaque: the hover tint laid over the sidebar surface. Joy's own
        // `neutral.plainHoverBg` is translucent, and the star and "..." showed the
        // title through it (MIP-1156).
        expect(compact).toMatch(/--nav-actions-bg: color-mix\(in srgb,\s*var\(--g-bg-subtle\)/);
        expect(compact).not.toContain("plainHoverBg");
        expect(compact).toContain("--nav-actions-fade: -10px 0 8px 0");
        // The button reads both variables, with the same opaque colour as the default.
        const button = slotButtonRules("Unfiled one", "background-color").join(" ");
        expect(button).toMatch(
            /background-color: var\(--nav-actions-bg, color-mix\(in srgb,\s*var\(--g-bg-subtle\)/
        );
        expect(button).toContain("box-shadow: var(--nav-actions-fade");
    });

    it("gives the Past-milestones rows the star and a menu with only the favorite item (MIP-1053)", () => {
        renderSidebar();
        fireEvent.click(screen.getByText("Past milestones"));
        fireEvent.click(screen.getByText("2026"));
        fireEvent.click(screen.getByText("Old sprint"));
        const li = rowOf("Archived");
        expect(li.querySelector(".NavItem-actions")).not.toBeNull();
        expect(li.querySelector('[data-testid="milestone-favorite-star"]')).not.toBeNull();
        // Past milestones are not filed from here: the menu offers no folders.
        fireEvent.click(
            li.querySelector('.NavItem-actions button[aria-haspopup="menu"]') as HTMLElement
        );
        expect(screen.getByText("Add to favorites")).toBeTruthy();
        expect(screen.queryByText("Move to folder")).toBeNull();
    });
});

describe("MilestonesListItem: folder rows say whether they are open", () => {
    it("aria-expanded follows the folder, for assistive tech (the chevron is only drawn)", () => {
        // The open / closed state is remembered per device: start clean.
        window.localStorage.clear();
        window.sessionStorage.clear();
        renderSidebar();
        // Q4 is open by default, "Past milestones" starts closed.
        expect(buttonOf("Q4")).toHaveAttribute("aria-expanded", "true");
        expect(buttonOf("Past milestones")).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(buttonOf("Past milestones"));
        expect(buttonOf("Past milestones")).toHaveAttribute("aria-expanded", "true");
    });
});

describe("MilestonesListItem: the title always keeps room (MIP-1021)", () => {
    it("gives the milestone title a minimum width, so chips cannot squeeze it to nothing", () => {
        renderSidebar();
        const title = screen.getByText("Unfiled one");
        expect(title).toHaveStyle({ minWidth: "4ch" });
        // The first line clips (the chip is cut off, the title is not).
        const line1 = title.closest(".MuiStack-root") as HTMLElement;
        expect(line1).toHaveStyle({ overflow: "hidden", minWidth: "0" });
    });

    it("gives the folder title a minimum width too", () => {
        renderSidebar();
        expect(screen.getByText("Q4")).toHaveStyle({ minWidth: "4ch" });
        expect(screen.getByText("Past milestones")).toHaveStyle({ minWidth: "4ch" });
    });

    it("drops the progress chip in the narrowest rows, before the title", () => {
        renderSidebar();
        const chip = rowOf("Unfiled one").querySelector(".MsRowProgress");
        expect(chip).toHaveTextContent("1/3");
        const rule = rulesMatching("@container ms-row (max-width: 99px)").join(" ");
        expect(rule).toContain(".MsRowProgress { display: none; }");
        // ...and the avatars still go there (the two rules share one block).
        expect(rule).toContain(".MsRowAvatars { display: none; }");
    });

    it("drops the folder count chip when the whole list is narrow", () => {
        renderSidebar();
        const chip = rowOf("Q4").querySelector(".MsFolderCount");
        expect(chip).toHaveTextContent("1");
        const rule = rulesMatching("@container ms-list (max-width: 159px)").join(" ");
        expect(rule).toContain(".MsFolderCount { display: none; }");
    });

    it("has a tighter indent tier below 200px: smaller steps, end padding and gap", () => {
        renderSidebar();
        const tight = rulesMatching("@container ms-list (max-width: 199px)").join(" ");
        expect(tight).toContain("--ms-indent-base: 16px");
        expect(tight).toContain("--ms-indent-step: 6px");
        expect(tight).toContain("--ms-btn-gap: 0px");
        expect(tight).toContain("--nav-pad-end: 4px");
        expect(tight).toContain("--nav-gap: 3px");
        // The 299px tier from MIP-1012 is still there, untouched.
        expect(rulesMatching("@container ms-list (max-width: 299px)").join(" ")).toContain(
            "--ms-indent-base: 24px; --ms-indent-step: 8px;"
        );
    });

    it("applies the end padding and gap variables to every row kind, add rows too", () => {
        renderSidebar();
        // jsdom drops `var()` in padding shorthands from getComputedStyle, so
        // read the rule emotion generated for the element's own class.
        for (const label of ["Unfiled one", "Q4", "Add milestone", "New folder"]) {
            const rule = ruleOf(buttonOf(label));
            expect(rule, label).toContain("var(--nav-pad-end, 8px)");
            expect(rule, label).toContain("var(--nav-gap, 8px)");
        }
        // The list sets the wide value the tight tier overrides (12px = the old 8px + 4px).
        const list = document.querySelector("ul") as HTMLElement;
        expect(list).toHaveStyle({ "--nav-pad-end": "12px" });
    });
});
