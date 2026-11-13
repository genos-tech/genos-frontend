/**
 * MIP-1435: the notes sidebar's filter results close.
 *
 *   - when a result is opened (click, or Enter, which puts the focus back in the field);
 *   - when a click lands outside the field and the results, but not inside them
 *     (the star on a result is a click inside);
 *   - Escape in the field clears it (as before); Escape on a result clears it and focuses the field;
 *   - closing keeps the words; typing, a click on the field, ArrowDown and "/" open it again.
 *
 * The three pieces are the real ones the sidebar mounts (`useNoteFilter`, `NoteSearchBar`,
 * `NoteFilterResults`); the page around them is a stub.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteFilterResults } from "../features/notes/common/components/NoteFilterResults";
import { NoteSearchBar } from "../features/notes/common/components/NoteSearchBar";
import { NoteUnreadProvider } from "../features/notes/common/context/NoteUnreadContext";
import { useNoteFilter } from "../features/notes/common/hooks/useNoteFilter";
import type { NoteManagementState } from "../hooks/notes/useNoteManagement";
import { en } from "../i18n/locales/en";

afterEach(cleanup);

const notes = [
    { noteType: 1, noteId: 1, parentNoteId: null, title: "Plan", tsUpdated: "" },
    { noteType: 1, noteId: 2, parentNoteId: null, title: "Roadmap plan", tsUpdated: "" },
];

const makeUseNM = () =>
    ({
        tabsApi: { activeTab: null },
        setCurrentNoteType: vi.fn(),
        loadNote: vi.fn(),
        isNoteFavorited: () => false,
        toggleFavorite: vi.fn(),
    }) as unknown as NoteManagementState;

const Page = ({ useNM }: { useNM: NoteManagementState }) => {
    const filter = useNoteFilter();
    return (
        <CssVarsProvider>
            <NoteUnreadProvider
                value={{ isUnread: () => false, markRead: vi.fn(), unreadNotes: [] }}
            >
                <NoteSearchBar
                    barRef={filter.barRef}
                    value={filter.query}
                    onChange={filter.setQuery}
                    onNewNote={() => {}}
                    onReopen={filter.reopen}
                />
                <button data-testid="outside">outside</button>
                {filter.visible ? (
                    <NoteFilterResults
                        listRef={filter.resultsRef}
                        locate={() => null}
                        query={filter.query}
                        result={{
                            hits: notes.map((note) => ({ noteType: 1, note })),
                            total: notes.length,
                        }}
                        useNM={useNM}
                        onKeyDown={filter.onResultsKeyDown}
                        onOpened={filter.onOpened}
                    />
                ) : (
                    <div data-testid="tree" />
                )}
            </NoteUnreadProvider>
        </CssVarsProvider>
    );
};

const field = () => screen.getByRole("searchbox", { name: en.notes.sidebar.filterPlaceholder });
const results = () => screen.queryByTestId("note-filter-results");
const type = (value: string) => fireEvent.change(field(), { target: { value } });
const row = (title: string) => screen.getByRole("button", { name: new RegExp(`^${title}`) });

const open = () => {
    const useNM = makeUseNM();
    render(<Page useNM={useNM} />);
    type("plan");
    expect(results()).not.toBeNull();
    return useNM;
};

describe("closing the results", () => {
    it("closes when a result is clicked, opens the note, and keeps the words", () => {
        const useNM = open();
        fireEvent.click(row("Roadmap plan"), { detail: 1 });
        expect(useNM.loadNote).toHaveBeenCalledWith(1, 2, -1);
        expect(results()).toBeNull();
        expect(screen.getByTestId("tree")).toBeTruthy();
        expect((field() as HTMLInputElement).value).toBe("plan");
    });

    it("closes on Enter on a result and puts the focus back in the field, not on the page", () => {
        open();
        const target = row("Roadmap plan");
        target.focus();
        // A keyboard activation is a click with no pointer: detail 0.
        fireEvent.click(target, { detail: 0 });
        expect(results()).toBeNull();
        expect(document.activeElement).toBe(field());
    });

    it("closes when a click lands outside the field and the results", () => {
        open();
        fireEvent.click(screen.getByTestId("outside"));
        expect(results()).toBeNull();
        expect((field() as HTMLInputElement).value).toBe("plan");
    });

    it("stays open for a click on the field, the results and a row's star", () => {
        open();
        fireEvent.click(field());
        expect(results()).not.toBeNull();
        fireEvent.click(screen.getByTestId("note-filter-results"));
        expect(results()).not.toBeNull();
        fireEvent.click(screen.getAllByRole("button", { name: /favorites/i })[0]);
        expect(results()).not.toBeNull();
    });

    it("opens again on typing, a click on the field, ArrowDown", () => {
        open();
        fireEvent.click(screen.getByTestId("outside"));
        expect(results()).toBeNull();

        fireEvent.click(field());
        expect(results()).not.toBeNull();

        fireEvent.click(screen.getByTestId("outside"));
        fireEvent.keyDown(field(), { key: "ArrowDown" });
        expect(results()).not.toBeNull();

        fireEvent.click(screen.getByTestId("outside"));
        type("roadmap plan");
        expect(results()).not.toBeNull();
    });

    it("opens again on '/'", () => {
        open();
        fireEvent.click(screen.getByTestId("outside"));
        expect(results()).toBeNull();
        fireEvent.keyDown(document.body, { key: "/" });
        expect(results()).not.toBeNull();
        expect(document.activeElement).toBe(field());
    });

    it("does not listen for outside clicks while there is nothing to close", () => {
        const useNM = makeUseNM();
        render(<Page useNM={useNM} />);
        fireEvent.click(screen.getByTestId("outside"));
        type("plan");
        // Typing after a click outside still opens it: the state was never closed.
        expect(results()).not.toBeNull();
    });
});

describe("Escape", () => {
    it("clears the field from the field, then a second Escape leaves it (as before)", () => {
        open();
        field().focus();
        fireEvent.keyDown(field(), { key: "Escape" });
        expect((field() as HTMLInputElement).value).toBe("");
        expect(results()).toBeNull();
        fireEvent.keyDown(field(), { key: "Escape" });
        expect(document.activeElement).not.toBe(field());
    });

    it("clears the field from a result and puts the focus in the field", () => {
        open();
        const target = row("Plan");
        target.focus();
        fireEvent.keyDown(target, { key: "Escape" });
        expect((field() as HTMLInputElement).value).toBe("");
        expect(results()).toBeNull();
        expect(document.activeElement).toBe(field());
    });
});
