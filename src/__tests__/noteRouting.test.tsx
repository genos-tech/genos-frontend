import { useMemo, useState, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
    notePathForOpenNote,
    parseNoteRoute,
    useNoteRouting,
} from "../features/notes/common/hooks/useNoteRouting";
import type { NoteManagementState } from "../hooks/notes/useNoteManagement";

// Team Notes had no working URL: a full load of /workspace/notes/team/<id>
// dropped the id, and opening a team note never wrote a URL at all.
describe("note routes: URL -> note", () => {
    it.each([
        ["my", 1],
        ["shared", 4],
        ["team", 8],
    ])("reads the note id from /workspace/notes/%s/:id", (bucket) => {
        expect(parseNoteRoute(`/workspace/notes/${bucket}/42`)).toMatchObject({
            noteType: bucket,
            noteId: 42,
        });
    });

    it("leaves the id empty for a bare bucket", () => {
        expect(parseNoteRoute("/workspace/notes/team")).toMatchObject({
            noteType: "team",
            noteId: undefined,
        });
    });
});

const openPersonal = (currentNoteType: number, noteId: number) =>
    ({
        currentNoteType,
        currentMyNote: { noteId },
        currentTaskNote: undefined,
        currentChatNote: undefined,
    }) as unknown as NoteManagementState;

describe("note routes: note -> URL", () => {
    it.each([
        [1, "my"],
        [4, "shared"],
        [8, "team"],
    ])("an open note in bucket %i writes /workspace/notes/%s/:id", (type, bucket) => {
        expect(notePathForOpenNote(openPersonal(type, 42))).toBe(`/workspace/notes/${bucket}/42`);
    });

    it("writes nothing when no note is open", () => {
        expect(
            notePathForOpenNote({
                currentNoteType: 8,
                currentMyNote: undefined,
                currentTaskNote: undefined,
                currentChatNote: undefined,
            } as unknown as NoteManagementState)
        ).toBeNull();
    });
});

const stubNM = (overrides: Partial<Record<string, unknown>> = {}) =>
    ({
        currentNoteType: 0,
        currentMyNote: undefined,
        currentTaskNote: undefined,
        currentChatNote: undefined,
        setCurrentNoteType: vi.fn(),
        loadNote: vi.fn(() => Promise.resolve()),
        clearNoteOpenFailure: vi.fn(),
        tabsApi: { activeTab: undefined },
        ...overrides,
    }) as unknown as NoteManagementState;

const routerAt =
    (path: string) =>
    ({ children }: { children: ReactNode }) => (
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    );

describe("useNoteRouting with a team note", () => {
    it("opens the team note on a full load of its URL", () => {
        const useNM = stubNM();
        renderHook(() => useNoteRouting({ useNM, isActiveRoute: true }), {
            wrapper: routerAt("/workspace/notes/team/42"),
        });
        expect(useNM.setCurrentNoteType).toHaveBeenCalledWith(8);
        expect(useNM.loadNote).toHaveBeenCalledWith(8, 42, -1);
    });

    it("does not reopen a team note whose tab is already active", () => {
        const useNM = stubNM({
            currentNoteType: 8,
            tabsApi: { activeTab: { kind: "my", noteId: 42 } },
        });
        renderHook(() => useNoteRouting({ useNM, isActiveRoute: true }), {
            wrapper: routerAt("/workspace/notes/team/42"),
        });
        expect(useNM.loadNote).not.toHaveBeenCalled();
    });

    it("writes /workspace/notes/team/:id when a team note is opened", () => {
        const useNM = stubNM({ currentNoteType: 8, currentMyNote: { noteId: 42 } });
        const { result } = renderHook(
            () => {
                useNoteRouting({ useNM, isActiveRoute: true });
                return useLocation().pathname;
            },
            { wrapper: routerAt("/workspace/notes") }
        );
        expect(result.current).toBe("/workspace/notes/team/42");
    });
});

// MIP-841: `/workspace/notes/folder/:id` opens a folder in the sidebar.
describe("folder routes", () => {
    it("parses the folder id and nothing else", () => {
        expect(parseNoteRoute("/workspace/notes/folder/7")).toMatchObject({
            folderId: 7,
            noteType: undefined,
            noteId: undefined,
        });
    });

    it.each(["abc", "0", "-3", "1.5", ""])("rejects the folder id %j", (id) => {
        expect(parseNoteRoute(`/workspace/notes/folder/${id}`).folderId).toBeUndefined();
    });

    it("leaves every other route without a folder id", () => {
        for (const path of [
            "/workspace/notes",
            "/workspace/notes/my/42",
            "/workspace/notes/team/42",
            "/workspace/notes/task/project/1/task/2/note/3",
        ]) {
            expect(parseNoteRoute(path).folderId, path).toBeUndefined();
        }
    });
});

const TEAM_FOLDERS = [{ folderId: 7 }];
const MY_FOLDERS = [{ folderId: 9 }];

