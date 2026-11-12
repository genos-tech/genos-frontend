import { memo, ReactNode, useEffect, useState } from "react";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import { Box, List, ListItem } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { MoreMenu, MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { NavItem } from "../../../../components/ui/nav/NavItem";
import { navNestedListSx } from "../../../../components/ui/nav/navStyles";
import { g, type } from "../../../../theme/tokens";
import { DroppableHeader, SidebarDndKind } from "../dnd/sidebarNoteDnd";

interface GroupedNoteSectionProps {
    groupKey: string;
    groupLabel: string;
    // A task's display id ("QR-2"), drawn as a chip BEFORE the title so it is still there
    // when a long title is cut off by the narrow sidebar.
    subLabel?: string;
    // Said on hover over the title: where a flattened row used to live (a task's milestone),
    // or what kind of chat this is. The sidebar no longer has a folder level for either.
    tooltip?: string;
    children: ReactNode;
    defaultExpanded?: boolean;
    // Replaces the default open/closed folder glyph for this row. Used
    // by milestone folders to show the same FlagRounded icon the task
    // page uses. Callers that omit it keep the folder icon.
    leadingIcon?: ReactNode;
    // When set, the header row becomes a sidebar-DnD drop target for
    // this container (drop a note onto the task/chat folder to
    // re-anchor it). Only NoteSidebar passes these — the component
    // renders no Droppable otherwise, so other hosts don't need a
    // DragDropContext.
    droppableId?: string;
    droppableKind?: SidebarDndKind;
    // Hover-revealed "⋯" menu on the header row (new note / import here),
    // mirroring the my-note folder rows. Omitted on rows that aren't a
    // note destination — a project or a chat-type bucket can't hold a
    // note, so they get no menu.
    menuItems?: MoreMenuItem[];
}

function GroupedNoteSectionComponent({
    groupKey,
    groupLabel,
    subLabel,
    tooltip,
    children,
    defaultExpanded = false,
    droppableId,
    droppableKind,
    leadingIcon,
    menuItems,
}: GroupedNoteSectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    // Keeps the "⋯" trigger visible while its portal menu is open, or the
    // hover-reveal hides it as the pointer moves onto the menu.
    const [menuOpen, setMenuOpen] = useState(false);

    // Sticky auto-reveal: callers pass `defaultExpanded` as "the active
    // note lives somewhere in this subtree", which they recompute as the
    // open note changes. Seeding state on mount alone only revealed the
    // note that happened to be open when the section first rendered —
    // opening a note by URL, tab switch or search left its project /
    // milestone / task folders collapsed, so the sidebar showed no trace
    // of where the visible note lives. Every ancestor row runs this, so
    // the whole path opens at once.
    //
    // Only ever opens (matching the note-tree rule in `useNoteManagement`):
    // this fires on the false → true transition, so a folder the user
    // collapses by hand stays collapsed until a different note re-reveals
    // it.
    useEffect(() => {
        if (defaultExpanded) setIsExpanded(true);
    }, [defaultExpanded]);
    // Match MyNoteFolderTree: open-folder icon when expanded, closed when not.
    const FolderIcon = isExpanded ? FolderOpenRoundedIcon : FolderRoundedIcon;

    // Keep the "..." trigger visible while its portal menu is open, or
    // the hover-reveal hides it as the pointer moves onto the menu.
    // A `leadingIcon` (milestone flag) overrides the folder glyph, which
    // swaps open/closed like the my-note folder tree.
    // Dragging a note over the folder: the accent tint and a dashed ring.
    const headerButton = (isDraggingOver: boolean) => (
        <NavItem
            actionsVisible={menuOpen}
            as="div"
            expanded={isExpanded}
            icon={leadingIcon ?? <FolderIcon />}
            actions={
                menuItems && menuItems.length > 0 ? (
                    <Box onClick={(e) => e.stopPropagation()}>
                        <MoreMenu
                            iconFontSize={14}
                            items={menuItems}
                            placement="bottom-end"
                            triggerSize={20}
                            onOpenChange={setMenuOpen}
                        />
                    </Box>
                ) : undefined
            }
            label={
                <>
                    {subLabel && (
                        <Box
                            className="GroupedNoteSection-chip"
                            component="span"
                            sx={{
                                ...type("caption"),
                                background: g.hover,
                                borderRadius: g.radius.xs,
                                color: g.text.tertiary,
                                fontVariantNumeric: "tabular-nums",
                                mr: 0.75,
                                px: 0.5,
                                whiteSpace: "nowrap",
                            }}
                        >
                            {subLabel}
                        </Box>
                    )}
                    {tooltip ? (
                        <AppTooltip title={tooltip}>
                            <span>{groupLabel}</span>
                        </AppTooltip>
                    ) : (
                        groupLabel
                    )}
                </>
            }
            sx={
                isDraggingOver
                    ? {
                          background: g.accent.subtle,
                          outline: `1px dashed ${g.accent.border}`,
                      }
                    : undefined
            }
            onClick={() => setIsExpanded(!isExpanded)}
        />
    );

    return (
        <Box key={groupKey}>
            <ListItem sx={{ p: 0 }} nested>
                {droppableId && droppableKind ? (
                    <DroppableHeader containerId={droppableId} kind={droppableKind}>
                        {(isDraggingOver) => headerButton(isDraggingOver)}
                    </DroppableHeader>
                ) : (
                    headerButton(false)
                )}

                {/* Children with smooth animation */}
                <Box
                    sx={{
                        display: "grid",
                        transition: "grid-template-rows 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        gridTemplateRows: isExpanded ? "1fr" : "0fr",
                        "& > *": {
                            overflow: "hidden",
                        },
                    }}
                >
                    <List sx={navNestedListSx}>{children}</List>
                </Box>
            </ListItem>
        </Box>
    );
}

export const GroupedNoteSection = memo(GroupedNoteSectionComponent);
