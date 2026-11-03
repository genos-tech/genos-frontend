// MIP-954: a FAILED request for the Team or Shared notes list must not empty the
// sidebar section, while a SUCCESSFUL empty answer still must.
//
// The loaders here are the real ones. Only the axios instance behind `authApi` is
// replaced, so the test covers the whole path a poll takes: request -> loader ->
// the getter in useNoteManagement -> the list state.
//
// The My / Task / Chat loaders resolve undefined on failure and their getters keep
// the list (MIP-950, genos-frontend #613). Team and Shared used to resolve [] on
// failure, which the getter could not tell from "there are no notes".

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadSharedNotesMeta } from "../features/notes/common/services/loadSharedNotesMeta";
import { loadTeamNotesMeta } from "../features/notes/team-notes/services/loadTeamNotesMeta";
import { useNoteManagement } from "../hooks/notes/useNoteManagement";
import type { UserProps } from "../types/admin";

const TEAM_URL = "/note/team/meta/";
const SHARED_URL = "/note/personal/shared/meta/";

// url prefix -> how that endpoint answers. Anything unlisted answers an empty list.
const answers = new Map<string, () => Promise<{ data: unknown }>>();
const fakeGet = vi.fn(async (url: string) => {
    for (const [prefix, answer] of answers) {
        if (url.startsWith(prefix)) return answer();
    }
    return { data: [] };
});

vi.mock("../services/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../services/api")>()),
    authApi: (token: string | null | undefined) => (token ? { get: fakeGet } : null),
}));

const TOKEN = "test-token";
const myself = { teamId: "team-1", userId: "user-1" } as UserProps;
const stamp = "2026-11-03T00:00:00Z";

const row = (noteId: number) => ({
    noteType: 1,
    noteId,
    parentNoteId: null,
    folderId: null,
    title: `Note ${noteId}`,
    tsCreated: stamp,
    tsUpdated: stamp,
    ownerId: "user-2",
    ownerName: "Owner",
    roleId: 2,
});

const failWith = (error: unknown) => () => Promise.reject(error);
const respondWith = (data: unknown) => () => Promise.resolve({ data });

const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

beforeEach(() => {
    answers.clear();
    fakeGet.mockClear();
    // The loaders log their failures; keep the run output readable.
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("loaders report a failed request as undefined", () => {
    it.each([
        ["Team", loadTeamNotesMeta, TEAM_URL],
        ["Shared", loadSharedNotesMeta, SHARED_URL],
    ] as const)("%s: undefined on a rejected request", async (_n, loader, url) => {
        answers.set(url, failWith(new Error("Network Error")));
        expect(await loader(myself, TOKEN)).toBeUndefined();
    });

    it.each([
        ["Team", loadTeamNotesMeta],
        ["Shared", loadSharedNotesMeta],
    ] as const)("%s: undefined when there is no token", async (_n, loader) => {
        expect(await loader(myself, null)).toBeUndefined();
        expect(fakeGet).not.toHaveBeenCalled();
    });

    it.each([
        ["Team", loadTeamNotesMeta, TEAM_URL],
        ["Shared", loadSharedNotesMeta, SHARED_URL],
    ] as const)("%s: a successful [] is still []", async (_n, loader, url) => {
        answers.set(url, respondWith([]));
        expect(await loader(myself, TOKEN)).toEqual([]);
    });
});

describe("useNoteManagement keeps the list when the poll fails", () => {
    const mount = async () => {
        const hook = renderHook(() => useNoteManagement(myself, TOKEN));
        await settle();
        return hook;
    };

    // setTeamNoteMeta is not part of the hook's surface, so the list is filled by a
    // successful load, the way the app fills it.
    const seedTeam = async (hook: Awaited<ReturnType<typeof mount>>, rows: object[]) => {
        answers.set(TEAM_URL, respondWith(rows));
        await act(async () => void (await hook.result.current.getTeamNoteMeta()));
        expect(hook.result.current.teamNoteMeta).toHaveLength(rows.length);
    };

    it("Team: a failed load keeps the rows, a successful [] empties them", async () => {
        const hook = await mount();
        await seedTeam(hook, [row(1), row(2)]);

        answers.set(TEAM_URL, failWith(new Error("Network Error")));
        await act(async () => void (await hook.result.current.getTeamNoteMeta()));
        expect(hook.result.current.teamNoteMeta.map((n) => n.noteId)).toEqual([1, 2]);

        // A 5xx is the other way a poll fails (a deploy rolling over the API).
        answers.set(TEAM_URL, failWith(Object.assign(new Error("503"), { isAxiosError: true })));
        await act(async () => void (await hook.result.current.getTeamNoteMeta()));
        expect(hook.result.current.teamNoteMeta.map((n) => n.noteId)).toEqual([1, 2]);

        answers.set(TEAM_URL, respondWith([]));
        await act(async () => void (await hook.result.current.getTeamNoteMeta()));
        expect(hook.result.current.teamNoteMeta).toEqual([]);
    });

    it("Team: a later successful load still replaces the rows", async () => {
        const hook = await mount();
        await seedTeam(hook, [row(1)]);

        answers.set(TEAM_URL, respondWith([row(3)]));
        await act(async () => void (await hook.result.current.getTeamNoteMeta()));
        expect(hook.result.current.teamNoteMeta.map((n) => n.noteId)).toEqual([3]);
    });

    it("Shared: a failed load keeps the rows, a successful [] empties them", async () => {
        const hook = await mount();
        act(() => hook.result.current.setSharedNoteMeta([row(1), row(2)] as never));

        answers.set(SHARED_URL, failWith(new Error("Network Error")));
        await act(async () => void (await hook.result.current.getSharedNoteMeta()));
        expect(hook.result.current.sharedNoteMeta.map((n) => n.noteId)).toEqual([1, 2]);

        answers.set(SHARED_URL, respondWith([]));
        await act(async () => void (await hook.result.current.getSharedNoteMeta()));
        expect(hook.result.current.sharedNoteMeta).toEqual([]);
    });
});
