// The milestone sidebar with folders (MIP-847): folders hold their live
// milestones (open by default), the rest follow, a Closed milestone in an
// ended sprint is only under Past milestones, and any member can create,
// rename, delete a folder and file a milestone ("Move to folder").

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MilestonesListItem } from "../features/tasks/components/sidebar/projects_subs/MilestonesListItem";
import type { Milestone, MilestoneFolder, Sprint } from "../features/tasks/sprint-milestone/types";

const P = 1;
const folder = (folderId: number, name: string): MilestoneFolder => ({
    folderId,
    projectId: P,
    name,
    sortOrder: folderId,
    tsCreatedAt: "",
    tsUpdatedAt: "",
});
const ms = (
    milestoneId: number,
    title: string,
    folderId: number | null,
    over: Partial<Milestone> = {}
): Milestone =>
    ({
        milestoneId,
        projectId: P,
        title,
        status: "Open",
        sprintId: null,
        folderId,
        isDeleted: false,
        dueDate: null,
        assignees: [],
        tasksClosed: 0,
        tasksTotal: 0,
        ...over,
    }) as unknown as Milestone;

const SPRINTS = [
    {
        sprintId: 1,
        name: "Old sprint",
        status: "archived",
        isDeleted: false,
        endDate: "2025-01-01",
    },
    { sprintId: 2, name: "Now", status: "active", isDeleted: false, endDate: "2026-12-31" },
] as unknown as Sprint[];

const makeSM = (milestones: Milestone[], folders: MilestoneFolder[]) => ({
    projectSprints: { [P]: SPRINTS },
    projectMilestones: { [P]: milestones },
    projectFolders: { [P]: folders },
    tsLastMilestonesLoaded: 1,
    loadFoldersForProject: vi.fn().mockResolvedValue(folders),
    milestoneFavorites: [],
    isMilestoneFavorited: () => false,
    toggleMilestoneFavorite: vi.fn(),
    noteMilestoneOpened: vi.fn(),
    createFolder: vi.fn().mockResolvedValue(folder(9, "New")),
    renameFolder: vi.fn().mockResolvedValue(folder(1, "Renamed")),
    removeFolder: vi.fn().mockResolvedValue(true),
    moveMilestoneToFolder: vi.fn().mockResolvedValue(null),
});

const renderSidebar = (sm: ReturnType<typeof makeSM>) =>
    render(
        <CssVarsProvider>
            <MilestonesListItem
                currentProjectId={P}
                myself={{ userId: "me" } as never}
                setMyself={vi.fn()}
                socket={null}
                useCM={{} as never}
                usePM={{ currentProject: { projectId: P }, teamProjects: [] } as never}
                useSM={sm as never}
                useTEM={{ teamMemberProfiles: {} } as never}
                useTM={{} as never}
                useUISM={{} as never}
            />
        </CssVarsProvider>
    );

const titles = () =>
    screen.queryAllByText(/^(Alpha|Beta|Gamma|Delta|Archived)$/).map((el) => el.textContent);

beforeEach(() => vi.clearAllMocks());

