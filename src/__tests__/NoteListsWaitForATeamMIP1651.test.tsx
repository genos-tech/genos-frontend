/**
 * MIP-1651: the notes lists wait for a team.
 *
 * Signed in but with no team chosen yet (a reload, or a deep link on a notes URL), the lists
 * were requested with `team_id=` (HTTP 400) and the sidebar answered "Couldn't load your notes".
 * Now, with no team: no request is sent, no failure is reported, and the getters answer `false`
 * ("not loaded"), so a change refresh never records a "nothing new" token for a read that did not
 * happen. When a team appears, the four lists the boot load asks for are loaded once.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadChatNoteMeta } from "../features/notes/chat-notes/services/loadChatNoteMeta";
import { loadSharedNotesMeta } from "../features/notes/common/services/loadSharedNotesMeta";
import { loadFavoriteNotesMeta } from "../features/notes/favorite-notes/services";
import { loadMyNoteFolders } from "../features/notes/my-notes/services/loadMyNoteFolders";
import { loadMyNoteMeta } from "../features/notes/my-notes/services/loadMyNoteMeta";
import { loadRecentNotesMeta } from "../features/notes/recent-notes/services";
import { loadTaskNoteMeta } from "../features/notes/task-notes/services/loadTaskNoteMeta";
import { loadTeamNoteFolders } from "../features/notes/team-notes/services/loadTeamNoteFolders";
import { loadTeamNotesMeta } from "../features/notes/team-notes/services/loadTeamNotesMeta";
import { useNoteManagement } from "../hooks/notes/useNoteManagement";
import { syncStatus } from "../services/syncStatus";
import type { UserProps } from "../types/admin";

vi.mock("../features/notes/my-notes/services/loadMyNoteMeta", () => ({
    loadMyNoteMeta: vi.fn(async () => []),
}));
vi.mock("../features/notes/task-notes/services/loadTaskNoteMeta", () => ({
    loadTaskNoteMeta: vi.fn(async () => []),
}));
vi.mock("../features/notes/chat-notes/services/loadChatNoteMeta", () => ({
    loadChatNoteMeta: vi.fn(async () => []),
}));
vi.mock("../features/notes/common/services/loadSharedNotesMeta", () => ({
    loadSharedNotesMeta: vi.fn(async () => []),
}));
vi.mock("../features/notes/team-notes/services/loadTeamNotesMeta", () => ({
    loadTeamNotesMeta: vi.fn(async () => []),
}));
vi.mock("../features/notes/team-notes/services/loadTeamNoteFolders", () => ({
    loadTeamNoteFolders: vi.fn(async () => []),
}));
vi.mock("../features/notes/my-notes/services/loadMyNoteFolders", () => ({
    loadMyNoteFolders: vi.fn(async () => []),
}));
vi.mock("../features/notes/favorite-notes/services", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/notes/favorite-notes/services")>()),
    loadFavoriteNotesMeta: vi.fn(async () => ({
        personalNotes: [],
        taskNotes: [],
        chatNotes: [],
        folders: [],
    })),
}));
vi.mock("../features/notes/recent-notes/services", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/notes/recent-notes/services")>()),
    loadRecentNotesMeta: vi.fn(async () => ({ personalNotes: [], taskNotes: [], chatNotes: [] })),
}));

const LOADERS = {
    loadMyNoteMeta,
    loadMyNoteFolders,
    loadTaskNoteMeta,
    loadChatNoteMeta,
    loadSharedNotesMeta,
    loadTeamNoteFolders,
    loadTeamNotesMeta,
    loadFavoriteNotesMeta,
    loadRecentNotesMeta,
};
const BOOT_FOUR = [loadMyNoteMeta, loadMyNoteFolders, loadTaskNoteMeta, loadChatNoteMeta];

const user = (teamId: string) => ({ teamId, userId: "user-1" }) as UserProps;
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
const calls = (fn: unknown) => vi.mocked(fn as () => unknown).mock.calls.length;

beforeEach(() => {
    for (const loader of Object.values(LOADERS)) vi.mocked(loader as () => unknown).mockClear();
    syncStatus.report("notes:favorites", true);
    syncStatus.report("notes:recents", true);
    syncStatus.report("notes:teamFolders", true);
});

const GETTERS = [
    "getMyNoteMeta",
    "getTaskNoteMeta",
    "getChatNoteMeta",
    "getSharedNoteMeta",
    "getTeamNoteFolders",
    "getTeamNoteMeta",
] as const;

describe("with no team chosen yet", () => {
    it.each(GETTERS)("%s sends nothing and answers false (not loaded)", async (getter) => {
        const hook = renderHook(() => useNoteManagement(user(""), "token"));
        await settle();
        let out: unknown;
        await act(async () => {
            out = await hook.result.current[getter]();
        });
        expect(out).toBe(false);
        for (const loader of Object.values(LOADERS)) expect(calls(loader)).toBe(0);
    });

    it("the folder, favorites and recents getters send nothing either", async () => {
        const hook = renderHook(() => useNoteManagement(user(""), "token"));
        await settle();
        await act(async () => {
            await hook.result.current.getMyNoteFolders();
            await hook.result.current.getFavoriteNotesMeta();
            await hook.result.current.getRecentNotesMeta();
        });
        for (const loader of Object.values(LOADERS)) expect(calls(loader)).toBe(0);
    });

    it("reports no failure, so the sidebar does not say it could not load", async () => {
        const hook = renderHook(() => useNoteManagement(user(""), "token"));
        await settle();
        await act(async () => {
            await hook.result.current.getFavoriteNotesMeta();
            await hook.result.current.getRecentNotesMeta();
            await hook.result.current.getTeamNoteFolders();
        });
        expect(syncStatus.getSnapshot().failed).toEqual([]);
    });
});

describe("with a team, nothing changes", () => {
    it("a getter loads and reports as before", async () => {
        const hook = renderHook(() => useNoteManagement(user("team-1"), "token"));
        await settle();
        let out: unknown;
        await act(async () => {
            out = await hook.result.current.getMyNoteMeta();
        });
        expect(out).toBe(true);
        expect(calls(loadMyNoteMeta)).toBe(1);
    });

    it("a real failure with a team is still reported as a failure", async () => {
        vi.mocked(loadFavoriteNotesMeta).mockResolvedValueOnce(undefined as never);
        const hook = renderHook(() => useNoteManagement(user("team-1"), "token"));
        await settle();
        await act(async () => {
            await hook.result.current.getFavoriteNotesMeta();
        });
        expect(syncStatus.getSnapshot().failed).toContain("notes:favorites");
    });

    it("mounting with a team loads nothing by itself (the boot load is the caller's)", async () => {
        renderHook(() => useNoteManagement(user("team-1"), "token"));
        await settle();
        for (const loader of BOOT_FOUR) expect(calls(loader)).toBe(0);
    });
});

describe("when a team appears", () => {
    it("the four boot lists are loaded, once", async () => {
        let current = user("");
        const hook = renderHook(() => useNoteManagement(current, "token"));
        await settle();
        for (const loader of BOOT_FOUR) expect(calls(loader)).toBe(0);

        current = user("team-1");
        hook.rerender();
        await settle();
        for (const loader of BOOT_FOUR) expect(calls(loader)).toBe(1);

        hook.rerender();
        await settle();
        for (const loader of BOOT_FOUR) expect(calls(loader)).toBe(1);
    });

    it("a switch from one team to another is not an arrival (the loading flag covers it)", async () => {
        let current = user("team-1");
        const hook = renderHook(() => useNoteManagement(current, "token"));
        await settle();
        current = user("team-2");
        hook.rerender();
        await settle();
        for (const loader of BOOT_FOUR) expect(calls(loader)).toBe(0);
    });

    it("losing the team and getting one again loads again", async () => {
        let current = user("team-1");
        const hook = renderHook(() => useNoteManagement(current, "token"));
        await settle();
        current = user("");
        hook.rerender();
        await settle();
        current = user("team-2");
        hook.rerender();
        await settle();
        for (const loader of BOOT_FOUR) expect(calls(loader)).toBe(1);
    });
});
