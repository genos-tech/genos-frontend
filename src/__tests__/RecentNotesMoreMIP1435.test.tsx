/**
 * MIP-1435: Recents shows 8 notes and a "More" row for the rest, up to 20 (then "Show less").
 * The row is a real, keyboard-reachable button; collapsing keeps the focus on it; all seven
 * locales carry the three strings.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    RecentNotesList,
    type RecentRow,
} from "../features/notes/common/components/RecentNotesList";
import { NoteUnreadProvider } from "../features/notes/common/context/NoteUnreadContext";
import {
    hiddenRecentsCount,
    RECENT_NOTES_INITIAL,
    RECENT_NOTES_MAX,
    visibleRecents,
} from "../features/notes/common/utils/recentNotesLimit";
import type { NoteManagementState } from "../hooks/notes/useNoteManagement";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

afterEach(cleanup);

const rows = (count: number): RecentRow[] =>
    Array.from({ length: count }, (_, i) => ({
        note: {
            noteType: 1 as const,
            noteId: i + 1,
            parentNoteId: null,
            title: `Note ${i + 1}`,
            tsUpdated: "",
        },
        noteType: 1,
        tsOpenedAt: "2026-11-01T00:00:00Z",
    }));

const useNM = {
    tabsApi: { activeTab: null },
    setCurrentNoteType: vi.fn(),
    loadNote: vi.fn(),
    isNoteFavorited: () => false,
    toggleFavorite: vi.fn(),
} as unknown as NoteManagementState;

const list = (count: number) =>
    render(
        <CssVarsProvider>
            <NoteUnreadProvider
                value={{ isUnread: () => false, markRead: vi.fn(), unreadNotes: [] }}
            >
                <RecentNotesList locate={() => null} rows={rows(count)} useNM={useNM} />
            </NoteUnreadProvider>
        </CssVarsProvider>
    );
const shown = () => screen.queryAllByText(/^Note \d+$/).length;
const toggle = () => screen.queryByRole("button", { name: /show .* more|show less/i });

describe("the limits", () => {
    it("shows 8 and keeps at most 20", () => {
        expect(RECENT_NOTES_INITIAL).toBe(8);
        expect(RECENT_NOTES_MAX).toBe(20);
        expect(visibleRecents(rows(30), false)).toHaveLength(8);
        expect(visibleRecents(rows(30), true)).toHaveLength(20);
        expect(visibleRecents(rows(5), true)).toHaveLength(5);
        expect(hiddenRecentsCount(30)).toBe(12);
        expect(hiddenRecentsCount(12)).toBe(4);
        expect(hiddenRecentsCount(8)).toBe(0);
        expect(hiddenRecentsCount(3)).toBe(0);
    });
});

describe("the Recents list", () => {
    it("has no More row for 8 notes or fewer", () => {
        list(8);
        expect(shown()).toBe(8);
        expect(toggle()).toBeNull();
    });

    it("shows 8 and a More row for 12, which names how many it holds back", () => {
        list(12);
        expect(shown()).toBe(8);
        expect(screen.getByText(en.notes.sidebar.recentsMore)).toBeTruthy();
        expect(screen.getByRole("button", { name: "Show 4 more recent notes" })).toBeTruthy();
    });

    it("shows the rest on More, up to 20, and Show less puts it back", () => {
        list(30);
        fireEvent.click(screen.getByRole("button", { name: "Show 12 more recent notes" }));
        expect(shown()).toBe(20);
        expect(screen.getByText("Note 20")).toBeTruthy();
        expect(screen.queryByText("Note 21")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: en.notes.sidebar.recentsLess }));
        expect(shown()).toBe(8);
    });

    it("is reachable and operable from the keyboard, and keeps the focus when it collapses", () => {
        list(12);
        const more = screen.getByRole("button", { name: "Show 4 more recent notes" });
        more.focus();
        expect(document.activeElement).toBe(more);
        fireEvent.click(more, { detail: 0 });
        const less = screen.getByRole("button", { name: en.notes.sidebar.recentsLess });
        // The same element, so the focus is where it was.
        expect(less).toBe(more);
        expect(document.activeElement).toBe(less);
        fireEvent.click(less, { detail: 0 });
        expect(document.activeElement).toBe(less);
        expect(shown()).toBe(8);
    });
});

describe("strings", () => {
    it.each([
        ["en", en],
        ["ja", ja],
        ["zh", zh],
        ["es", es],
        ["fr", fr],
        ["hi", hi],
        ["ar", ar],
    ])("%s has the three keys", (_name, locale) => {
        const s = (locale as unknown as typeof en).notes.sidebar;
        expect(s.recentsMore.length).toBeGreaterThan(0);
        expect(s.recentsLess.length).toBeGreaterThan(0);
        expect(s.recentsMoreAria).toContain("{count}");
    });
});
