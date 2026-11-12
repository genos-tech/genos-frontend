/**
 * The notes sidebar, phase 1 of MIP-1428 (MIP-1429): what each row shows, and what is selected.
 *
 *   - only the open note's own row is selected, and a click on a section header does not change
 *     that (it used to un-tint the open note, because rows asked `currentNoteType`);
 *   - a section header is never the selection;
 *   - a Recents row wears its family's icon, says where the note lives and when it was opened;
 *   - a note in the tree is a document glyph, and unread is a dot at the END of the row;
 *   - a tab wears its family's icon.
 *
 * jsdom cannot measure layout; the look was checked in a browser (see the PR).
 */
import { ReactNode } from "react";
import { List } from "@mui/joy";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FavoriteNoteItem } from "../features/notes/common/components/FavoriteNoteItem";
import { NotePinnedSection } from "../features/notes/common/components/NotePinnedSection";
import { NoteTabStrip } from "../features/notes/common/components/NoteTabStrip";
import { NoteTreeRenderer } from "../features/notes/common/components/NoteTreeRenderer";
import { RecentNoteItem } from "../features/notes/common/components/RecentNoteItem";
import { NoteUnreadProvider } from "../features/notes/common/context/NoteUnreadContext";
import type { MyNoteMetaTreeNode } from "../features/notes/common/types/noteTypes";
import type { NoteManagementState } from "../hooks/notes/useNoteManagement";

afterEach(cleanup);

type ActiveTab = {
    kind: "my" | "task" | "chat";
    noteId: number;
    bucket?: "my" | "shared" | "team";
};

const makeUseNM = (over: { activeTab?: ActiveTab | null; currentNoteType?: number } = {}) =>
    ({
        currentNoteType: over.currentNoteType ?? 1,
        tabsApi: { activeTab: over.activeTab ?? null },
        setCurrentNoteType: vi.fn(),
        loadNote: vi.fn(),
        isNodeExpanded: () => true,
        toggleNodeExpanded: vi.fn(),
        isNoteFavorited: () => false,
        toggleFavorite: vi.fn(),
    }) as unknown as NoteManagementState;

const withUnread = (unread: boolean, children: ReactNode) => (
    <NoteUnreadProvider value={{ isUnread: () => unread, markRead: vi.fn(), unreadNotes: [] }}>
        <CssVarsProvider>
            <List>{children}</List>
        </CssVarsProvider>
    </NoteUnreadProvider>
);

const myNote = { noteType: 1, noteId: 5, parentNoteId: null, title: "Weekly plan", tsUpdated: "" };

const row = () => screen.getByRole("button", { name: /Weekly plan/ });
const isSelected = () => row().className.includes("Mui-selected");

describe("a Recents row", () => {
    it.each([
        [1, "PersonRoundedIcon"],
        [4, "ShareRoundedIcon"],
        [8, "GroupsRoundedIcon"],
        [2, "AssignmentRoundedIcon"],
        [3, "QuestionAnswerRoundedIcon"],
    ])("bucket %i wears %s", (noteType, icon) => {
        render(
            withUnread(
                false,
                <RecentNoteItem note={myNote} noteType={noteType} useNM={makeUseNM()} />
            )
        );
        expect(within(row()).getByTestId(icon)).toBeTruthy();
    });

    it("says where the note lives and when it was opened", () => {
        const locate = vi.fn(() => "My Notes › Product");
        render(
            withUnread(
                false,
                <RecentNoteItem
                    locate={locate}
                    note={myNote}
                    noteType={1}
                    openedAt="2026-11-01T09:30:00Z"
                    useNM={makeUseNM()}
                />
            )
        );
        expect(locate).toHaveBeenCalledWith(1, myNote);
        expect(within(row()).getByText("My Notes › Product")).toBeTruthy();
        // The chat list's own time label ("Today 14:08", "Nov. 1, 18:30"...).
        expect(row().querySelector(".NavItem-trailing")?.textContent).toMatch(/\d{1,2}:\d{2}/);
    });

    it("has one line, and no time, when there is nothing to say", () => {
        render(
            withUnread(false, <RecentNoteItem note={myNote} noteType={1} useNM={makeUseNM()} />)
        );
        expect(row().querySelector(".NavItem-secondary")).toBeNull();
        expect(row().querySelector(".NavItem-trailing")).toBeNull();
    });

    it("marks unread with a dot at the end of the row", () => {
        render(
            withUnread(true, <RecentNoteItem note={myNote} noteType={1} useNM={makeUseNM()} />)
        );
        expect(row().querySelector(".NavItem-trailing .NoteUnreadDot")).not.toBeNull();
    });
});

