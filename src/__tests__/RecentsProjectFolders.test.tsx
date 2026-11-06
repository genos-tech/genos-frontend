/**
 * Sidebar Recents: project folders start closed, show five tasks, and "More"
 * reveals the rest of what is already loaded.
 *
 * The list used to open every project's folder with all of its (up to 20)
 * tasks, so a user in many projects got a wall of rows. Now:
 *   - every project folder starts CLOSED;
 *   - an opened folder shows the first 5, with a "More" row for the next 5 —
 *     no request, the 20 per project are already in memory;
 *   - the folder holding the task you have open opens by itself (sticky, like
 *     the notes sidebar's folders) and widens to include that row.
 *
 * "Closed" is asserted through `aria-expanded` and through the rows being
 * absent: this component does not mount a closed folder's rows.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RecentsListItem } from "../features/tasks/components/sidebar/RecentsListItem";
import {
    nextRecentsVisible,
    RECENTS_INITIAL_VISIBLE,
    RECENTS_MORE_STEP,
    RECENTS_PER_PROJECT,
    recentsVisibleToReveal,
} from "../features/tasks/utils/groupRecentTasks";
import { SearchTeamTasksResponse } from "../types/tasks";

// `count` tasks for one project, newest first. Titles are `<project> #<n>` with
// n = 1 the newest, so "row 7" is predictable.
const projectTasks = (
    projectId: number,
    projectName: string,
    count: number,
    newestAt: number
): SearchTeamTasksResponse[] =>
    Array.from({ length: count }, (_, i) => ({
        projectId,
        projectName,
        systemUserId: `sys-${projectId}`,
        projectTags: [],
        taskId: projectId * 1000 + i + 1,
        title: `${projectName} #${i + 1}`,
        status: { status: "open", color: "", textColor: "" },
        tsUpdated: new Date(newestAt - i * 60_000).toISOString(),
    })) as unknown as SearchTeamTasksResponse[];

const T0 = Date.UTC(2026, 0, 1);
// Website is the newest project, so it is listed first; Mobile (3 tasks) has
// nothing to reveal; Backend sits at the cap.
const website = projectTasks(10, "Website", 12, T0);
const mobile = projectTasks(20, "Mobile", 3, T0 - 3_600_000);
const backend = projectTasks(30, "Backend", RECENTS_PER_PROJECT, T0 - 7_200_000);
const ALL = [...website, ...mobile, ...backend];

const setup = (overrides: { recentTasks?: SearchTeamTasksResponse[]; selected?: number } = {}) => {
    const usePM = { setCurrentProject: vi.fn() };
    const useTMBase = {
        setCurrentPreviewTaskId: vi.fn(),
        setIsTaskPreviewVisible: vi.fn(),
    };
    const ui = (recentTasks: SearchTeamTasksResponse[], selected: number) => (
        <CssVarsProvider>
            <RecentsListItem
                recentTasks={recentTasks}
                usePM={usePM as never}
                useTM={{ ...useTMBase, currentPreviewTaskId: selected } as never}
            />
        </CssVarsProvider>
    );
    const view = render(ui(overrides.recentTasks ?? ALL, overrides.selected ?? -1));
    return {
        usePM,
        useTM: useTMBase,
        rerender: (recentTasks: SearchTeamTasksResponse[], selected: number) =>
            view.rerender(ui(recentTasks, selected)),
    };
};

// A folder's header is the button that carries `aria-expanded`.
const header = (projectName: string): HTMLElement => {
    const el = screen
        .getAllByRole("button")
        .find((b) => b.hasAttribute("aria-expanded") && b.textContent?.startsWith(projectName));
    if (!el) throw new Error(`no folder header for ${projectName}`);
    return el;
};

const rowsOf = (projectName: string) =>
    screen.queryAllByText(new RegExp(`^${projectName} #\\d+$`));
const moreButton = (projectName: string) =>
    screen.queryByRole("button", { name: `More (${projectName})` });

// A folder remembers whether it is open (MIP-1055), and jsdom's storage lasts for
// the whole file: each test starts from the defaults.
beforeEach(() => localStorage.clear());

describe("Recents project folders", () => {
    it("starts every project folder closed, with no task rows mounted", () => {
        setup();
        for (const name of ["Website", "Mobile", "Backend"]) {
            expect(header(name).getAttribute("aria-expanded")).toBe("false");
        }
        expect(screen.queryAllByText(/#\d+$/)).toHaveLength(0);
        expect(screen.queryByRole("button", { name: /^More/ })).toBeNull();
    });

    it("shows the task count on the folder header, closed or not", () => {
        setup();
        expect(header("Website").textContent).toContain("12");
        expect(header("Mobile").textContent).toContain("3");
        expect(header("Backend").textContent).toContain(String(RECENTS_PER_PROJECT));
    });

    it("opens to the first five tasks, newest first, with a More row", () => {
        setup();
        fireEvent.click(header("Website"));

        expect(header("Website").getAttribute("aria-expanded")).toBe("true");
        expect(rowsOf("Website").map((n) => n.textContent)).toEqual([
            "Website #1",
            "Website #2",
            "Website #3",
            "Website #4",
            "Website #5",
        ]);
        expect(moreButton("Website")).not.toBeNull();
        // The other folders are untouched.
        expect(header("Backend").getAttribute("aria-expanded")).toBe("false");
        expect(rowsOf("Backend")).toHaveLength(0);
    });

    it("has no More row when the project has no more than five tasks", () => {
        setup();
        fireEvent.click(header("Mobile"));
        expect(rowsOf("Mobile")).toHaveLength(3);
        expect(moreButton("Mobile")).toBeNull();
    });

    it("More reveals five at a time and goes away once everything is shown", () => {
        setup();
        fireEvent.click(header("Website")); // 12 tasks loaded
        expect(rowsOf("Website")).toHaveLength(RECENTS_INITIAL_VISIBLE);

        fireEvent.click(moreButton("Website")!);
        expect(rowsOf("Website")).toHaveLength(RECENTS_INITIAL_VISIBLE + RECENTS_MORE_STEP);
        expect(moreButton("Website")).not.toBeNull();

        fireEvent.click(moreButton("Website")!);
        // 12 loaded: the last click stops at what exists, it does not invent rows.
        expect(rowsOf("Website")).toHaveLength(12);
        expect(moreButton("Website")).toBeNull();
    });

    it("never goes past the per-project cap", () => {
        setup();
        fireEvent.click(header("Backend"));
        for (let i = 0; i < 10 && moreButton("Backend"); i++) {
            fireEvent.click(moreButton("Backend")!);
        }
        expect(rowsOf("Backend")).toHaveLength(RECENTS_PER_PROJECT);
        expect(moreButton("Backend")).toBeNull();
    });

    it("keeps one folder's reveal separate from another's", () => {
        setup();
        fireEvent.click(header("Website"));
        fireEvent.click(header("Backend"));
        fireEvent.click(moreButton("Website")!);
        expect(rowsOf("Website")).toHaveLength(10);
        expect(rowsOf("Backend")).toHaveLength(RECENTS_INITIAL_VISIBLE);
    });

    it("collapsing hides the rows again, and reopening keeps what More revealed", () => {
        setup();
        fireEvent.click(header("Website"));
        fireEvent.click(moreButton("Website")!);
        fireEvent.click(header("Website"));
        expect(header("Website").getAttribute("aria-expanded")).toBe("false");
        expect(rowsOf("Website")).toHaveLength(0);

        fireEvent.click(header("Website"));
        expect(rowsOf("Website")).toHaveLength(10);
    });

    it("opens the task and its project when a row is clicked", () => {
        const { usePM, useTM } = setup();
        fireEvent.click(header("Mobile"));
        fireEvent.click(screen.getByText("Mobile #2"));

        expect(usePM.setCurrentProject).toHaveBeenCalledWith({
            projectId: 20,
            projectName: "Mobile",
            projectTags: [],
            systemUserId: "sys-20",
        });
        expect(useTM.setCurrentPreviewTaskId).toHaveBeenCalledWith(20002);
        expect(useTM.setIsTaskPreviewVisible).toHaveBeenCalledWith(true);
    });
});

describe("Recents: the open task's folder", () => {
    it("opens by itself when the open task lives in a closed folder, and marks the row", () => {
        setup({ selected: 20002 }); // Mobile #2
        expect(header("Mobile").getAttribute("aria-expanded")).toBe("true");
        expect(header("Website").getAttribute("aria-expanded")).toBe("false");
        expect(header("Backend").getAttribute("aria-expanded")).toBe("false");

        const current = screen
            .getAllByRole("button")
            .filter((b) => b.getAttribute("aria-current") === "true");
        expect(current).toHaveLength(1);
        expect(current[0].textContent).toContain("Mobile #2");
    });

    it("widens the folder to include a selected task that is behind More", () => {
        setup({ selected: 10007 }); // Website #7 -> rows 1..10
        expect(header("Website").getAttribute("aria-expanded")).toBe("true");
        expect(rowsOf("Website")).toHaveLength(10);
        expect(screen.getByText("Website #7")).toBeTruthy();
        expect(moreButton("Website")).not.toBeNull();
    });

    it("opens when the selection moves into a closed folder later", () => {
        const { rerender } = setup();
        expect(header("Backend").getAttribute("aria-expanded")).toBe("false");

        rerender(ALL, 30003);
        expect(header("Backend").getAttribute("aria-expanded")).toBe("true");
        expect(screen.getByText("Backend #3")).toBeTruthy();
        expect(header("Website").getAttribute("aria-expanded")).toBe("false");
    });

    it("opens once the open task arrives in a reloaded list", () => {
        // Recents reloads after the selection changes, so the row is often not
        // there on the first render.
        const withoutIt = ALL.filter((t) => t.taskId !== 30002);
        const { rerender } = setup({ recentTasks: withoutIt, selected: 30002 });
        expect(header("Backend").getAttribute("aria-expanded")).toBe("false");

        rerender(ALL, 30002);
        expect(header("Backend").getAttribute("aria-expanded")).toBe("true");
    });

    it("does not re-open a folder the user closed when the list reloads", () => {
        const { rerender } = setup({ selected: 20002 });
        fireEvent.click(header("Mobile"));
        expect(header("Mobile").getAttribute("aria-expanded")).toBe("false");

        // A save reloads Recents (a new array) and bumps the open task's
        // `tsUpdated`, so it floats to the top (index 1 -> 0); the selection
        // itself has not changed.
        const saved = ALL.map((t) =>
            t.taskId === 20002 ? { ...t, tsUpdated: new Date(T0 + 1000).toISOString() } : t
        );
        rerender(saved, 20002);
        expect(header("Mobile").getAttribute("aria-expanded")).toBe("false");
    });

    it("leaves every folder closed when nothing is open, or the open task is not in Recents", () => {
        setup({ selected: 999999 });
        for (const name of ["Website", "Mobile", "Backend"]) {
            expect(header(name).getAttribute("aria-expanded")).toBe("false");
        }
        expect(
            screen.queryAllByRole("button").filter((b) => b.hasAttribute("aria-current"))
        ).toEqual([]);
    });
});

describe("recents paging helpers", () => {
    it("More adds one page and stops at what is loaded", () => {
        expect(nextRecentsVisible(5, 20)).toBe(10);
        expect(nextRecentsVisible(10, 12)).toBe(12);
        expect(nextRecentsVisible(12, 12)).toBe(12);
    });

    it("reveals a row by growing in whole pages, and never shrinks", () => {
        expect(recentsVisibleToReveal(5, 2)).toBe(5); // already visible
        expect(recentsVisibleToReveal(5, 4)).toBe(5); // last visible row
        expect(recentsVisibleToReveal(5, 5)).toBe(10); // first hidden row
        expect(recentsVisibleToReveal(5, 17)).toBe(20);
        expect(recentsVisibleToReveal(15, 6)).toBe(15); // user already widened it
        expect(recentsVisibleToReveal(5, -1)).toBe(5); // not in this folder
    });
});
