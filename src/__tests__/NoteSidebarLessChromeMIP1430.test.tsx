/**
 * The notes sidebar, phase 2 of MIP-1428 (MIP-1430): less chrome.
 *
 *   - a family row carries a "+" (hover on a pointer device, always on touch) in place of the
 *     dashed "New ..." rows, and the My Notes row is the "move to the top level" drop target;
 *   - an empty list is one line with the way out in it;
 *   - the star has a name, is on Recents rows, and a folder's menu offers "Add to favorites";
 *   - task notes are project › task › note and chat notes chat › note (`flattenNoteGroups`);
 *   - a task row leads with its display-id chip and says its milestone on hover.
 *
 * jsdom cannot measure layout or hover; the look was checked in a browser (see the PR).
 */
import { ReactNode } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import { List } from "@mui/joy";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmptyState } from "../components/ui/feedback/EmptyState";
import { MoreMenu } from "../components/ui/MoreMenu";
import { FavoriteNoteItem } from "../features/notes/common/components/FavoriteNoteItem";
import { FolderFavoriteStar } from "../features/notes/common/components/FolderFavoriteStar";
import { GroupedNoteSection } from "../features/notes/common/components/GroupedNoteSection";
import { NoteFavoriteStar } from "../features/notes/common/components/NoteFavoriteStar";
import { NoteListState } from "../features/notes/common/components/NoteListState";
import { NoteTypeSection } from "../features/notes/common/components/NoteTypeSection";
import { RecentNoteItem } from "../features/notes/common/components/RecentNoteItem";
import { NoteUnreadProvider } from "../features/notes/common/context/NoteUnreadContext";
import { chatRows, projectRows } from "../features/notes/common/utils/flattenNoteGroups";
import { folderFavoriteMenuItem } from "../features/notes/common/utils/folderFavoriteMenuItem";
import type { NoteManagementState } from "../hooks/notes/useNoteManagement";
import { en } from "../i18n/locales/en";

afterEach(cleanup);

const sidebar = en.notes.sidebar;

const makeUseNM = (over: Record<string, unknown> = {}) =>
    ({
        currentNoteType: 1,
        tabsApi: { activeTab: null },
        setCurrentNoteType: vi.fn(),
        loadNote: vi.fn(),
        isNoteFavorited: () => false,
        toggleFavorite: vi.fn(),
        isFolderFavorited: () => false,
        toggleFolderFavorite: vi.fn(),
        ...over,
    }) as unknown as NoteManagementState;

const shell = (children: ReactNode) => (
    <NoteUnreadProvider value={{ isUnread: () => false, markRead: vi.fn(), unreadNotes: [] }}>
        <CssVarsProvider>
            <DragDropContext onDragEnd={() => {}}>
                <List>{children}</List>
            </DragDropContext>
        </CssVarsProvider>
    </NoteUnreadProvider>
);

const note = { noteType: 1 as const, noteId: 5, parentNoteId: null, title: "Plan", tsUpdated: "" };

describe("a family row", () => {
    const section = (props: Partial<Parameters<typeof NoteTypeSection>[0]> = {}) =>
        shell(
            <NoteTypeSection
                icon={null}
                noteType={1}
                title="My Notes"
                useNM={makeUseNM()}
                {...props}
            >
                <li>child</li>
            </NoteTypeSection>
        );

    it("carries the actions it is given, beside the row and not inside it", () => {
        render(section({ actions: () => <button aria-label="New">+</button> }));
        const plus = screen.getByRole("button", { name: "New" });
        const row = screen.getByRole("button", { name: /My Notes/ });
        expect(row.contains(plus)).toBe(false);
    });

    it("has none when it is given none", () => {
        render(section());
        expect(screen.queryByRole("button", { name: "New" })).toBeNull();
    });

    it("hands the actions a way to say a menu in them is open", () => {
        const spy = vi.fn();
        render(
            section({
                actions: (setMenuOpen) => {
                    spy(setMenuOpen);
                    return <button aria-label="New">+</button>;
                },
            })
        );
        expect(typeof spy.mock.calls[0][0]).toBe("function");
    });

    it("is a drop target for its container when asked, so a note can be dropped on My Notes", () => {
        render(section({ dropTarget: { containerId: "my-root", kind: 1 } }));
        expect(document.querySelector('[data-rfd-droppable-id="hdr:my-root"]')).not.toBeNull();
    });

    it("is no drop target otherwise", () => {
        render(section());
        expect(document.querySelector("[data-rfd-droppable-id]")).toBeNull();
    });

    it("keeps folding when the row is clicked, and the actions do not fold it", () => {
        render(section({ actions: () => <button aria-label="New">+</button> }));
        const row = screen.getByRole("button", { name: /My Notes/ });
        expect(row.getAttribute("aria-expanded")).toBe("true");
        fireEvent.click(screen.getByRole("button", { name: "New" }));
        expect(row.getAttribute("aria-expanded")).toBe("true");
    });
});