describe("MilestonesListItem — folders", () => {
    it("shows each folder open with its milestones, then the unfiled ones", () => {
        renderSidebar(
            makeSM(
                [ms(1, "Alpha", 1), ms(2, "Beta", null), ms(3, "Gamma", 2)],
                [folder(1, "Launch"), folder(2, "Growth")]
            )
        );
        // DOM order: Launch, Alpha, Growth, Gamma, (unfiled) Beta.
        expect(titles()).toEqual(["Alpha", "Gamma", "Beta"]);
        expect(screen.getByText("Launch")).toBeTruthy();
        expect(screen.getByText("Growth")).toBeTruthy();
        expect(screen.getByText("Not in a folder")).toBeTruthy();
    });

    it("lists milestones flat, with no unfiled caption, when there are no folders", () => {
        renderSidebar(makeSM([ms(1, "Alpha", null), ms(2, "Beta", null)], []));
        expect(titles()).toEqual(["Alpha", "Beta"]);
        expect(screen.queryByText("Not in a folder")).toBeNull();
    });

    it("shows an empty folder", () => {
        renderSidebar(makeSM([], [folder(1, "Empty")]));
        expect(screen.getByText("Empty")).toBeTruthy();
    });

    it("a Closed milestone in an ended sprint is not in its folder, only under Past milestones", () => {
        renderSidebar(
            makeSM(
                [ms(1, "Alpha", 1), ms(2, "Archived", 1, { status: "Closed", sprintId: 1 })],
                [folder(1, "Launch")]
            )
        );
        expect(titles()).toEqual(["Alpha"]);
        expect(screen.getByText("Past milestones")).toBeTruthy();
    });

    it("loads the project's folders", () => {
        const sm = makeSM([], []);
        renderSidebar(sm);
        expect(sm.loadFoldersForProject).toHaveBeenCalledWith(P);
    });

    it("Move to folder files a milestone into the chosen folder", async () => {
        const sm = makeSM([ms(1, "Alpha", null)], [folder(1, "Launch"), folder(2, "Growth")]);
        renderSidebar(sm);
        fireEvent.click(screen.getByLabelText(/Milestone actions: Alpha/));
        fireEvent.click(await screen.findByRole("menuitem", { name: "Growth" }));
        await waitFor(() => expect(sm.moveMilestoneToFolder).toHaveBeenCalledWith(1, 2));
    });

    it("Move to folder can take a milestone out of its folder", async () => {
        const sm = makeSM([ms(1, "Alpha", 1)], [folder(1, "Launch")]);
        renderSidebar(sm);
        fireEvent.click(screen.getByLabelText(/Milestone actions: Alpha/));
        fireEvent.click(await screen.findByRole("menuitem", { name: "No folder" }));
        await waitFor(() => expect(sm.moveMilestoneToFolder).toHaveBeenCalledWith(1, null));
    });

    it("the folder the milestone is already in is not offered again", async () => {
        const sm = makeSM([ms(1, "Alpha", 1)], [folder(1, "Launch"), folder(2, "Growth")]);
        renderSidebar(sm);
        fireEvent.click(screen.getByLabelText(/Milestone actions: Alpha/));
        const current = await screen.findByRole("menuitem", { name: "Launch" });
        expect(current.getAttribute("aria-disabled")).toBe("true");
    });

    it("New folder creates one in this project", async () => {
        const sm = makeSM([], []);
        renderSidebar(sm);
        fireEvent.click(screen.getByText("New folder"));
        const input = await screen.findByPlaceholderText("Folder name");
        fireEvent.change(input, { target: { value: "  Q4  " } });
        fireEvent.click(screen.getByRole("button", { name: "Create" }));
        await waitFor(() => expect(sm.createFolder).toHaveBeenCalledWith(P, "Q4"));
    });

    it("says so when the name is refused, and keeps the dialog open", async () => {
        const sm = makeSM([], []);
        sm.createFolder.mockResolvedValue(null as never);
        renderSidebar(sm);
        fireEvent.click(screen.getByText("New folder"));
        fireEvent.change(await screen.findByPlaceholderText("Folder name"), {
            target: { value: "Dup" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Create" }));
        await screen.findByText(/already exists/);
        expect(screen.getByPlaceholderText("Folder name")).toBeTruthy();
    });

    it("renames a folder, starting from its current name", async () => {
        const sm = makeSM([], [folder(1, "Launch")]);
        renderSidebar(sm);
        fireEvent.click(screen.getByLabelText(/Folder actions: Launch/));
        fireEvent.click(await screen.findByRole("menuitem", { name: "Rename folder" }));
        const input = (await screen.findByPlaceholderText("Folder name")) as HTMLInputElement;
        expect(input.value).toBe("Launch");
        fireEvent.change(input, { target: { value: "Q4" } });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() => expect(sm.renameFolder).toHaveBeenCalledWith(1, P, "Q4"));
    });

    it("deleting a folder asks first, and says the milestones are kept", async () => {
        const sm = makeSM([ms(1, "Alpha", 1)], [folder(1, "Launch")]);
        renderSidebar(sm);
        fireEvent.click(screen.getByLabelText(/Folder actions: Launch/));
        fireEvent.click(await screen.findByRole("menuitem", { name: "Delete folder" }));
        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).getByText(/are not deleted/)).toBeTruthy();
        expect(sm.removeFolder).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
        await waitFor(() => expect(sm.removeFolder).toHaveBeenCalledWith(1, P));
    });
});