describe("which row is selected", () => {
    const open: ActiveTab = { kind: "my", noteId: 5, bucket: "my" };

    it("is the open note, in the bucket it was opened from", () => {
        render(
            withUnread(
                false,
                <RecentNoteItem
                    note={myNote}
                    noteType={1}
                    useNM={makeUseNM({ activeTab: open })}
                />
            )
        );
        expect(isSelected()).toBe(true);
        cleanup();
        render(
            withUnread(
                false,
                <RecentNoteItem
                    note={myNote}
                    noteType={8}
                    useNM={makeUseNM({ activeTab: open })}
                />
            )
        );
        expect(isSelected()).toBe(false);
    });

    it("is nothing when no note is open", () => {
        render(
            withUnread(false, <RecentNoteItem note={myNote} noteType={1} useNM={makeUseNM()} />)
        );
        expect(isSelected()).toBe(false);
    });

    it("does not follow currentNoteType: clicking another section's header leaves the open note selected", () => {
        // Clicking "Task Notes" sets currentNoteType to 2. The My note is still open in its
        // tab, so its row must stay selected. It used to lose the tint.
        render(
            withUnread(
                false,
                <RecentNoteItem
                    note={myNote}
                    noteType={1}
                    useNM={makeUseNM({ activeTab: open, currentNoteType: 2 })}
                />
            )
        );
        expect(isSelected()).toBe(true);
    });

    it("is the same for a Favorites row", () => {
        const view = (useNM: NoteManagementState) =>
            withUnread(false, <FavoriteNoteItem note={myNote} noteType={1} useNM={useNM} />);
        render(view(makeUseNM({ activeTab: open, currentNoteType: 2 })));
        expect(isSelected()).toBe(true);
        cleanup();
        render(view(makeUseNM()));
        expect(isSelected()).toBe(false);
    });

    it("is the same for a tree row", () => {
        const node: MyNoteMetaTreeNode = { ...myNote, children: [] };
        const view = (useNM: NoteManagementState) =>
            withUnread(
                false,
                <NoteTreeRenderer
                    createChildNoteList={() => null}
                    currentChain={[]}
                    node={node}
                    noteType={1}
                    timestamp="t"
                    useNM={useNM}
                />
            );
        render(view(makeUseNM({ activeTab: open, currentNoteType: 3 })));
        expect(isSelected()).toBe(true);
    });
});

describe("a note in the tree", () => {
    const node: MyNoteMetaTreeNode = { ...myNote, children: [] };
    const tree = (unread: boolean) =>
        withUnread(
            unread,
            <NoteTreeRenderer
                createChildNoteList={() => null}
                currentChain={[]}
                node={node}
                noteType={1}
                timestamp="t"
                useNM={makeUseNM()}
            />
        );

    it("is a document glyph, not a dot", () => {
        render(tree(false));
        expect(within(row()).getByTestId("DescriptionOutlinedIcon")).toBeTruthy();
    });

    it("goes unread with a dot at the end, and the title does not move", () => {
        render(tree(false));
        const titleBefore = row().querySelector(".NavItem-label")?.parentElement?.className;
        cleanup();
        render(tree(true));
        expect(row().querySelector(".NavItem-trailing .NoteUnreadDot")).not.toBeNull();
        // the leading slot is the same glyph either way: nothing grows in front of the title
        expect(within(row()).getByTestId("DescriptionOutlinedIcon")).toBeTruthy();
        expect(row().querySelector(".NavItem-label")?.parentElement?.className).toBe(titleBefore);
    });
});

describe("a favorite", () => {
    it("is a document glyph with the place inside its family, and can be un-starred", () => {
        const locate = vi.fn(() => "Product");
        render(
            withUnread(
                false,
                <FavoriteNoteItem locate={locate} note={myNote} noteType={1} useNM={makeUseNM()} />
            )
        );
        expect(within(row()).getByTestId("DescriptionOutlinedIcon")).toBeTruthy();
        expect(within(row()).getByText("Product")).toBeTruthy();
        expect(document.querySelector(".favorite-remove-btn")).not.toBeNull();
    });
});

describe("a pinned section (Favorites, Recents, Unread)", () => {
    const pinned = (props: { count?: number } = {}) => (
        <CssVarsProvider>
            <List>
                <NotePinnedSection id="test" title="Recents" {...props}>
                    <li>row</li>
                </NotePinnedSection>
            </List>
        </CssVarsProvider>
    );

    it("is a heading you can fold, never the selection", () => {
        render(pinned());
        const header = screen.getByRole("button", { name: /Recents/ });
        expect(header.className).not.toMatch(/Mui-selected/);
        expect(header.getAttribute("aria-current")).not.toBe("true");
        expect(header.getAttribute("aria-expanded")).toBe("true");
        fireEvent.click(header);
        expect(header.getAttribute("aria-expanded")).toBe("false");
        fireEvent.click(header);
        expect(header.getAttribute("aria-expanded")).toBe("true");
    });
});

describe("the tab strip", () => {
    it.each([
        [{ noteType: 1, bucket: "my" as const }, "PersonRoundedIcon"],
        [{ noteType: 1, bucket: "shared" as const }, "ShareRoundedIcon"],
        [{ noteType: 1, bucket: "team" as const }, "GroupsRoundedIcon"],
        [{ noteType: 1 }, "PersonRoundedIcon"],
        [{ noteType: 2 }, "AssignmentRoundedIcon"],
        [{ noteType: 3 }, "QuestionAnswerRoundedIcon"],
    ])("%j wears %s", (tab, icon) => {
        render(
            <CssVarsProvider>
                <NoteTabStrip
                    selectedIndex={0}
                    tabs={[{ ...tab, noteId: 1, title: "A note" }]}
                    onCloseTab={() => {}}
                    onSelect={() => {}}
                />
            </CssVarsProvider>
        );
        expect(screen.getByTestId(icon)).toBeTruthy();
    });
});