describe('the "+" menu', () => {
    it("is a MoreMenu with its own glyph and name", () => {
        const Glyph = (props: { sx?: unknown }) => (
            <svg data-testid="plus-glyph" {...(props as object)} />
        );
        render(
            <CssVarsProvider>
                <MoreMenu
                    TriggerIcon={Glyph}
                    ariaLabel={sidebar.newMenu}
                    items={[{ id: "a", label: "New note", icon: null, onClick: () => {} }]}
                />
            </CssVarsProvider>
        );
        const trigger = screen.getByRole("button", { name: sidebar.newMenu });
        expect(within(trigger).getByTestId("plus-glyph")).toBeTruthy();
        expect(within(trigger).queryByTestId("MoreHorizRoundedIcon")).toBeNull();
    });

    it("keeps the three dots by default", () => {
        render(
            <CssVarsProvider>
                <MoreMenu items={[{ id: "a", label: "x", icon: null, onClick: () => {} }]} />
            </CssVarsProvider>
        );
        expect(screen.getByTestId("MoreHorizRoundedIcon")).toBeTruthy();
    });
});

describe("an empty list", () => {
    it("is one line with the way out as a link at its end", () => {
        const onClick = vi.fn();
        render(
            <CssVarsProvider>
                <EmptyState
                    action={{ label: "New note", onClick, inline: true }}
                    body="No notes yet"
                    data-empty="my-notes"
                    size="xs"
                />
            </CssVarsProvider>
        );
        const wrap = document.querySelector('[data-empty="my-notes"]') as HTMLElement;
        const link = within(wrap).getByRole("button", { name: "New note" });
        // inline: in the same flex row as the text, not a Button on a row of its own
        expect(link.parentElement).toBe(wrap);
        expect(link.className).not.toMatch(/MuiButton-/);
        fireEvent.click(link);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("is still a button on its own line unless asked to be inline", () => {
        render(
            <CssVarsProvider>
                <EmptyState
                    action={{ label: "New note", onClick: () => {} }}
                    body="No notes yet"
                    size="xs"
                />
            </CssVarsProvider>
        );
        expect(screen.getByRole("button", { name: "New note" }).className).toMatch(/MuiButton-/);
    });

    it("on a notes list passes the link through, and the list's failure state still wins", () => {
        const onClick = vi.fn();
        render(
            <CssVarsProvider>
                <NoteListState
                    action={{ label: "New team folder", onClick }}
                    body="No team folders yet"
                    emptyMarker="team-folders"
                    hasAny={false}
                    scope="teamFolders"
                />
            </CssVarsProvider>
        );
        fireEvent.click(screen.getByRole("button", { name: "New team folder" }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("on a notes list has no link when it is given none (a guest)", () => {
        render(
            <CssVarsProvider>
                <NoteListState
                    body="No team folders yet"
                    emptyMarker="team-folders"
                    hasAny={false}
                    scope="teamFolders"
                />
            </CssVarsProvider>
        );
        expect(screen.queryByRole("button")).toBeNull();
    });
});

describe("the favorite star", () => {
    it("is named for what it will do, and toggles with the row's own bucket", () => {
        const useNM = makeUseNM();
        render(<NoteFavoriteStar noteId={7} noteType={8} useNM={useNM} />);
        fireEvent.click(screen.getByRole("button", { name: sidebar.addToFavorites }));
        expect(useNM.toggleFavorite).toHaveBeenCalledWith(7, 8);
    });

    it("says Remove when it is lit", () => {
        render(
            <NoteFavoriteStar
                noteId={7}
                noteType={1}
                useNM={makeUseNM({ isNoteFavorited: () => true })}
            />
        );
        expect(screen.getByRole("button", { name: sidebar.removeFromFavorites })).toBeTruthy();
    });

    it("does not open the row it sits beside", () => {
        const useNM = makeUseNM();
        const onRow = vi.fn();
        render(
            <div onClick={onRow}>
                <NoteFavoriteStar noteId={7} noteType={1} useNM={useNM} />
            </div>
        );
        fireEvent.click(screen.getByRole("button"));
        expect(onRow).not.toHaveBeenCalled();
    });

    it("is on a Recents row", () => {
        const useNM = makeUseNM();
        render(shell(<RecentNoteItem note={note} noteType={1} useNM={useNM} />));
        fireEvent.click(screen.getByRole("button", { name: sidebar.addToFavorites }));
        expect(useNM.toggleFavorite).toHaveBeenCalledWith(5, 1);
        // and starring does not open the note
        expect(useNM.loadNote).not.toHaveBeenCalled();
    });

    it("the remove button in Favorites has a name", () => {
        render(shell(<FavoriteNoteItem note={note} noteType={1} useNM={makeUseNM()} />));
        expect(screen.getByRole("button", { name: sidebar.removeFromFavorites })).toBeTruthy();
    });

    it("a folder's star has a name that follows its state", () => {
        render(<FolderFavoriteStar folderId={3} useNM={makeUseNM()} />);
        expect(screen.getByRole("button", { name: sidebar.addToFavorites })).toBeTruthy();
        cleanup();
        render(
            <FolderFavoriteStar
                folderId={3}
                useNM={makeUseNM({ isFolderFavorited: () => true })}
            />
        );
        expect(screen.getByRole("button", { name: sidebar.removeFromFavorites })).toBeTruthy();
    });
});

describe("a folder's menu item for favorites", () => {
    const labels = { add: "Add", remove: "Remove" };

    it("adds, and is a 'favorite' kind so it sorts with the other personal marks", () => {
        const useNM = makeUseNM();
        const item = folderFavoriteMenuItem(3, useNM, labels);
        expect(item.label).toBe("Add");
        expect(item.kind).toBe("favorite");
        item.onClick();
        expect(useNM.toggleFolderFavorite).toHaveBeenCalledWith(3);
    });

    it("removes when the folder is already a favorite", () => {
        const item = folderFavoriteMenuItem(
            3,
            makeUseNM({ isFolderFavorited: () => true }),
            labels
        );
        expect(item.label).toBe("Remove");
    });
});

describe("a task or chat row", () => {
    const section = (props: Partial<Parameters<typeof GroupedNoteSection>[0]>) =>
        shell(
            <GroupedNoteSection groupKey="k" groupLabel="Synthesize interviews" {...props}>
                <li>note</li>
            </GroupedNoteSection>
        );

    it("leads with the display id as a chip, so a cut-off title still has it", () => {
        render(section({ subLabel: "QR-2" }));
        const label = document.querySelector(".NavItem-label") as HTMLElement;
        const chip = label.querySelector(".GroupedNoteSection-chip") as HTMLElement;
        expect(chip.textContent).toBe("QR-2");
        // the chip comes first in the label
        expect(label.firstElementChild).toBe(chip);
        expect(label.textContent).toBe("QR-2Synthesize interviews");
    });

    it("has no chip without an id", () => {
        render(section({}));
        expect(document.querySelector(".GroupedNoteSection-chip")).toBeNull();
    });

    it("says what it was part of on hover", () => {
        render(section({ tooltip: "Milestone: Q4 Discovery Sprint" }));
        expect(screen.getByLabelText("Milestone: Q4 Discovery Sprint").textContent).toBe(
            "Synthesize interviews"
        );
    });

    it("has no tooltip when there is nothing to say", () => {
        render(section({}));
        expect(document.querySelector("[aria-label]")).toBeNull();
    });
});

describe("which rows a project shows (project › task › note)", () => {
    type T = { id: string };
    type M = { milestoneId: number; directNotes: unknown[]; tasks: T[] };
    const task = (id: string): T => ({ id });
    const ms = (milestoneId: number, directNotes: number, tasks: T[]): M => ({
        milestoneId,
        directNotes: Array.from({ length: directNotes }),
        tasks,
    });

    it("has no folder level for a milestone: its tasks sit beside the loose ones", () => {
        const rows = projectRows<M, T>({
            milestones: [ms(1, 0, [task("a"), task("b")])],
            looseTasks: [task("c")],
        });
        expect(rows.map((r) => (r.kind === "task" ? r.task.id : "M"))).toEqual(["a", "b", "c"]);
    });

    it("tells each task which milestone it is in, and the loose ones none", () => {
        const m = ms(1, 0, [task("a")]);
        const rows = projectRows<M, T>({ milestones: [m], looseTasks: [task("c")] });
        expect(rows[0]).toMatchObject({ kind: "task", milestone: m });
        expect(rows[1]).not.toHaveProperty("milestone");
    });

    it("draws a milestone's own row only when it has notes of its own, before its tasks", () => {
        const withNotes = ms(1, 2, [task("a")]);
        const rows = projectRows<M, T>({
            milestones: [withNotes, ms(2, 0, [task("b")])],
            looseTasks: [],
        });
        expect(
            rows.map((r) => (r.kind === "task" ? r.task.id : `M${r.milestone.milestoneId}`))
        ).toEqual(["M1", "a", "b"]);
    });

    it("is empty for a project with nothing", () => {
        expect(projectRows<M, T>({ milestones: [], looseTasks: [] })).toEqual([]);
    });
});

describe("which rows Chat Notes shows (chat › note)", () => {
    it("lists the chats of every kind in one list, each with its kind's name, in order", () => {
        const rows = chatRows([
            { chatTypeName: "Group", chats: ["g1", "g2"] },
            { chatTypeName: "Direct message", chats: ["d1"] },
        ]);
        expect(rows).toEqual([
            { chat: "g1", kindName: "Group" },
            { chat: "g2", kindName: "Group" },
            { chat: "d1", kindName: "Direct message" },
        ]);
    });

    it("is empty with no chats", () => {
        expect(chatRows([])).toEqual([]);
        expect(chatRows([{ chatTypeName: "Group", chats: [] }])).toEqual([]);
    });
});

describe("the shared notes family", () => {
    it("is called 'Shared with me'", () => {
        expect(sidebar.sharedNotes).toBe("Shared with me");
    });
});