// A notes state whose `revealFolder` really changes the open space, as
// the real one does, so the URL guard is exercised end to end.
const useRevealHarness = (
    opts: {
        teamFolders?: unknown[];
        myFolders?: unknown[];
        active?: boolean;
        openNote?: boolean;
    } = {}
) => {
    const [type, setType] = useState(opts.openNote ? 1 : 0);
    const revealFolder = useMemo(
        () => vi.fn((_id: number, space: "my" | "team") => setType(space === "team" ? 8 : 1)),
        []
    );
    const useNM = {
        ...(stubNM({
            currentNoteType: type,
            currentMyNote: opts.openNote ? { noteId: 5 } : undefined,
            revealFolder,
        }) as object),
        // Fresh arrays every render, as a periodic list refresh makes:
        // stable ones would never re-run the effect and prove nothing.
        teamNoteFolders: [...(opts.teamFolders ?? TEAM_FOLDERS)],
        myNoteFolders: [...(opts.myFolders ?? MY_FOLDERS)],
    } as unknown as NoteManagementState;
    useNoteRouting({ useNM, isActiveRoute: opts.active ?? true });
    return { path: useLocation().pathname, navigate: useNavigate(), revealFolder };
};

describe("useNoteRouting with a folder URL", () => {
    const at = (path: string) => routerAt(path);

    it("reveals a team folder once on a full load of its URL", () => {
        const { result, rerender } = renderHook(() => useRevealHarness(), {
            wrapper: at("/workspace/notes/folder/7"),
        });
        expect(result.current.revealFolder).toHaveBeenCalledTimes(1);
        expect(result.current.revealFolder).toHaveBeenCalledWith(7, "team");
        expect(result.current.path).toBe("/workspace/notes/folder/7");
        // Re-renders (new arrays every time, as a list refresh makes) don't re-reveal.
        rerender();
        rerender();
        expect(result.current.revealFolder).toHaveBeenCalledTimes(1);
    });

    it("keeps the folder URL when a note is open and the reveal switches space", async () => {
        // A note is open on its own URL; a Spotlight folder result then
        // navigates to the folder. Revealing switches the sidebar to Team
        // Notes, which would otherwise rewrite the URL back to the open
        // note (/notes/team/5), so the folder URL would not survive a reload.
        const { result } = renderHook(() => useRevealHarness({ openNote: true }), {
            wrapper: at("/workspace/notes/my/5"),
        });
        expect(result.current.path).toBe("/workspace/notes/my/5");
        // Opening a note from its URL holds `isNavigatingFromUrl` for 100 ms
        // (its own load); navigate after that, or the flag hides whether the
        // reveal sets it itself.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 160));
        });
        act(() => result.current.navigate("/workspace/notes/folder/7"));
        expect(result.current.revealFolder).toHaveBeenCalledWith(7, "team");
        expect(result.current.path).toBe("/workspace/notes/folder/7");
    });

    it("reveals a folder again when its URL is visited again", () => {
        const { result } = renderHook(() => useRevealHarness(), {
            wrapper: at("/workspace/notes/folder/7"),
        });
        act(() => result.current.navigate("/workspace/notes"));
        act(() => result.current.navigate("/workspace/notes/folder/7"));
        expect(result.current.revealFolder).toHaveBeenCalledTimes(2);
    });

    it("reveals a My Notes folder in the my tree", () => {
        const { result } = renderHook(() => useRevealHarness(), {
            wrapper: at("/workspace/notes/folder/9"),
        });
        expect(result.current.revealFolder).toHaveBeenCalledWith(9, "my");
    });

    it("does nothing for a folder in neither list, and waits for the lists to load", () => {
        const { result, rerender } = renderHook(
            ({ team }: { team: unknown[] }) => useRevealHarness({ teamFolders: team }),
            { wrapper: at("/workspace/notes/folder/7"), initialProps: { team: [] } }
        );
        expect(result.current.revealFolder).not.toHaveBeenCalled();
        rerender({ team: [{ folderId: 7 }] });
        expect(result.current.revealFolder).toHaveBeenCalledWith(7, "team");
    });

    it("stays quiet while the notes home is hidden (keep-alive)", () => {
        const { result } = renderHook(() => useRevealHarness({ active: false }), {
            wrapper: at("/workspace/notes/folder/7"),
        });
        expect(result.current.revealFolder).not.toHaveBeenCalled();
    });

    it("reveals nothing on an ordinary notes URL", () => {
        const { result } = renderHook(() => useRevealHarness(), {
            wrapper: at("/workspace/notes"),
        });
        expect(result.current.revealFolder).not.toHaveBeenCalled();
    });
});

// MIP-1307: a failed open belongs to the URL that asked for it, so every route change
// clears it (a slow answer for the previous URL must not revive it either).
describe("useNoteRouting and a failed open", () => {
    it("clears the kept failure on every pathname change", () => {
        const useNM = stubNM();
        const { result } = renderHook(
            () => ({
                nav: useNavigate(),
                routing: useNoteRouting({ useNM, isActiveRoute: true }),
            }),
            { wrapper: routerAt("/workspace/notes/my/5") }
        );
        const first = (useNM.clearNoteOpenFailure as ReturnType<typeof vi.fn>).mock.calls.length;
        expect(first).toBeGreaterThan(0);
        act(() => result.current.nav("/workspace/notes/my/6"));
        expect(
            (useNM.clearNoteOpenFailure as ReturnType<typeof vi.fn>).mock.calls.length
        ).toBeGreaterThan(first);
    });
});
