// MIP-1053: milestone favorites in the task sidebar.
//   - a "Favorites" folder above Recents, most recent first, that does what a
//     click on the milestone in its project does;
//   - a star on every milestone row (and a menu item) that toggles it;
//   - a favorite moves to the top whenever its milestone is opened.

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FavoritesListItem } from "../features/tasks/components/sidebar/FavoritesListItem";
import { MilestonesListItem } from "../features/tasks/components/sidebar/projects_subs/MilestonesListItem";
import type { Milestone, MilestoneFavorite } from "../features/tasks/sprint-milestone/types";

const ALPHA = { projectId: 1, projectName: "Alpha" };
const BETA = { projectId: 2, projectName: "Beta" };

const fav = (milestoneId: number, projectId: number, title: string): MilestoneFavorite => ({
    milestoneId,
    taskId: null,
    displayId: null,
    title,
    status: "WIP",
    projectId,
    projectName: projectId === 1 ? "Alpha" : "Beta",
    teamId: null,
    tsFavorited: "",
    tsLastOpened: null,
});
const ms = (milestoneId: number, title: string, over: Partial<Milestone> = {}): Milestone =>
    ({
        milestoneId,
        projectId: 1,
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

const fns = () => ({
    openProject: vi.fn(),
    closeTaskPreview: vi.fn(),
    setTableMilestoneFilter: vi.fn(),
    setCurrentPreviewKind: vi.fn(),
    setCurrentPreviewMilestoneId: vi.fn(),
    setIsTaskPreviewVisible: vi.fn(),
    toggleMilestoneFavorite: vi.fn(),
    noteMilestoneOpened: vi.fn(),
});
let f: ReturnType<typeof fns>;
beforeEach(() => {
    f = fns();
});

type FavProps = {
    favorites?: MilestoneFavorite[];
    projects?: { projectId: number; projectName: string }[];
    currentProjectId?: number;
    milestones?: Record<number, Milestone[]>;
    tm?: Record<string, unknown>;
};
const mountFavorites = (p: FavProps = {}) =>
    render(
        <CssVarsProvider>
            <FavoritesListItem
                usePM={
                    {
                        teamProjects: p.projects ?? [ALPHA, BETA],
                        currentProject: { projectId: p.currentProjectId ?? 1 },
                        openProject: f.openProject,
                    } as never
                }
                useSM={
                    {
                        milestoneFavorites: p.favorites ?? [],
                        projectMilestones: p.milestones ?? {},
                        toggleMilestoneFavorite: f.toggleMilestoneFavorite,
                        noteMilestoneOpened: f.noteMilestoneOpened,
                    } as never
                }
                useTM={
                    {
                        currentPreviewKind: "task",
                        currentPreviewMilestoneId: -1,
                        tableMilestoneFilterId: null,
                        closeTaskPreview: f.closeTaskPreview,
                        setTableMilestoneFilter: f.setTableMilestoneFilter,
                        setCurrentPreviewKind: f.setCurrentPreviewKind,
                        setCurrentPreviewMilestoneId: f.setCurrentPreviewMilestoneId,
                        setIsTaskPreviewVisible: f.setIsTaskPreviewVisible,
                        ...p.tm,
                    } as never
                }
            />
        </CssVarsProvider>
    );
const rowButton = (title: string) =>
    screen.getByText(title).closest(".MuiListItemButton-root") as HTMLElement;

describe("the Favorites folder", () => {
    it("is not there when there are no favorites", () => {
        mountFavorites();
        expect(screen.queryByText("Favorites")).toBeNull();
    });

    it("starts open, and a folder the user closes stays closed after a reload (MIP-1055)", () => {
        localStorage.clear();
        // A closed `Toggler` keeps its rows mounted and collapses them to zero
        // height, so "open" is the grid wrapper's row size.
        const isOpen = () =>
            getComputedStyle(
                screen.getByText("Alpha launch").closest("ul")?.parentElement as HTMLElement
            ).gridTemplateRows === "1fr";
        const first = mountFavorites({ favorites: [fav(1, 1, "Alpha launch")] });
        expect(isOpen()).toBe(true);
        fireEvent.click(screen.getByText("Favorites"));
        expect(isOpen()).toBe(false);
        first.unmount();
        mountFavorites({ favorites: [fav(1, 1, "Alpha launch")] });
        expect(isOpen()).toBe(false);
        localStorage.clear();
    });

    it("lists the favorites in the order it was given, with project and status", () => {
        mountFavorites({ favorites: [fav(2, 2, "Beta launch"), fav(1, 1, "Alpha launch")] });
        expect(screen.getByText("Favorites")).toBeTruthy();
        const titles = screen
            .getAllByTestId(/^favorite-milestone-/)
            .map((li) => li.getAttribute("data-testid"));
        expect(titles).toEqual(["favorite-milestone-2", "favorite-milestone-1"]);
        const row = screen.getByTestId("favorite-milestone-2");
        expect(within(row).getByText("Beta")).toBeTruthy();
        // The status is the icon with its name (the same as in Recents), not the word:
        // MIP-1157, the two lists drew the same status differently.
        expect(within(row).getByRole("img", { name: "WIP" })).toBeTruthy();
        expect(within(row).queryByText("WIP")).toBeNull();
    });

    it("hides a favorite whose project this sidebar does not list", () => {
        mountFavorites({
            favorites: [fav(1, 1, "Alpha launch"), fav(5, 99, "Other team's")],
        });
        expect(screen.getByText("Alpha launch")).toBeTruthy();
        expect(screen.queryByText("Other team's")).toBeNull();
    });

    it("shows the live title when its project is loaded, so a rename needs no reload", () => {
        mountFavorites({
            favorites: [fav(1, 1, "Old name")],
            milestones: { 1: [ms(1, "New name", { status: "Closed" })] },
        });
        expect(screen.getByText("New name")).toBeTruthy();
        expect(screen.queryByText("Old name")).toBeNull();
        expect(screen.getByRole("img", { name: "Closed" })).toBeTruthy();
    });

    it("a click in the open project opens the preview and scopes the table to it", () => {
        mountFavorites({ favorites: [fav(1, 1, "Alpha launch")] });
        fireEvent.click(rowButton("Alpha launch"));
        expect(f.openProject).not.toHaveBeenCalled();
        expect(f.setCurrentPreviewKind).toHaveBeenCalledWith("milestone");
        expect(f.setCurrentPreviewMilestoneId).toHaveBeenCalledWith(1);
        expect(f.setIsTaskPreviewVisible).toHaveBeenCalledWith(true);
        expect(f.setTableMilestoneFilter).toHaveBeenCalledWith({ milestoneId: 1, projectId: 1 });
    });

    it("clicking the milestone that is already scoped lifts the scope, like the tree does", () => {
        mountFavorites({
            favorites: [fav(1, 1, "Alpha launch")],
            tm: { tableMilestoneFilterId: 1 },
        });
        fireEvent.click(rowButton("Alpha launch"));
        expect(f.setTableMilestoneFilter).toHaveBeenCalledWith(null);
        expect(f.setIsTaskPreviewVisible).toHaveBeenCalledWith(true);
    });

    it("a click in another project switches to it first, and always scopes on", () => {
        mountFavorites({
            favorites: [fav(2, 2, "Beta launch")],
            // Even if this id were scoped, a project switch scopes on.
            tm: { tableMilestoneFilterId: 2 },
        });
        fireEvent.click(rowButton("Beta launch"));
        expect(f.closeTaskPreview).toHaveBeenCalledTimes(1);
        expect(f.openProject).toHaveBeenCalledWith(BETA);
        expect(f.setTableMilestoneFilter).toHaveBeenNthCalledWith(1, null);
        expect(f.setTableMilestoneFilter).toHaveBeenLastCalledWith({
            milestoneId: 2,
            projectId: 2,
        });
        expect(f.setCurrentPreviewMilestoneId).toHaveBeenCalledWith(2);
    });

    it("marks the open milestone as selected", () => {
        mountFavorites({
            favorites: [fav(1, 1, "Alpha launch"), fav(2, 2, "Beta launch")],
            tm: { currentPreviewKind: "milestone", currentPreviewMilestoneId: 2 },
        });
        expect(rowButton("Beta launch").classList.contains("Mui-selected")).toBe(true);
        expect(rowButton("Alpha launch").classList.contains("Mui-selected")).toBe(false);
    });

    it("the star on a favorite removes it, and does not open it", () => {
        mountFavorites({ favorites: [fav(1, 1, "Alpha launch")] });
        fireEvent.click(screen.getByLabelText("Remove from favorites: Alpha launch"));
        expect(f.toggleMilestoneFavorite).toHaveBeenCalledWith(
            expect.objectContaining({ milestoneId: 1, projectId: 1 })
        );
        expect(f.setIsTaskPreviewVisible).not.toHaveBeenCalled();
    });

    it("tells the store when a milestone is opened, whichever route opened it", () => {
        mountFavorites({
            favorites: [fav(1, 1, "Alpha launch")],
            tm: { currentPreviewKind: "milestone", currentPreviewMilestoneId: 1 },
        });
        expect(f.noteMilestoneOpened).toHaveBeenCalledTimes(1);
        expect(f.noteMilestoneOpened).toHaveBeenCalledWith(1);
    });

    it("does not report a task preview as a milestone opening", () => {
        mountFavorites({
            favorites: [fav(1, 1, "Alpha launch")],
            tm: { currentPreviewKind: "task", currentPreviewMilestoneId: 1 },
        });
        expect(f.noteMilestoneOpened).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------- tree rows

const P = 1;
const mountTree = (favorited: number[] = []) =>
    render(
        <CssVarsProvider>
            <MilestonesListItem
                currentProjectId={P}
                myself={{ userId: "me" } as never}
                useTEM={{ teamMemberProfiles: {} } as never}
                usePM={
                    {
                        currentProject: { projectId: P },
                        teamProjects: [],
                        openProject: f.openProject,
                    } as never
                }
                useSM={
                    {
                        projectSprints: { [P]: [] },
                        projectMilestones: { [P]: [ms(1, "Launch"), ms(2, "Beta")] },
                        projectFolders: { [P]: [] },
                        tsLastMilestonesLoaded: 1,
                        loadFoldersForProject: vi.fn().mockResolvedValue([]),
                        moveMilestoneToFolder: vi.fn(),
                        milestoneFavorites: [],
                        isMilestoneFavorited: (id: number) => favorited.includes(id),
                        toggleMilestoneFavorite: f.toggleMilestoneFavorite,
                        noteMilestoneOpened: f.noteMilestoneOpened,
                    } as never
                }
                useTM={
                    {
                        closeTaskPreview: f.closeTaskPreview,
                        setTableMilestoneFilter: f.setTableMilestoneFilter,
                        setCurrentPreviewKind: f.setCurrentPreviewKind,
                        setCurrentPreviewMilestoneId: f.setCurrentPreviewMilestoneId,
                        setIsTaskPreviewVisible: f.setIsTaskPreviewVisible,
                    } as never
                }
            />
        </CssVarsProvider>
    );
const liOf = (title: string) => screen.getByText(title).closest("li") as HTMLElement;

describe("the star on a milestone row", () => {
    it("is a button on a row that is not a favorite yet; a favorite has none (MIP-1156)", () => {
        mountTree([2]);
        const launch = within(liOf("Launch")).getByTestId("milestone-favorite-star");
        expect(launch.getAttribute("aria-pressed")).toBe("false");
        expect(launch.getAttribute("aria-label")).toBe("Add to favorites: Launch");
        // A favorite shows its lit star after the title at rest and hides it on hover, where the
        // buttons are the "..." menu alone: "Remove from favorites" is in that menu.
        expect(within(liOf("Beta")).queryByTestId("milestone-favorite-star")).toBeNull();
        expect(within(liOf("Beta")).queryByTestId("milestone-favorite-mark")).not.toBeNull();
    });

    it("toggles the milestone and does not open it", () => {
        mountTree();
        fireEvent.click(within(liOf("Launch")).getByTestId("milestone-favorite-star"));
        expect(f.toggleMilestoneFavorite).toHaveBeenCalledWith(
            expect.objectContaining({ milestoneId: 1, title: "Launch", projectId: 1 })
        );
        expect(f.setIsTaskPreviewVisible).not.toHaveBeenCalled();
    });

    it("a starred row carries a small star after its title; others do not", () => {
        mountTree([2]);
        expect(within(liOf("Beta")).queryByTestId("milestone-favorite-mark")).not.toBeNull();
        expect(within(liOf("Launch")).queryByTestId("milestone-favorite-mark")).toBeNull();
    });

    it("the row's menu offers Add to favorites / Remove from favorites", () => {
        mountTree([2]);
        const menuOf = (title: string) =>
            liOf(title).querySelector(
                '.NavItem-actions button[aria-haspopup="menu"]'
            ) as HTMLElement;
        fireEvent.click(menuOf("Launch"));
        fireEvent.click(screen.getByText("Add to favorites"));
        expect(f.toggleMilestoneFavorite).toHaveBeenCalledWith(
            expect.objectContaining({ milestoneId: 1 })
        );
        fireEvent.click(menuOf("Beta"));
        expect(screen.getByText("Remove from favorites")).toBeTruthy();
    });

    it("clicking the row itself still opens the milestone (the shared helper)", () => {
        mountTree();
        fireEvent.click(liOf("Launch").querySelector(".MuiListItemButton-root") as HTMLElement);
        expect(f.setCurrentPreviewKind).toHaveBeenCalledWith("milestone");
        expect(f.setTableMilestoneFilter).toHaveBeenCalledWith({ milestoneId: 1, projectId: 1 });
    });
});
