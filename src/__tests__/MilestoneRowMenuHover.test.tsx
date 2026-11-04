// MIP-1021: the "..." menu of a milestone/folder row shows only on hover (and
// keyboard focus, and while its menu is open), always on touch, and never
// reserves row width while hidden; the row title keeps a minimum width.
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
// The top-level (not @media / @container) rule(s) styling the end-action button.
const plainRules = (...parts: (string | RegExp)[]) =>
    rulesMatching(...parts).filter((r) => !r.startsWith("@"));

const END_BUTTON = ".MuiListItem-endAction button";

describe("MilestonesListItem: the row menu shows on hover (MIP-1021)", () => {
    it("keeps the menu a real, focusable button even while it is visually hidden", () => {
        renderSidebar();
        for (const label of ["Unfiled one", "In a folder", "Q4"]) {
            const li = rowOf(label);
            const btn = li.querySelector(".MuiListItem-endAction button") as HTMLButtonElement;
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
        const hidden = plainRules(END_BUTTON, "opacity: 0", "pointer-events: none");
        expect(hidden.length).toBeGreaterThan(0);
        // `display:none` / `visibility:hidden` would take it out of the tab order.
        for (const r of hidden) expect(r).not.toMatch(/display: none|visibility: hidden/);
    });

    it("reveals it on row hover, keyboard focus and while its menu is open", () => {
        renderSidebar();
        const shown = plainRules(END_BUTTON, "opacity: 1", "pointer-events: auto");
        const selectors = shown.join(" ");
        expect(selectors).toContain(":hover");
        expect(selectors).toContain(".Mui-focusVisible");
        expect(selectors).toContain(":focus-visible");
        expect(selectors).toContain('[aria-expanded="true"]');
    });

    it("never uses :has() for it (one :has() cost a second of style recalc, MIP-963)", () => {
        renderSidebar();
        const offenders = rulesMatching(":has(").filter((r) =>
            r.includes("MuiListItem-endAction")
        );
        expect(offenders).toEqual([]);
    });

    it("always shows it on touch devices, which have no hover", () => {
        renderSidebar();
        const touch = rulesMatching("@media (hover: none)", END_BUTTON);
        expect(touch.length).toBeGreaterThan(0);
        expect(touch.join(" ")).toMatch(/opacity: 1; pointer-events: auto/);
    });

    it("reserves no right margin for the hidden menu on a mouse device", () => {
        renderSidebar();
        // Was a fixed 32px (`mr: 4`) on every menu row; now one variable that
        // is 0 for a mouse and the button's width only on touch.
        for (const label of ["Unfiled one", "In a folder", "Q4"]) {
            const mr = getComputedStyle(buttonOf(label)).marginRight;
            expect(mr).not.toBe("32px");
            expect(mr).toBe("var(--ms-menu-reserve)");
        }
        const list = document.querySelector("ul") as HTMLElement;
        expect(list).toHaveStyle({ "--ms-menu-reserve": "0px" });
        const touchReserve = rulesMatching("@media (hover: none)", "--ms-menu-reserve: 32px");
        expect(touchReserve.length).toBeGreaterThan(0);
    });

    it("does not reserve it on a compact (<= 299px) list even on touch", () => {
        renderSidebar();
        const compact = rulesMatching("@container ms-list (max-width: 299px)");
        expect(compact.join(" ")).toContain("--ms-menu-reserve: 0px");
    });

    it("gives the overlaying button a background, but not where it has its own space", () => {
        renderSidebar();
        // Hover-capable: opaque + fade (it overlays the row's end). Touch in a
        // wide list: transparent, no fade (it sits in the reserved 32px). Touch
        // in a compact list: overlay again, so the background comes back.
        const touch = rulesMatching("@media (hover: none)", "--ms-menu-reserve: 32px").join(" ");
        expect(touch).toContain("--ms-menu-bg: transparent");
        expect(touch).toContain("--ms-menu-fade: none");
        const compact = rulesMatching("@container ms-list (max-width: 299px)").join(" ");
        expect(compact).toMatch(/--ms-menu-bg: var\(--joy-palette-neutral-plainHoverBg/);
        expect(compact).toContain("--ms-menu-fade: -10px 0 8px 0");
        const list = document.querySelector("ul") as HTMLElement;
        expect(list.getAttribute("class")).toBeTruthy();
        expect(
            rulesMatching(END_BUTTON, "background-color: var(--ms-menu-bg)").length
        ).toBeGreaterThan(0);
    });

    it("keeps the Past-milestones rows (no menu) unreserved", () => {
        renderSidebar();
        fireEvent.click(screen.getByText("Past milestones"));
        fireEvent.click(screen.getByText("2026"));
        fireEvent.click(screen.getByText("Old sprint"));
        expect(rowOf("Archived").querySelector(".MuiListItem-endAction")).toBeNull();
        expect(getComputedStyle(buttonOf("Archived")).marginRight).toBe("0px");
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

    it("has a tighter indent tier below 200px: smaller steps and a smaller nested inset", () => {
        renderSidebar();
        const tight = rulesMatching("@container ms-list (max-width: 199px)").join(" ");
        expect(tight).toContain("--ms-indent-base: 16px");
        expect(tight).toContain("--ms-indent-step: 6px");
        expect(tight).toContain("--ms-btn-pl: 8px");
        expect(tight).toContain("--ms-btn-gap: 0px");
        expect(tight).toContain("--ms-li-pr: 0px");
        // The 299px tier from MIP-1012 is still there, untouched.
        expect(rulesMatching("@container ms-list (max-width: 299px)").join(" ")).toContain(
            "--ms-indent-base: 24px; --ms-indent-step: 8px;"
        );
    });

    it("applies the inset and right padding variables to every row kind, add rows too", () => {
        renderSidebar();
        // jsdom drops `var()` in padding shorthands from getComputedStyle, so
        // read the rule emotion generated for the element's own class.
        const ruleOf = (el: HTMLElement) => {
            const cls = [...el.classList].filter((c) => c.startsWith("css-"));
            return allRules()
                .filter((r) => cls.some((c) => r.startsWith(`.${c}`)))
                .join(" ");
        };
        for (const label of ["Unfiled one", "Q4", "Add milestone", "New folder"]) {
            expect(ruleOf(buttonOf(label))).toContain(
                "var(--ms-btn-pl, var(--ListItem-paddingLeft))"
            );
        }
        for (const label of ["Unfiled one", "Q4", "Add milestone", "New folder"]) {
            expect(ruleOf(rowOf(label))).toContain("var(--ms-li-pr, 8px)");
        }
    });
});
