/**
 * Where a folder another team shared with us belongs.
 *
 * Under Shared Notes, next to the notes colleagues shared — not under Team
 * Notes, which is our team's own space. The subtlety is that nothing else
 * about the folder changes: its notes stay bucket 8 (team), because the
 * tab, the deep-link reveal and the delete path are all keyed on that
 * bucket, and relabelling them bucket 4 to match the section would quietly
 * break revealing a note opened from a link.
 *
 * Which leaves one thing to keep honest — which section unfolds for the open note,
 * since the open note's bucket no longer says which section its row is in. (A section
 * header is never tinted as selected, MIP-1429: only the open note's own row is.)
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NoteTypeSection } from "../features/notes/common/components/NoteTypeSection";
import {
    isInGuestFolder,
    splitFoldersByOwnership,
} from "../features/notes/team-notes/utils/guestFolders";
import type { NoteManagementState } from "../hooks/notes/useNoteManagement";

vi.mock("../i18n", () => ({
    useTranslation: () => ({ t: { notes: { sidebar: { soonBadge: "Soon" } } } }),
}));

const folders = [
    { folderId: 1, parentFolderId: null, name: "Ours" },
    { folderId: 2, parentFolderId: null, name: "Theirs", isExternal: true },
    { folderId: 3, parentFolderId: 2, name: "Inside theirs" },
];

describe("sorting folders by whose they are", () => {
    it("keeps ours and hands back theirs separately", () => {
        const [ours, theirs] = splitFoldersByOwnership(folders);
        expect(ours.map((f) => f.name)).toEqual(["Ours", "Inside theirs"]);
        expect(theirs.map((f) => f.name)).toEqual(["Theirs"]);
    });

    it("counts a subfolder of a shared folder as theirs too", () => {
        // Only the folder that was lent carries the mark, so this has to be
        // answered by walking up — otherwise we'd offer to delete a
        // subfolder of somebody else's folder.
        expect(isInGuestFolder(folders, 3)).toBe(true);
        expect(isInGuestFolder(folders, 2)).toBe(true);
        expect(isInGuestFolder(folders, 1)).toBe(false);
        expect(isInGuestFolder(folders, null)).toBe(false);
    });

    it("stops rather than loops when a folder chain points at itself", () => {
        expect(isInGuestFolder([{ folderId: 9, parentFolderId: 9 }], 9)).toBe(false);
    });
});

const sectionState = (currentNoteType: number) =>
    ({
        currentNoteType,
        setCurrentNoteType: () => {},
    }) as unknown as NoteManagementState;

const showSection = (noteType: number, isCurrent: boolean | undefined, open: number) =>
    render(
        <CssVarsProvider>
            <NoteTypeSection
                icon={null}
                isCurrent={isCurrent}
                noteType={noteType}
                title={noteType === 4 ? "Shared Notes" : "Team Notes"}
                useNM={sectionState(open)}
            >
                <div>body</div>
            </NoteTypeSection>
        </CssVarsProvider>
    );

const header = (name: RegExp) => screen.getByRole("button", { name });

describe("which section unfolds for the open note", () => {
    it("is Shared Notes when the open team note sits in a folder they lent us", () => {
        // Bucket 8 is open, and Shared Notes is nonetheless the section
        // holding that row.
        showSection(4, true, 8);
        expect(header(/shared notes/i).getAttribute("aria-expanded")).toBe("true");
    });

    it("is not Team Notes at the same time", () => {
        showSection(8, false, 8);
        expect(header(/team notes/i).getAttribute("aria-expanded")).toBe("false");
    });

    it("still follows the bucket when nothing overrides it", () => {
        showSection(8, undefined, 8);
        expect(header(/team notes/i).getAttribute("aria-expanded")).toBe("true");
    });
});

describe("a section header is never the selection (MIP-1429)", () => {
    // It used to wear the selected tint whenever the open note's type matched, so a header
    // looked like the current page and, with no note open, one was tinted for nothing.
    it.each([
        ["the section the open note is in", 8, undefined, 8],
        ["a section the host forces open", 4, true, 8],
        ["a section no note is open in", 4, false, 8],
    ] as const)("%s", (_name, noteType, isCurrent, open) => {
        showSection(noteType, isCurrent, open);
        const button = screen.getByRole("button", { name: /notes/i });
        expect(button.className).not.toMatch(/Mui-selected/);
        expect(button.getAttribute("aria-current")).not.toBe("true");
    });
});
