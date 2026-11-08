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

    it("keeps two entries for the same note apart (race while opening)", () => {
        const onSelect = vi.fn();
        render(
            <CssVarsProvider>
                <NoteTabStrip
                    selectedIndex={0}
                    tabs={[
                        { noteType: 1, noteId: 5, title: "Dup" },
                        { noteType: 1, noteId: 5, title: "Dup" },
                    ]}
                    onCloseTab={() => {}}
                    onSelect={onSelect}
                />
            </CssVarsProvider>
        );
        fireEvent.click(screen.getAllByRole("tab")[1]);
        expect(onSelect).toHaveBeenCalledWith(1);
    });

    it("the visible x closes with the index and the note id, and does not select", () => {
        const { onSelect, onCloseTab } = mount(0);
        const x = document.querySelectorAll("[data-tab-close]")[1];
        fireEvent.click(x);
        expect(onCloseTab).toHaveBeenCalledWith(1, 12);
        expect(onSelect).not.toHaveBeenCalled();
    });

    // MIP-1173: axe flags any non-tab child of a tablist (aria-required-children, critical).
    it("the tablist owns only tabs: the x is aria-hidden and Delete is advertised", () => {
        mount(0);
        const list = screen.getByRole("tablist");
        expect(list.querySelectorAll("button:not([role='tab'])").length).toBe(0);
        for (const x of Array.from(list.querySelectorAll("[data-tab-close]"))) {
            expect(x.getAttribute("aria-hidden")).toBe("true");
        }
        for (const tab of screen.getAllByRole("tab")) {
            expect(tab.getAttribute("aria-keyshortcuts")).toBe("Delete");
        }
    });

    it("screen readers still get one real 'Close <title>' button per tab, outside the tablist", () => {
        const { onSelect, onCloseTab } = mount(0);
        const label = getMessages().notes.tabs.closeTab;
        const buttons = screen.getAllByRole("button", { name: new RegExp(`^${label}: `) });
        expect(buttons.length).toBe(screen.getAllByRole("tab").length);
        for (const b of buttons) {
            expect(screen.getByRole("tablist").contains(b)).toBe(false);
            expect(b.getAttribute("tabindex")).toBe("-1");
        }
        fireEvent.click(buttons[1]);
        expect(onCloseTab).toHaveBeenCalledWith(1, 12);
        expect(onSelect).not.toHaveBeenCalled();
    });
});
