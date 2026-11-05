/**
 * The six note getters the change-driven refresh calls (MIP-970 step 5) say
 * whether the list was LOADED: `true` for an answer (an empty list is an
 * answer), `false` for a request that failed (the loader resolves undefined).
 *
 * The refresh records a collection's "nothing new" token only when every
 * getter in it reported `true`; swallowing a failure here would store the token
 * of a load that never happened and hide the change until the 10-minute
 * backstop. Existing callers ignore the value (`void useNM.getX()`).
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadChatNoteMeta } from "../features/notes/chat-notes/services/loadChatNoteMeta";
import { loadSharedNotesMeta } from "../features/notes/common/services/loadSharedNotesMeta";
import { loadMyNoteMeta } from "../features/notes/my-notes/services/loadMyNoteMeta";
import { loadTaskNoteMeta } from "../features/notes/task-notes/services/loadTaskNoteMeta";
import { loadTeamNoteFolders } from "../features/notes/team-notes/services/loadTeamNoteFolders";
import { loadTeamNotesMeta } from "../features/notes/team-notes/services/loadTeamNotesMeta";
import { useNoteManagement } from "../hooks/notes/useNoteManagement";
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

const myself = { teamId: "team-1", userId: "user-1" } as UserProps;
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

type Getter =
    | "getMyNoteMeta"
    | "getTaskNoteMeta"
    | "getChatNoteMeta"
    | "getSharedNoteMeta"
    | "getTeamNoteFolders"
    | "getTeamNoteMeta";

const cases = [
    ["getMyNoteMeta", loadMyNoteMeta],
    ["getTaskNoteMeta", loadTaskNoteMeta],
    ["getChatNoteMeta", loadChatNoteMeta],
    ["getSharedNoteMeta", loadSharedNotesMeta],
    ["getTeamNoteFolders", loadTeamNoteFolders],
    ["getTeamNoteMeta", loadTeamNotesMeta],
] as const satisfies readonly (readonly [Getter, unknown])[];

describe("note getters report whether the list loaded", () => {
    beforeEach(() => {
        for (const [, loader] of cases) vi.mocked(loader as never as () => unknown).mockReset();
    });

    const mount = async () => {
        const hook = renderHook(() => useNoteManagement(myself, "test-token"));
        await settle();
        return hook;
    };
    const call = async (hook: Awaited<ReturnType<typeof mount>>, getter: Getter) => {
        let out: unknown;
        await act(async () => {
            out = await hook.result.current[getter]();
        });
        return out;
    };

    it.each(cases)("%s: true for an answer, including an empty one", async (getter, loader) => {
        const hook = await mount();
        const mocked = vi.mocked(loader as never as () => Promise<unknown>);

        mocked.mockResolvedValueOnce([]);
        expect(await call(hook, getter)).toBe(true);

        mocked.mockResolvedValueOnce([{ noteId: 1, title: "n", tsUpdated: "2026-11-04" }]);
        expect(await call(hook, getter)).toBe(true);
    });

    it.each(cases)(
        "%s: false when the request failed (loader resolves undefined)",
        async (getter, loader) => {
            const hook = await mount();
            vi.mocked(loader as never as () => Promise<unknown>).mockResolvedValueOnce(undefined);

            expect(await call(hook, getter)).toBe(false);
        }
    );
});
