// Milestone folder state in useSprintMilestoneManagement (MIP-847): load,
// create, rename, delete (unfiles locally), and filing a milestone.

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Milestone, MilestoneFolder } from "../features/tasks/sprint-milestone/types";
import { useSprintMilestoneManagement } from "../hooks/tasks/useSprintMilestoneManagement";

const svc = {
    loadMilestoneFolders: vi.fn(),
    createMilestoneFolder: vi.fn(),
    updateMilestoneFolder: vi.fn(),
    deleteMilestoneFolder: vi.fn(),
    updateMilestone: vi.fn(),
    loadProjectMilestones: vi.fn(),
};
vi.mock("../features/tasks/sprint-milestone/services", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    loadMilestoneFolders: (...a: unknown[]) => svc.loadMilestoneFolders(...a),
    createMilestoneFolder: (...a: unknown[]) => svc.createMilestoneFolder(...a),
    updateMilestoneFolder: (...a: unknown[]) => svc.updateMilestoneFolder(...a),
    deleteMilestoneFolder: (...a: unknown[]) => svc.deleteMilestoneFolder(...a),
    updateMilestone: (...a: unknown[]) => svc.updateMilestone(...a),
    loadProjectMilestones: (...a: unknown[]) => svc.loadProjectMilestones(...a),
}));

const P = 1;
const folder = (folderId: number, name: string): MilestoneFolder => ({
    folderId,
    projectId: P,
    name,
    sortOrder: folderId,
    tsCreatedAt: "",
    tsUpdatedAt: "",
});
const ms = (milestoneId: number, folderId: number | null): Milestone =>
    ({
        milestoneId,
        projectId: P,
        title: `M${milestoneId}`,
        status: "Open",
        sprintId: null,
        folderId,
        isDeleted: false,
        assignees: [],
    }) as unknown as Milestone;

const setup = async (milestones: Milestone[] = [], folders: MilestoneFolder[] = []) => {
    svc.loadProjectMilestones.mockResolvedValue({ milestones });
    svc.loadMilestoneFolders.mockResolvedValue({ folders });
    const hook = renderHook(() => useSprintMilestoneManagement("tok"));
    await act(async () => {
        await hook.result.current.loadMilestonesForProject(P);
        await hook.result.current.loadFoldersForProject(P);
    });
    return hook;
};

beforeEach(() => vi.resetAllMocks());

describe("milestone folders in useSprintMilestoneManagement", () => {
    it("loads a project's folders", async () => {
        const { result } = await setup([], [folder(1, "Launch")]);
        expect(result.current.projectFolders[P].map((f) => f.name)).toEqual(["Launch"]);
    });

    it("a failed load keeps the folders it already had", async () => {
        const hook = await setup([], [folder(1, "Launch")]);
        svc.loadMilestoneFolders.mockResolvedValue(undefined);
        await act(async () => {
            await hook.result.current.loadFoldersForProject(P);
        });
        expect(hook.result.current.projectFolders[P].map((f) => f.name)).toEqual(["Launch"]);
    });

    it("creates a folder and appends it", async () => {
        const hook = await setup([], [folder(1, "Launch")]);
        svc.createMilestoneFolder.mockResolvedValue(folder(2, "Growth"));
        let created: MilestoneFolder | null = null;
        await act(async () => {
            created = await hook.result.current.createFolder(P, "Growth");
        });
        expect(svc.createMilestoneFolder).toHaveBeenCalledWith(P, "Growth", "tok");
        expect(created).toMatchObject({ folderId: 2 });
        expect(hook.result.current.projectFolders[P].map((f) => f.name)).toEqual([
            "Launch",
            "Growth",
        ]);
    });

    it("a refused create (duplicate name) returns null and changes nothing", async () => {
        const hook = await setup([], [folder(1, "Launch")]);
        svc.createMilestoneFolder.mockResolvedValue(undefined);
        let created: MilestoneFolder | null = folder(0, "x");
        await act(async () => {
            created = await hook.result.current.createFolder(P, "Launch");
        });
        expect(created).toBeNull();
        expect(hook.result.current.projectFolders[P]).toHaveLength(1);
    });

    it("renames a folder in place", async () => {
        const hook = await setup([], [folder(1, "Launch"), folder(2, "Growth")]);
        svc.updateMilestoneFolder.mockResolvedValue(folder(1, "Q4"));
        await act(async () => {
            await hook.result.current.renameFolder(1, P, "Q4");
        });
        expect(hook.result.current.projectFolders[P].map((f) => f.name)).toEqual(["Q4", "Growth"]);
    });

    it("deleting a folder unfiles its milestones locally and keeps every milestone", async () => {
        const hook = await setup(
            [ms(1, 1), ms(2, 2), ms(3, null)],
            [folder(1, "A"), folder(2, "B")]
        );
        svc.deleteMilestoneFolder.mockResolvedValue(true);
        await act(async () => {
            await hook.result.current.removeFolder(1, P);
        });
        expect(hook.result.current.projectFolders[P].map((f) => f.folderId)).toEqual([2]);
        const byId = Object.fromEntries(
            hook.result.current.projectMilestones[P].map((m) => [m.milestoneId, m.folderId])
        );
        expect(byId).toEqual({ 1: null, 2: 2, 3: null });
    });

    it("a failed delete leaves folder and milestones alone", async () => {
        const hook = await setup([ms(1, 1)], [folder(1, "A")]);
        svc.deleteMilestoneFolder.mockResolvedValue(false);
        let ok = true;
        await act(async () => {
            ok = await hook.result.current.removeFolder(1, P);
        });
        expect(ok).toBe(false);
        expect(hook.result.current.projectFolders[P]).toHaveLength(1);
        expect(hook.result.current.projectMilestones[P][0].folderId).toBe(1);
    });

    it("files a milestone into a folder, and out again", async () => {
        const hook = await setup([ms(1, null)], [folder(5, "A")]);
        svc.updateMilestone.mockResolvedValue({ milestone: ms(1, 5) });
        await act(async () => {
            await hook.result.current.moveMilestoneToFolder(1, 5);
        });
        expect(svc.updateMilestone).toHaveBeenCalledWith({ milestoneId: 1, folderId: 5 }, "tok");
        expect(hook.result.current.projectMilestones[P][0].folderId).toBe(5);

        svc.updateMilestone.mockResolvedValue({ milestone: ms(1, null) });
        await act(async () => {
            await hook.result.current.moveMilestoneToFolder(1, null);
        });
        expect(svc.updateMilestone).toHaveBeenLastCalledWith(
            { milestoneId: 1, folderId: null },
            "tok"
        );
        expect(hook.result.current.projectMilestones[P][0].folderId).toBeNull();
    });

    it("a failed move leaves the milestone where it was", async () => {
        const hook = await setup([ms(1, 5)], [folder(5, "A")]);
        svc.updateMilestone.mockResolvedValue(undefined);
        await act(async () => {
            await hook.result.current.moveMilestoneToFolder(1, null);
        });
        expect(hook.result.current.projectMilestones[P][0].folderId).toBe(5);
    });
});
