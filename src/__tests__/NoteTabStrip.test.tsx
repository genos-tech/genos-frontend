/**
 * The open-notes strip (MIP-1132) replaced three 330-line copies. It maps the
 * note tabs onto TabStrip: select by index, close by index + note id.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NoteTabStrip } from "../features/notes/common/components/NoteTabStrip";
import { getMessages } from "../i18n";

const tabs = [
    { noteType: 1, noteId: 11, title: "Plan" },
    { noteType: 1, noteId: 12, title: "Retro" },
    // Same id under another kind: the strip must key on both.
    { noteType: 3, noteId: 11, title: "Task note" },
];

const mount = (selectedIndex = 0) => {
    const onSelect = vi.fn();
    const onCloseTab = vi.fn();
    render(
        <CssVarsProvider>
            <NoteTabStrip
                selectedIndex={selectedIndex}
                tabs={tabs}
                onCloseTab={onCloseTab}
                onSelect={onSelect}
            />
        </CssVarsProvider>
    );
    return { onSelect, onCloseTab };
};

describe("NoteTabStrip", () => {
    it("is a named tablist with one tab per note, the selected one marked", () => {
        mount(1);
        expect(
            screen.getByRole("tablist", { name: getMessages().notes.tabs.ariaLabel })
        ).toBeTruthy();
        expect(screen.getAllByRole("tab")).toHaveLength(3);
        expect(screen.getByRole("tab", { name: /Retro/ }).getAttribute("aria-selected")).toBe(
            "true"
        );
    });

    it("selects by index, including the same note id under another kind", () => {
        const { onSelect } = mount(0);
        fireEvent.click(screen.getByRole("tab", { name: /Task note/ }));
        expect(onSelect).toHaveBeenCalledWith(2);
    });

    it("closes with the index and the note id, and does not select", () => {
        const { onSelect, onCloseTab } = mount(0);
        fireEvent.click(
            screen.getAllByRole("button", { name: getMessages().notes.tabs.closeTab })[1]
        );
        expect(onCloseTab).toHaveBeenCalledWith(1, 12);
        expect(onSelect).not.toHaveBeenCalled();
    });
});
