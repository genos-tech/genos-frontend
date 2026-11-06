// Milestone favorites state in useSprintMilestoneManagement (MIP-1053): load on
// mount, star / unstar with the star showing at once, and the "I opened it"
// bump that moves a favorite to the top.

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MilestoneFavorite } from "../features/tasks/sprint-milestone/types";
import { useSprintMilestoneManagement } from "../hooks/tasks/useSprintMilestoneManagement";

const svc = {
    loadMilestoneFavorites: vi.fn(),
    setMilestoneFavorite: vi.fn(),
    markMilestoneOpened: vi.fn(),
};
vi.mock("../features/tasks/sprint-milestone/services", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    loadMilestoneFavorites: (...a: unknown[]) => svc.loadMilestoneFavorites(...a),
    setMilestoneFavorite: (...a: unknown[]) => svc.setMilestoneFavorite(...a),
    markMilestoneOpened: (...a: unknown[]) => svc.markMilestoneOpened(...a),
}));

const fav = (milestoneId: number, title = `M${milestoneId}`): MilestoneFavorite => ({
    milestoneId,
    taskId: milestoneId + 1000,
    displayId: `GEN-${milestoneId}`,
    title,
    status: "Open",
    projectId: 1,
    projectName: "Genos",
    teamId: "t1",
    tsFavorited: "2026-11-06T00:00:00Z",
    tsLastOpened: null,
});
const ids = (r: { current: { milestoneFavorites: MilestoneFavorite[] } }) =>
    r.current.milestoneFavorites.map((f) => f.milestoneId);

const setup = async (server: MilestoneFavorite[] = [], token: string | null = "tok") => {
    svc.loadMilestoneFavorites.mockResolvedValue({ favorites: server });
    const hook = renderHook(() => useSprintMilestoneManagement(token));
    await act(async () => {});
    return hook;
};

beforeEach(() => vi.resetAllMocks());

describe("milestone favorites in useSprintMilestoneManagement", () => {
    it("loads the user's favorites on mount", async () => {
        const { result } = await setup([fav(2), fav(1)]);
        expect(ids(result)).toEqual([2, 1]);
        expect(result.current.isMilestoneFavorited(2)).toBe(true);
        expect(result.current.isMilestoneFavorited(9)).toBe(false);
    });

    it("loads nothing before there is a token", async () => {
        const { result } = await setup([fav(1)], null);
        expect(svc.loadMilestoneFavorites).not.toHaveBeenCalled();
        expect(ids(result)).toEqual([]);
    });

    it("a failed read keeps the list it had", async () => {
        const hook = await setup([fav(2), fav(1)]);
        svc.loadMilestoneFavorites.mockResolvedValue(undefined);
        svc.setMilestoneFavorite.mockResolvedValue(true);
        await act(async () => {
            await hook.result.current.toggleMilestoneFavorite({
                milestoneId: 1,
                title: "M1",
                projectId: 1,
                status: "Open",
            });
        });
        // The server says it is still starred... and the re-read failed: the list
        // is not blanked by it.
        expect(ids(hook.result)).toEqual([2]);
        expect(svc.loadMilestoneFavorites).toHaveBeenCalledTimes(2);
    });

    it("stars at once (before the server answers) and re-reads to fill in the rest", async () => {
        const hook = await setup([fav(1)]);
        let release: (v: boolean) => void = () => {};
        svc.setMilestoneFavorite.mockReturnValue(new Promise<boolean>((r) => (release = r)));
        svc.loadMilestoneFavorites.mockResolvedValue({ favorites: [fav(7, "Seven"), fav(1)] });

        let pending: Promise<void> = Promise.resolve();
        act(() => {
            pending = hook.result.current.toggleMilestoneFavorite({
                milestoneId: 7,
                title: "Seven",
                projectId: 1,
                status: "WIP",
                taskId: 1007,
                displayId: "GEN-7",
            });
        });
        // Before the POST resolves: already on the list, at the top.
        expect(ids(hook.result)).toEqual([7, 1]);
        expect(hook.result.current.isMilestoneFavorited(7)).toBe(true);
        expect(hook.result.current.milestoneFavorites[0].projectName).toBe("");

        await act(async () => {
            release(true);
            await pending;
        });
        expect(svc.setMilestoneFavorite).toHaveBeenCalledWith(7, true, "tok");
        expect(hook.result.current.milestoneFavorites[0].projectName).toBe("Genos");
    });

    it("unstars at once, and calls the server to remove it", async () => {
        const hook = await setup([fav(2), fav(1)]);
        svc.setMilestoneFavorite.mockResolvedValue(false);
        svc.loadMilestoneFavorites.mockResolvedValue({ favorites: [fav(1)] });
        await act(async () => {
            await hook.result.current.toggleMilestoneFavorite({
                milestoneId: 2,
                title: "M2",
                projectId: 1,
                status: "Open",
            });
        });
        expect(svc.setMilestoneFavorite).toHaveBeenCalledWith(2, false, "tok");
        expect(ids(hook.result)).toEqual([1]);
    });

    it.each([
        ["unstar", [fav(2), fav(1)], 2],
        ["star", [fav(2), fav(1)], 9],
    ])("puts the list back when the %s call fails, with no re-read", async (_n, server, id) => {
        const hook = await setup(server);
        svc.setMilestoneFavorite.mockResolvedValue(null);
        await act(async () => {
            await hook.result.current.toggleMilestoneFavorite({
                milestoneId: id,
                title: `M${id}`,
                projectId: 1,
                status: "Open",
            });
        });
        expect(ids(hook.result)).toEqual([2, 1]);
        // Only the load on mount.
        expect(svc.loadMilestoneFavorites).toHaveBeenCalledTimes(1);
    });

    it("opening a favorite moves it to the top and tells the server", async () => {
        const hook = await setup([fav(3), fav(2), fav(1)]);
        svc.markMilestoneOpened.mockResolvedValue(true);
        act(() => hook.result.current.noteMilestoneOpened(1));
        expect(ids(hook.result)).toEqual([1, 3, 2]);
        expect(hook.result.current.milestoneFavorites[0].tsLastOpened).not.toBeNull();
        await waitFor(() => expect(svc.markMilestoneOpened).toHaveBeenCalledWith(1, "tok"));
    });

    it("opening a milestone that is not a favorite changes nothing and sends nothing", async () => {
        const hook = await setup([fav(2), fav(1)]);
        act(() => hook.result.current.noteMilestoneOpened(99));
        expect(ids(hook.result)).toEqual([2, 1]);
        expect(svc.markMilestoneOpened).not.toHaveBeenCalled();
    });
});
