/**
 * The notes sidebar's title filter, phase 3 of MIP-1428 (MIP-1431): which notes match
 * (`filterNotesByTitle`) and the field itself (`NoteSearchBar`: "/", Escape, clear, New note).
 */
import { useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteSearchBar } from "../features/notes/common/components/NoteSearchBar";
import { filterNotesByTitle, queryWords } from "../features/notes/common/utils/filterNotes";
import { en } from "../i18n/locales/en";

afterEach(cleanup);

const n = (noteId: number, title: string, tsUpdated = "2026-11-01T00:00:00Z") => ({
    noteId,
    title,
    tsUpdated,
});
const titles = (
    query: string,
    groups: Parameters<typeof filterNotesByTitle<ReturnType<typeof n>>>[1]
) => filterNotesByTitle(query, groups).hits.map((h) => h.note.title);

describe("which notes match", () => {
    it("has no matches for an empty or blank query, so the tree stays", () => {
        const groups = [{ noteType: 1, notes: [n(1, "Plan")] }];
        expect(filterNotesByTitle("", groups)).toEqual({ hits: [], total: 0 });
        expect(filterNotesByTitle("   ", groups)).toEqual({ hits: [], total: 0 });
        expect(queryWords("  a   b ")).toEqual(["a", "b"]);
    });

    it("needs every word, in any order", () => {
        const groups = [
            {
                noteType: 1,
                notes: [n(1, "Customer interview synthesis"), n(2, "Customer plan"), n(3, "x")],
            },
        ];
        expect(titles("synthesis customer", groups)).toEqual(["Customer interview synthesis"]);
        expect(titles("customer", groups).sort()).toEqual([
            "Customer interview synthesis",
            "Customer plan",
        ]);
    });

    it("ignores case and width, and finds Japanese", () => {
        const groups = [
            { noteType: 1, notes: [n(1, "ＱＲ Roadmap"), n(2, "週次レビュー"), n(3, "other")] },
        ];
        expect(titles("qr road", groups)).toEqual(["ＱＲ Roadmap"]);
        expect(titles("レビュー", groups)).toEqual(["週次レビュー"]);
    });

    it("ranks a title that starts with the query, then a word that does, then the rest", () => {
        const groups = [
            {
                noteType: 1,
                notes: [
                    n(1, "Weekly plan", "2026-11-10T00:00:00Z"),
                    n(2, "Draft plan for Q4", "2026-11-09T00:00:00Z"),
                    n(3, "Plan B", "2026-11-01T00:00:00Z"),
                    n(4, "Misplanned", "2026-11-11T00:00:00Z"),
                ],
            },
        ];
        expect(titles("plan", groups)).toEqual([
            "Plan B", // starts the title
            "Weekly plan", // starts a word, newer
            "Draft plan for Q4", // starts a word, older
            "Misplanned", // somewhere inside, though the newest
        ]);
    });

    it("lists the newest first among equals", () => {
        const groups = [
            {
                noteType: 1,
                notes: [
                    n(1, "Notes a", "2026-11-01T00:00:00Z"),
                    n(2, "Notes b", "2026-11-05T00:00:00Z"),
                ],
            },
        ];
        expect(titles("notes", groups)).toEqual(["Notes b", "Notes a"]);
    });

    it("searches every family and says which one each hit came from", () => {
        const { hits } = filterNotesByTitle("roadmap", [
            { noteType: 1, notes: [n(1, "Roadmap mine")] },
            { noteType: 4, notes: [n(2, "Roadmap shared")] },
            { noteType: 8, notes: [n(3, "Roadmap team")] },
            { noteType: 2, notes: [n(4, "Roadmap task")] },
            { noteType: 3, notes: [n(5, "Roadmap chat")] },
        ]);
        expect(hits.map((h) => h.noteType).sort()).toEqual([1, 2, 3, 4, 8]);
    });

    it("lists one note once per family, and the same id in two families twice", () => {
        const { hits } = filterNotesByTitle("a", [
            { noteType: 1, notes: [n(1, "a"), n(1, "a")] },
            { noteType: 8, notes: [n(1, "a")] },
        ]);
        expect(hits.map((h) => h.noteType)).toEqual([1, 8]);
    });

    it("keeps a long list to the limit and still counts them all", () => {
        const notes = Array.from({ length: 70 }, (_, i) => n(i, `note ${i}`));
        const result = filterNotesByTitle("note", [{ noteType: 1, notes }]);
        expect(result.hits).toHaveLength(50);
        expect(result.total).toBe(70);
    });

    it("copes with a note that has no title", () => {
        const groups = [{ noteType: 1, notes: [{ noteId: 1, title: null }, n(2, "x")] }];
        expect(filterNotesByTitle("x", groups).total).toBe(1);
    });
});

