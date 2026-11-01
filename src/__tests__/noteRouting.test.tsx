import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
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
