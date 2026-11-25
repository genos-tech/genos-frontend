import { memo, ReactNode, useEffect, useRef, useState } from "react";
import { Box, List, ListItem } from "@mui/joy";

import { MoreMenu, MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { NavItem } from "../../../../components/ui/nav/NavItem";
import { navNestedListSx } from "../../../../components/ui/nav/navStyles";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { useNoteUnread } from "../context/noteUnreadState";
import { BaseNoteTreeNode } from "../types/noteTypes";
import { isHtmlNote } from "../utils/htmlNote";
import { isNoteOpen } from "../utils/openNote";
import { HtmlNoteChipFor } from "./HtmlNoteChip";
import { NoteFavoriteStar } from "./NoteFavoriteStar";
import { NoteKindIcon } from "./noteOrigin";
import { NoteUnreadDot } from "./NoteUnreadDot";

interface NoteTreeRendererProps<T extends BaseNoteTreeNode> {
    node: T;
    // The tab that is open. A prop (and not read from `useNM` alone) so the row's `memo` sees the
    // selection change: only rows whose selected state flips need to re-render (MIP-1678). It
    // replaces the `timestamp` that `useNoteTreeState` used to bump on every tree or tab change.
    activeTab: Parameters<typeof isNoteOpen>[0];
    currentChain: T[] | undefined;
    noteType: number;
    useNM: NoteManagementState;
    createChildNoteList: (node: T) => ReactNode;
    depth?: number;
    // Optional per-row "⋯" menu (e.g. "Move to folder…" on my notes).
    // Rendered next to the favorite star with the same hover-reveal.
    // Passed down recursively so child rows get the menu too.
    rowMenuItems?: (node: T) => MoreMenuItem[];
}

function NoteTreeRendererComponent<T extends BaseNoteTreeNode>({
    node,
    activeTab,
    currentChain,
    noteType,
    useNM,
    createChildNoteList,
    depth = 0,
    rowMenuItems,
}: NoteTreeRendererProps<T>) {
    const { t } = useTranslation();
    const { isUnread, markRead } = useNoteUnread();
    const hasUnread = isUnread(noteType, node.noteId);
    // The HTML chip (MIP-2316) sits before the unread dot; the title truncates before both.
    const trailing =
        isHtmlNote(node) || hasUnread ? (
            <>
                <HtmlNoteChipFor note={node} />
                {hasUnread && <NoteUnreadDot />}
            </>
        ) : undefined;

    // Open state is owned by useNoteManagement so the whole tree shares a
    // single Set instead of one useState + useEffect per row. Sticky
    // auto-expand (chain membership → open) runs once in the hook.
    const open = useNM.isNodeExpanded(noteType, node.noteId);
    const hasChildren = node.children.length > 0;

    // Is this the note that is open? Asked of the active tab, not of `currentNoteType`:
    // clicking a section header changes that, and used to un-tint the open note (MIP-1429).
    const isSelected = isNoteOpen(activeTab, noteType, node.noteId);

    // Bring the row for the newly-opened note into view. The folder rows
    // above it auto-expand (GroupedNoteSection / the expanded-node set),
    // but a revealed row can still sit outside the scrolled viewport —
    // e.g. a note opened from a URL, a tab or the recents list.
    // `block: "nearest"` scrolls the minimum needed, so a row that is
    // already visible doesn't move the sidebar under the user.
    // The scroll is deferred past the folder rows' expand transition
    // (0.2s of `grid-template-rows`) — measured mid-animation the row is
    // still collapsed to zero height and lands in the wrong place.
    const rowRef = useRef<HTMLElement | null>(null);
    const wasSelected = useRef(false);
    useEffect(() => {
        const justSelected = isSelected && !wasSelected.current;
        wasSelected.current = isSelected;
        if (!justSelected) return;
        const timer = setTimeout(() => {
            rowRef.current?.scrollIntoView({ block: "nearest" });
        }, 260);
        return () => clearTimeout(timer);
    }, [isSelected]);

    const handleClick = () => {
        useNM.setCurrentNoteType(noteType);
        localStorage.setItem("lastOpenNoteType", String(noteType));
        useNM.loadNote(noteType, node.noteId, -1);
        // Opening a note clears its unread @mentions (chat-style read).
        if (hasUnread) markRead(noteType, node.noteId);

        // Deliberately does NOT expand this node: opening a note should
        // reveal the note, not unfold its child notes. The chevron is the
        // control for that (and the ancestor chain still auto-expands in
        // `useNoteManagement`, so the row itself stays visible).
    };

    const handleChevronClick = (e: React.SyntheticEvent) => {
        e.stopPropagation();
        useNM.toggleNodeExpanded(noteType, node.noteId);
    };

    // Keep the row-menu trigger visible while its portal menu is open —
    // otherwise the hover-reveal hides it the moment the pointer moves
    // onto the menu itself.
    const [rowMenuOpen, setRowMenuOpen] = useState(false);
    const menuItems = rowMenuItems ? rowMenuItems(node) : null;

    if (!currentChain) return null;

    return (
        <Box
            // No role of its own: the `li` inside is the list item (MIP-1955).
            role="none"
            sx={{
                position: "relative",
            }}
        >
            <ListItem component="li" sx={{ p: 0, m: 0 }} nested>
                {/* The row is the shared NavItem. It does NOT expand on click:
                    opening a note should reveal the note, not unfold its child
                    notes (the chevron, or the arrow keys, are the control for
                    that; the ancestor chain still auto-expands in
                    `useNoteManagement`, so the row itself stays visible). */}
                <NavItem
                    ref={rowRef}
                    actionsVisible={rowMenuOpen}
                    as="div"
                    expanded={hasChildren ? open : undefined}
                    icon={<NoteKindIcon note={node} />}
                    label={node.title || t.notes.defaults.untitled}
                    selected={isSelected}
                    trailing={trailing}
                    unread={hasUnread}
                    // Keep the "..." trigger visible while its portal menu is
                    // open: otherwise the hover-reveal hides it the moment the
                    // pointer moves onto the menu itself.
                    actions={
                        <>
                            <NoteFavoriteStar
                                noteId={node.noteId}
                                noteType={noteType}
                                useNM={useNM}
                            />

                            {/* Optional per-row "..." menu. */}
                            {menuItems && menuItems.length > 0 && (
                                <Box className="row-menu-btn" onClick={(e) => e.stopPropagation()}>
                                    <MoreMenu
                                        iconFontSize={14}
                                        items={menuItems}
                                        placement="bottom-end"
                                        triggerSize={20}
                                        onOpenChange={setRowMenuOpen}
                                    />
                                </Box>
                            )}
                        </>
                    }
                    reserveChevron
                    onClick={handleClick}
                    onToggleExpanded={handleChevronClick}
                />

                {/* Children: rendered only when expanded so collapsed
                    subtrees pay zero render cost. Trade-off vs. the previous
                    CSS-grid trick: loses the slide animation but unmounts
                    deep subtrees entirely, which dominates at heavy scale. */}
                {open && hasChildren && (
                    <List component="div" role="list" sx={navNestedListSx}>
                        {node.children.map((child) => (
                            <NoteTreeRenderer
                                key={child.noteId}
                                activeTab={activeTab}
                                createChildNoteList={createChildNoteList}
                                currentChain={currentChain}
                                depth={depth + 1}
                                node={child as T}
                                noteType={noteType}
                                rowMenuItems={rowMenuItems}
                                useNM={useNM}
                            />
                        ))}
                    </List>
                )}
            </ListItem>
        </Box>
    );
}

export const NoteTreeRenderer = memo(NoteTreeRendererComponent) as <T extends BaseNoteTreeNode>(
    props: NoteTreeRendererProps<T>
) => React.JSX.Element;
