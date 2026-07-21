/**
 * GroupedNoteSection — auto-reveal of the folder holding the open note.
 *
 * The note sidebar recomputes `defaultExpanded` for every project /
 * milestone / task / chat folder as "the active note lives in this
 * subtree". Seeding local state on mount alone left the folders of a note
 * opened later (URL, tab switch, recents) collapsed, so the sidebar gave
 * no clue where the visible note lived.
 *
 * Covers:
 *   - a folder opens when `defaultExpanded` flips to true after mount;
 *   - it does NOT re-collapse when the flag goes back to false (the user
 *     may have opened other folders by hand — only ever open, matching
 *     the note-tree rule in `useNoteManagement`);
 *   - a hand-collapsed folder stays collapsed while the flag is unchanged.
 *
 * The open/closed folder glyph is the observable proxy for the state:
 * children stay mounted either way (the section animates via
 * `grid-template-rows`).
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GroupedNoteSection } from "../features/notes/common/components/GroupedNoteSection";

const renderSection = (defaultExpanded: boolean) =>
    render(
        <CssVarsProvider>
            <GroupedNoteSection
                defaultExpanded={defaultExpanded}
                groupKey="project-1"
                groupLabel="Genos"
            >
                <div>note row</div>
            </GroupedNoteSection>
        </CssVarsProvider>
    );

const rerenderSection = (
    rerender: ReturnType<typeof renderSection>["rerender"],
    defaultExpanded: boolean
) =>
    rerender(
        <CssVarsProvider>
            <GroupedNoteSection
                defaultExpanded={defaultExpanded}
                groupKey="project-1"
                groupLabel="Genos"
            >
                <div>note row</div>
            </GroupedNoteSection>
        </CssVarsProvider>
    );

const isOpen = () => screen.queryByTestId("FolderOpenRoundedIcon") !== null;

describe("GroupedNoteSection auto-reveal", () => {
    it("opens when the active note moves into this subtree after mount", () => {
        const { rerender } = renderSection(false);
        expect(isOpen()).toBe(false);

        rerenderSection(rerender, true);

        expect(isOpen()).toBe(true);
    });

    it("stays open when the active note leaves the subtree", () => {
        const { rerender } = renderSection(true);
        expect(isOpen()).toBe(true);

        rerenderSection(rerender, false);

        expect(isOpen()).toBe(true);
    });

    it("keeps a hand-collapsed folder collapsed", () => {
        const { rerender } = renderSection(true);

        fireEvent.click(screen.getByText("Genos"));
        expect(isOpen()).toBe(false);

        // An unrelated re-render (the sidebar re-renders constantly) must
        // not re-open it — only a fresh false → true flip does.
        rerenderSection(rerender, true);

        expect(isOpen()).toBe(false);
    });
});