describe("the filter field", () => {
    const Bar = ({ onNewNote = () => {} }: { onNewNote?: () => void }) => {
        const [value, setValue] = useState("");
        return (
            <CssVarsProvider>
                <NoteSearchBar value={value} onChange={setValue} onNewNote={onNewNote} />
                <div data-testid="editor" contentEditable suppressContentEditableWarning />
                <textarea data-testid="area" />
            </CssVarsProvider>
        );
    };
    const field = () =>
        screen.getByRole("searchbox", { name: en.notes.sidebar.filterPlaceholder });
    const slash = (target: Element | Document = document.body, init: KeyboardEventInit = {}) =>
        fireEvent.keyDown(target, { key: "/", ...init });

    it("takes focus on '/' from the page", () => {
        render(<Bar />);
        slash();
        expect(document.activeElement).toBe(field());
    });

    it("leaves '/' alone where you type: a text area, the note editor", () => {
        render(<Bar />);
        const area = screen.getByTestId("area");
        (area as HTMLElement).focus();
        slash(area);
        expect(document.activeElement).toBe(area);
        const editor = screen.getByTestId("editor");
        // jsdom has no isContentEditable; the attribute check covers it
        Object.defineProperty(editor, "isContentEditable", { value: true });
        editor.focus();
        slash(editor);
        expect(document.activeElement).not.toBe(field());
    });

    it("leaves '/' alone when the keystroke lands on something INSIDE the editor", () => {
        render(
            <>
                <Bar />
                <div contentEditable="true" suppressContentEditableWarning>
                    <span data-testid="inside">text</span>
                </div>
            </>
        );
        slash(screen.getByTestId("inside"));
        expect(document.activeElement).not.toBe(field());
    });

    it("leaves '/' alone with a modifier (browser and app shortcuts)", () => {
        render(<Bar />);
        slash(document.body, { metaKey: true });
        slash(document.body, { ctrlKey: true });
        expect(document.activeElement).not.toBe(field());
    });

    it("clears on Escape, and a second Escape leaves the field", () => {
        render(<Bar />);
        fireEvent.change(field(), { target: { value: "plan" } });
        field().focus();
        fireEvent.keyDown(field(), { key: "Escape" });
        expect((field() as HTMLInputElement).value).toBe("");
        expect(document.activeElement).toBe(field());
        fireEvent.keyDown(field(), { key: "Escape" });
        expect(document.activeElement).not.toBe(field());
    });

    it("has a clear button only when there is something to clear", () => {
        render(<Bar />);
        expect(screen.queryByRole("button", { name: en.notes.sidebar.filterClear })).toBeNull();
        fireEvent.change(field(), { target: { value: "plan" } });
        fireEvent.click(screen.getByRole("button", { name: en.notes.sidebar.filterClear }));
        expect((field() as HTMLInputElement).value).toBe("");
        expect(document.activeElement).toBe(field());
    });

    it("has the one New note button beside it", () => {
        const onNewNote = vi.fn();
        render(<Bar onNewNote={onNewNote} />);
        fireEvent.click(screen.getByRole("button", { name: en.notes.list.newNote }));
        expect(onNewNote).toHaveBeenCalledTimes(1);
    });

    it("stops listening for '/' when it goes away", () => {
        const { unmount } = render(<Bar />);
        unmount();
        const spy = vi.fn();
        document.addEventListener("keydown", spy);
        slash();
        // nothing preventDefault'd it
        expect(spy.mock.calls[0][0].defaultPrevented).toBe(false);
        document.removeEventListener("keydown", spy);
    });
});
