/**
 * MIP-1955: the sidebars' lists are real lists to a screen reader. axe's `list` rule (serious)
 * flagged a `ul` whose children were not `li`, so a screen reader announced a wrong item count.
 * jsdom has no axe, so this checks the same rule by hand: every `ul`/`ol` holds only `li`, and
 * every `div role="list"` holds only list items, or wrappers that say `role="none"`.
 * A real-browser axe run is in the PR.
 */
import { List } from "@mui/joy";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setArchivedProjects } from "../features/archive/archiveState";
import { NotePinnedSection } from "../features/notes/common/components/NotePinnedSection";
import { NoteTreeRenderer } from "../features/notes/common/components/NoteTreeRenderer";
import { NoteUnreadProvider } from "../features/notes/common/context/NoteUnreadContext";
import type { MyNoteMetaTreeNode } from "../features/notes/common/types/noteTypes";
import { Toggler } from "../features/tasks/components/sidebar/common";
import { ArchivedProjectsListItem } from "../features/tasks/components/sidebar/projects_subs/ArchivedProjectsListItem";
import type { NoteManagementState } from "../hooks/notes/useNoteManagement";
import type { ProjectProps } from "../types/tasks";

afterEach(() => {
    cleanup();
    act(() => setArchivedProjects([]));
});

const isItem = (el: Element) => el.tagName === "LI" || el.getAttribute("role") === "listitem";

/** The offenders: children a list is not allowed to have (what axe's `list` rule reports). */
const listViolations = (root: HTMLElement): string[] => {
    const bad: string[] = [];
    const passThrough = (el: Element): boolean =>
        el.getAttribute("role") === "none" &&
        [...el.children].every((c) => isItem(c) || passThrough(c));
    root.querySelectorAll("ul, ol").forEach((list) => {
        [...list.children]
            .filter((c) => c.tagName !== "LI")
            .forEach((c) => bad.push(`ul > ${c.tagName.toLowerCase()}`));
    });
    root.querySelectorAll('[role="list"]').forEach((list) => {
        [...list.children]
            .filter((c) => !isItem(c) && !passThrough(c))
            .forEach((c) => bad.push(`role=list > ${c.tagName.toLowerCase()}`));
    });
    return bad;
};

const project = { projectId: 7, projectName: "Archived one" } as ProjectProps;

describe("Toggler directly inside a List", () => {
    it("wraps the toggle and its folder in one nested list item when asked", () => {
        const { container } = render(
            <CssVarsProvider>
                <List>
                    <Toggler renderToggle={() => <div>toggle</div>} asListItem defaultExpanded>
                        <div>folder</div>
                    </Toggler>
                </List>
            </CssVarsProvider>
        );
        expect(listViolations(container)).toEqual([]);
        expect(container.querySelector("ul > li")?.textContent).toBe("togglefolder");
    });

    it("keeps the Fragment when it already sits inside a list item", () => {
        const { container } = render(
            <CssVarsProvider>
                <div>
                    <Toggler renderToggle={() => <div>toggle</div>} defaultExpanded>
                        <div>folder</div>
                    </Toggler>
                </div>
            </CssVarsProvider>
        );
        expect(container.querySelector("li")).toBeNull();
    });
});

describe("the Tasks sidebar sections", () => {
    it("Archived projects is a list item holding a div row, not a list item inside a list item", () => {
        act(() => setArchivedProjects([project]));
        const { container } = render(
            <CssVarsProvider>
                <List>
                    <ArchivedProjectsListItem
                        usePM={{ currentProject: null, openProject: vi.fn() } as never}
                    />
                </List>
            </CssVarsProvider>
        );
        fireEvent.click(container.querySelector("[aria-expanded]") as Element);
        expect(listViolations(container)).toEqual([]);
        expect(container.querySelector("li > li")).toBeNull();
    });
});

describe("the Notes sidebar sections", () => {
    const useNM = {
        currentNoteType: 1,
        tabsApi: { activeTab: null },
        setCurrentNoteType: vi.fn(),
        loadNote: vi.fn(),
        isNodeExpanded: () => true,
        toggleNodeExpanded: vi.fn(),
        isNoteFavorited: () => false,
        toggleFavorite: vi.fn(),
    } as unknown as NoteManagementState;
    const child: MyNoteMetaTreeNode = {
        noteType: 1,
        noteId: 2,
        parentNoteId: 1,
        title: "Child",
        tsUpdated: "",
        children: [],
    } as unknown as MyNoteMetaTreeNode;
    const root = { ...child, noteId: 1, parentNoteId: null, title: "Root", children: [child] };

    it("a pinned section and a note tree nest list items without a stray wrapper", () => {
        const { container } = render(
            <NoteUnreadProvider
                value={{ isUnread: () => false, markRead: vi.fn(), unreadNotes: [] }}
            >
                <CssVarsProvider>
                    <List>
                        <NotePinnedSection id="fav" title="Favorites">
                            <NoteTreeRenderer
                                createChildNoteList={() => null}
                                currentChain={[]}
                                node={root}
                                noteType={1}
                                timestamp=""
                                useNM={useNM}
                            />
                        </NotePinnedSection>
                    </List>
                </CssVarsProvider>
            </NoteUnreadProvider>
        );
        expect(container.querySelectorAll("li").length).toBeGreaterThan(1);
        expect(listViolations(container)).toEqual([]);
    });
});
