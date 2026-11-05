// MIP-961: a FAILED request for the Team note folders must not empty the folder
// tree in the notes sidebar, while a SUCCESSFUL empty answer still must.
//
// Same shape as noteMetaFailedLoad.test.tsx (MIP-954). The loader here is the real
// one. Only the axios instance behind `authApi` is replaced, so the test covers the
// whole path a poll takes: request -> loadTeamNoteFolders -> getTeamNoteFolders in
// useNoteManagement -> the teamNoteFolders state.
//
// loadTeamNoteFolders used to resolve [] on failure (copied from loadMyNoteFolders,
// whose [] was meant for an older backend without the folder endpoint). The getter
// could not tell that from "there are no team folders".

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadTeamNoteFolders } from "../features/notes/team-notes/services/loadTeamNoteFolders";
import { useNoteManagement } from "../hooks/notes/useNoteManagement";
import type { UserProps } from "../types/admin";

const FOLDER_URL = "/note/team/folder/";

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

const folder = (folderId: number, parentFolderId: number | null = null) => ({
    folderId,
    name: `Folder ${folderId}`,
    parentFolderId,
});

const failWith = (error: unknown) => () => Promise.reject(error);
const respondWith = (data: unknown) => () => Promise.resolve({ data });

const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

beforeEach(() => {
    answers.clear();
    fakeGet.mockClear();
    // The loader logs its failures; keep the run output readable.
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("loadTeamNoteFolders reports a failed request as undefined", () => {
    it("undefined on a rejected request", async () => {
        answers.set(FOLDER_URL, failWith(new Error("Network Error")));
        expect(await loadTeamNoteFolders(myself, TOKEN)).toBeUndefined();
    });

    it("undefined on a 5xx", async () => {
        answers.set(FOLDER_URL, failWith(Object.assign(new Error("503"), { isAxiosError: true })));
        expect(await loadTeamNoteFolders(myself, TOKEN)).toBeUndefined();
    });

    it("undefined when the answer is not a list", async () => {
        answers.set(FOLDER_URL, respondWith({ detail: "oops" }));
        expect(await loadTeamNoteFolders(myself, TOKEN)).toBeUndefined();
    });

    it("undefined when there is no token", async () => {
        expect(await loadTeamNoteFolders(myself, null)).toBeUndefined();
        expect(fakeGet).not.toHaveBeenCalled();
    });

    it("a successful [] is still []", async () => {
        answers.set(FOLDER_URL, respondWith([]));
        expect(await loadTeamNoteFolders(myself, TOKEN)).toEqual([]);
    });
});

describe("useNoteManagement keeps the team folders when the poll fails", () => {
    const mount = async () => {
        const hook = renderHook(() => useNoteManagement(myself, TOKEN));
        await settle();
        return hook;
    };

    // The list is filled by a successful load, the way the app fills it.
    const seed = async (hook: Awaited<ReturnType<typeof mount>>, rows: object[]) => {
        answers.set(FOLDER_URL, respondWith(rows));
        await act(async () => void (await hook.result.current.getTeamNoteFolders()));
        expect(hook.result.current.teamNoteFolders).toHaveLength(rows.length);
    };

    const ids = (hook: Awaited<ReturnType<typeof mount>>) =>
        hook.result.current.teamNoteFolders.map((f) => f.folderId);

    it("a failed load keeps the folders, a successful [] empties them", async () => {
        const hook = await mount();
        await seed(hook, [folder(1), folder(2, 1)]);

        answers.set(FOLDER_URL, failWith(new Error("Network Error")));
        await act(async () => void (await hook.result.current.getTeamNoteFolders()));
        expect(ids(hook)).toEqual([1, 2]);

        // A 5xx is the other way a poll fails (a deploy rolling over the API).
        answers.set(FOLDER_URL, failWith(Object.assign(new Error("503"), { isAxiosError: true })));
        await act(async () => void (await hook.result.current.getTeamNoteFolders()));
        expect(ids(hook)).toEqual([1, 2]);

        answers.set(FOLDER_URL, respondWith([]));
        await act(async () => void (await hook.result.current.getTeamNoteFolders()));
        expect(hook.result.current.teamNoteFolders).toEqual([]);
    });

    it("a later successful load still replaces the folders", async () => {
        const hook = await mount();
        await seed(hook, [folder(1)]);

        answers.set(FOLDER_URL, respondWith([folder(3)]));
        await act(async () => void (await hook.result.current.getTeamNoteFolders()));
        expect(ids(hook)).toEqual([3]);
    });

    it("an unchanged successful answer keeps the same array identity", async () => {
        const hook = await mount();
        await seed(hook, [folder(1)]);
        const before = hook.result.current.teamNoteFolders;

        answers.set(FOLDER_URL, respondWith([folder(1)]));
        await act(async () => void (await hook.result.current.getTeamNoteFolders()));
        expect(hook.result.current.teamNoteFolders).toBe(before);
    });
});
