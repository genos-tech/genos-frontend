/**
 * MIP-1678: every state change in `useNoteManagement` is a commit of the whole Notes page, so
 * the number of renders of the hook per user action is what to keep down.
 *
 *   - the legacy `tabItems` / `selectedTabIndex` mirrors are derived in the same render as the
 *     tab strip, not synced by an effect (one commit instead of two);
 *   - `mergeNoteIdChain` hands back the SAME object when the chain did not change.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { mergeNoteIdChain } from "../hooks/notes/mergeNoteIdChain";
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
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 20))));

const myTab = (noteId: number) =>
    ({
        id: `my-${noteId}`,
        kind: "my",
        noteId,
        title: `Note ${noteId}`,
        bucket: "my",
        teamId: "team-1",
    }) as never;

describe("mergeNoteIdChain", () => {
    it("returns the same object when the entry holds the same ids", () => {
        const prev = { "1-5": [1, 2, 5] };
        expect(mergeNoteIdChain(prev, "1-5", [1, 2, 5])).toBe(prev);
    });

    it("returns a new object for a changed or a new entry, leaving the rest alone", () => {
        const prev = { "1-5": [1, 2, 5] };
        const moved = mergeNoteIdChain(prev, "1-5", [1, 5]);
        expect(moved).not.toBe(prev);
        expect(moved).toEqual({ "1-5": [1, 5] });
        const added = mergeNoteIdChain(prev, "1-6", [6]);
        expect(added).toEqual({ "1-5": [1, 2, 5], "1-6": [6] });
        expect(prev).toEqual({ "1-5": [1, 2, 5] });
    });
});

describe("the legacy tab mirrors", () => {
    it("are coherent with the tab strip in the SAME render that opens a tab", async () => {
        const seen: { tabs: number; items: number; index: number }[] = [];
        const { result } = renderHook(() => {
            const nm = useNoteManagement(myself, "token" as never);
            seen.push({
                tabs: nm.tabsApi.tabs.length,
                items: nm.tabItems.length,
                index: nm.selectedTabIndex,
            });
            return nm;
        });
        await settle();
        const before = seen.length;

        act(() => {
            result.current.tabsApi.openTab(myTab(1));
        });
        act(() => {
            result.current.tabsApi.openTab(myTab(2));
        });

        process.stdout.write(`MIP-1678 hook renders for 2 tab opens: ${seen.length - before}\n`);
        // Never a render where the strip has a tab the mirror does not.
        for (const s of seen) expect(s.items).toBe(s.tabs);
        expect(result.current.tabItems.map((t) => t.noteId)).toEqual([1, 2]);
        expect(result.current.selectedTabIndex).toBe(1);
    });
});
