/**
 * MIP-970's table: which loaders each `/changes/` token drives. App builds its
 * loader groups through `buildChangeLoaderGroups`, so this pins the wiring
 * itself (a loader dropped from a group is a list that goes stale for ten
 * minutes; one under the wrong token is a refetch that never comes).
 */

import { describe, expect, it, vi } from "vitest";

import { buildChangeLoaderGroups, ChangeLoaderSources } from "../context/changeLoaderGroups";
import { CHANGE_COLLECTIONS, ChangeCollection } from "../context/changeRefresher";

const makeSources = () => {
    const src = {
        getChatNoteMeta: vi.fn(async () => true),
        getMyNoteMeta: vi.fn(async () => true),
        getSharedNoteMeta: vi.fn(async () => true),
        getTaskNoteMeta: vi.fn(async () => true),
        getTeamNoteFolders: vi.fn(async () => true),
        getTeamNoteMeta: vi.fn(async () => true),
        loadProjects: vi.fn(async () => true),
        loadTeamTasks: vi.fn(async () => true),
        refreshProjectTasks: vi.fn(async () => undefined),
        refreshSprints: vi.fn(async () => true),
    };
    return src satisfies ChangeLoaderSources;
};

const EXPECTED: Record<ChangeCollection, string[]> = {
    tasks_project: ["refreshProjectTasks", "refreshSprints"],
    tasks_team: ["loadTeamTasks"],
    projects: ["loadProjects"],
    notes_personal: [
        "getMyNoteMeta",
        "getSharedNoteMeta",
        "getTeamNoteFolders",
        "getTeamNoteMeta",
    ],
    notes_task: ["getTaskNoteMeta"],
    notes_chat: ["getChatNoteMeta"],
};

describe("buildChangeLoaderGroups", () => {
    it.each(CHANGE_COLLECTIONS.map((c) => [c]))(
        "%s runs exactly its own loaders",
        async (collection) => {
            const src = makeSources();
            const groups = buildChangeLoaderGroups(src, 7);

            const results = await Promise.all(groups[collection].map((load) => load()));

            const called = Object.entries(src)
                .filter(([, fn]) => fn.mock.calls.length > 0)
                .map(([name]) => name)
                .sort();
            expect(called).toEqual([...EXPECTED[collection]].sort());
            expect(results.every((r) => r === true)).toBe(true);
        }
    );

    it("passes the open project to the task and sprint loaders", async () => {
        const src = makeSources();
        await Promise.all(buildChangeLoaderGroups(src, 7).tasks_project.map((l) => l()));
        expect(src.refreshProjectTasks).toHaveBeenCalledWith(7);
        expect(src.refreshSprints).toHaveBeenCalledWith(7);
    });

    it("no project open: nothing to load for tasks_project", () => {
        expect(buildChangeLoaderGroups(makeSources(), null).tasks_project).toEqual([]);
    });

    it("a failed task delta rejects, a failed sprint load reports false", async () => {
        const src = makeSources();
        src.refreshProjectTasks.mockRejectedValueOnce(new Error("Failed to load project tasks"));
        src.refreshSprints.mockResolvedValueOnce(false);
        const [tasks, sprints] = buildChangeLoaderGroups(src, 7).tasks_project;

        await expect(tasks()).rejects.toThrow("Failed to load project tasks");
        expect(await sprints()).toBe(false);
    });

    it("every collection the contract names has a group", () => {
        const groups = buildChangeLoaderGroups(makeSources(), 7);
        expect(Object.keys(groups).sort()).toEqual([...CHANGE_COLLECTIONS].sort());
    });
});
