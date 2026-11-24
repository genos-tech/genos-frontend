// MIP-2316: an "HTML" chip next to the title of an HTML note wherever a note is listed or linked,
// and nothing next to an ordinary note.
import type { ReactNode } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";
import {
    HashNoteHtmlMark,
    HtmlNoteChip,
    HtmlNoteChipFor,
} from "../features/notes/common/components/HtmlNoteChip";
import { NoteTabStrip } from "../features/notes/common/components/NoteTabStrip";

afterEach(cleanup);

const wrap = (ui: ReactNode) => <CssVarsProvider>{ui}</CssVarsProvider>;
const chips = () => document.querySelectorAll("[data-html-note-chip]");

describe("HtmlNoteChip", () => {
    it("says HTML and is named 'HTML page' for assistive tech", () => {
        render(wrap(<HtmlNoteChip />));
        const chip = screen.getByLabelText("HTML page");
        expect(chip.textContent).toBe("HTML");
    });

    it("HtmlNoteChipFor: a chip for an HTML note, nothing for any other note", () => {
        render(
            wrap(
                <>
                    <HtmlNoteChipFor note={{ bodyFormat: "html" }} />
                    <HtmlNoteChipFor note={{ bodyFormat: "blocknote" }} />
                    <HtmlNoteChipFor note={{}} />
                    <HtmlNoteChipFor note={null} />
                </>
            )
        );
        expect(chips()).toHaveLength(1);
    });
});

describe("note tab strip", () => {
    const tabs = [
        { noteType: 1, noteId: 1, title: "A page", bodyFormat: "html" },
        { noteType: 1, noteId: 2, title: "A note" },
    ];
    it("puts the chip on the HTML note's tab only, after the title", () => {
        render(
            wrap(
                <NoteTabStrip
                    selectedIndex={0}
                    tabs={tabs}
                    onCloseTab={() => {}}
                    onSelect={() => {}}
                />
            )
        );
        expect(chips()).toHaveLength(1);
        const tab = chips()[0].closest("[role=tab]") as HTMLElement;
        expect(tab.textContent).toContain("A page");
        expect(tab.textContent).not.toContain("A note");
    });
});

describe("#note link", () => {
    const data = (notes: HashMentionData["notes"]): HashMentionData => ({
        tasks: [],
        notes,
        chats: [],
        allChats: [],
        projects: [],
        todoGroups: [],
        myself: null,
        refresh: () => {},
    });
    const entry = (noteId: number, bodyFormat?: "html") =>
        ({ kind: "my", noteId, noteType: 1, title: "t", bodyFormat }) as never;

    it("shows the chip when the note list says the note is HTML, none for a normal or unknown note", () => {
        render(
            wrap(
                <HashMentionDataProvider value={data([entry(1, "html"), entry(2)])}>
                    <HashNoteHtmlMark noteId={1} noteKind="shared" />
                    <HashNoteHtmlMark noteId={2} noteKind="my" />
                    <HashNoteHtmlMark noteId={3} noteKind="my" />
                </HashMentionDataProvider>
            )
        );
        expect(chips()).toHaveLength(1);
    });

    it("does not confuse a task note with a personal note of the same id", () => {
        render(
            wrap(
                <HashMentionDataProvider value={data([entry(1, "html")])}>
                    <HashNoteHtmlMark noteId={1} noteKind="task" />
                </HashMentionDataProvider>
            )
        );
        expect(chips()).toHaveLength(0);
    });
});
