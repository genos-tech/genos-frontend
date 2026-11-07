import { memo, ReactNode, useEffect, useRef, useState } from "react";
import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { Box, IconButton, List, ListItem } from "@mui/joy";

import { MoreMenu, MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { NavItem } from "../../../../components/ui/nav/NavItem";
import { NAV_KEEP_CLASS, navNestedListSx } from "../../../../components/ui/nav/navStyles";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { useNoteUnread } from "../context/NoteUnreadContext";
import { BaseNoteTreeNode } from "../types/noteTypes";
import { isPersonalNoteBucket } from "../utils/noteTypeAlias";
import { NoteDot } from "./NoteDot";

interface NoteTreeRendererProps<T extends BaseNoteTreeNode> {
    node: T;
    // Bumped by `useNoteTreeState` whenever the tree or the selected tab
    // changes. It is a prop ONLY so the `memo` below sees a change and
    // re-renders the row; it must never reach a React `key`, because a key
    // change unmounts and rebuilds the row's whole subtree (every child row
    // and the "⋯" menu), which is what used to happen on every refresh tick.
    timestamp: string;
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
    timestamp,
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

    // Open state is owned by useNoteManagement so the whole tree shares a
    // single Set instead of one useState + useEffect per row. Sticky
    // auto-expand (chain membership → open) runs once in the hook.
    const open = useNM.isNodeExpanded(noteType, node.noteId);
    const hasChildren = node.children.length > 0;

    // Check if this specific node is currently selected.
    // noteType=4 (shared personal notes) shares the editor slot with
    // myNote, so it highlights against `currentMyNote`.
    const isSelected =
        useNM.currentNoteType === noteType &&
        node?.noteId ===
            (noteType === 1
                ? useNM.currentMyNote?.noteId
                : noteType === 2
                  ? useNM.currentTaskNote?.noteId
                  : noteType === 3
                    ? useNM.currentChatNote?.noteId
                    : // 4 (shared) and 8 (team) are UI-only buckets over
                      // personal notes, so both highlight off currentMyNote.
                      isPersonalNoteBucket(noteType)
                      ? useNM.currentMyNote?.noteId
                      : 0);

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

    // Check if this note is favorited
    const isFavorited = useNM.isNoteFavorited(node.noteId, noteType);

    // Keep the row-menu trigger visible while its portal menu is open —
    // otherwise the hover-reveal hides it the moment the pointer moves
    // onto the menu itself.
    const [rowMenuOpen, setRowMenuOpen] = useState(false);
    const menuItems = rowMenuItems ? rowMenuItems(node) : null;

    const handleFavoriteClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await useNM.toggleFavorite(node.noteId, noteType);
    };

    if (!currentChain) return null;

    return (
        <Box
            sx={{
                position: "relative",
            }}
        >
            <ListItem nested sx={{ p: 0, m: 0 }}>
                {/* The row is the shared NavItem. It does NOT expand on click:
                    opening a note should reveal the note, not unfold its child
                    notes (the chevron, or the arrow keys, are the control for
                    that; the ancestor chain still auto-expands in
                    `useNoteManagement`, so the row itself stays visible). */}
                <NavItem
                    ref={rowRef}
                    as="div"
                    expanded={hasChildren ? open : undefined}
                    reserveChevron
                    selected={isSelected}
                    unread={hasUnread}
                    icon={<NoteDot unread={hasUnread} />}
                    label={node.title || t.notes.defaults.untitled}
                    // Keep the "..." trigger visible while its portal menu is
                    // open: otherwise the hover-reveal hides it the moment the
                    // pointer moves onto the menu itself.
                    actionsVisible={rowMenuOpen}
                    actions={
                        <>
                            {/* Favorite toggle: a lit star stays visible, an
                                unlit one appears with the other actions. */}
                            <IconButton
                                className={`favorite-btn${isFavorited ? ` ${NAV_KEEP_CLASS}` : ""}`}
                                size="sm"
                                variant="plain"
                                sx={{
                                    minWidth: 20,
                                    minHeight: 20,
                                    borderRadius: g.radius.xs,
                                    "--IconButton-size": "20px",
                                }}
                                onClick={handleFavoriteClick}
                            >
                                {isFavorited ? (
                                    <StarRoundedIcon
                                        sx={{ fontSize: 14, color: g.warning.solid }}
                                    />
                                ) : (
                                    <StarOutlineRoundedIcon
                                        sx={{ fontSize: 14, color: g.text.tertiary }}
                                    />
                                )}
                            </IconButton>

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
                    onClick={handleClick}
                    onToggleExpanded={handleChevronClick}
                />

                {/* Children: rendered only when expanded so collapsed
                    subtrees pay zero render cost. Trade-off vs. the previous
                    CSS-grid trick: loses the slide animation but unmounts
                    deep subtrees entirely, which dominates at heavy scale. */}
                {open && hasChildren && (
                    <List sx={navNestedListSx}>
                        {node.children.map((child) => (
                            <NoteTreeRenderer
                                key={child.noteId}
                                createChildNoteList={createChildNoteList}
                                currentChain={currentChain}
                                depth={depth + 1}
                                node={child as T}
                                noteType={noteType}
                                rowMenuItems={rowMenuItems}
                                timestamp={timestamp}
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
