import { ReactNode, useEffect, useState } from "react";
import { Box, List, ListItem } from "@mui/joy";

import { NavItem } from "../../../../components/ui/nav/NavItem";
import { navNestedListSx } from "../../../../components/ui/nav/navStyles";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";
import { DroppableHeader, type SidebarDndKind } from "../dnd/sidebarNoteDnd";

interface NoteTypeSectionProps {
    title: string;
    noteType: number;
    icon: ReactNode;
    children: ReactNode;
    useNM: NoteManagementState;
    isDisabled?: boolean;
    /**
     * Override "is the open note in this section?", which is otherwise the note's
     * bucket matching this section's. Needed by the one case where a row
     * renders outside its bucket's section: a folder another team shared
     * with us keeps bucket 8 (it is a team note in storage and in every
     * bucket-keyed lookup) but hangs under Shared Notes. Without this,
     * opening one unfolds Team Notes — a section the row isn't in.
     *
     * It decides what unfolds, never what is tinted: a section header is not a
     * selection (MIP-1429). Only the open note's own row is.
     */
    isCurrent?: boolean;
    /**
     * Row actions on the header, a "+" that makes something in this family (MIP-1430). They
     * show on hover or keyboard focus, and always on touch, so the family row stays one quiet
     * line. Gets `setMenuOpen` to tell the row a menu in them is open, or the hover-reveal
     * hides them as the pointer moves onto the menu.
     */
    actions?: (setMenuOpen: (open: boolean) => void) => ReactNode;
    /**
     * Makes the header a drop target for this container, so a note can be dropped on the
     * family row itself (collapsed or not). My Notes uses it for "move to the top level",
     * which the dashed "New folder / New note" row used to be.
     */
    dropTarget?: { containerId: string; kind: SidebarDndKind };
}

export function NoteTypeSection({
    title,
    noteType,
    icon,
    children,
    useNM,
    isDisabled = false,
    isCurrent: isCurrentOverride,
    actions,
    dropTarget,
}: NoteTypeSectionProps) {
    const { t } = useTranslation();
    const isCurrent = isCurrentOverride ?? useNM.currentNoteType === noteType;

    // Initialize open state based on whether the open note is in this section
    const [open, setOpen] = useState(isCurrent);
    const [menuOpen, setMenuOpen] = useState(false);

    // Auto-expand when the open note comes to live in this section
    useEffect(() => {
        if (isCurrent && !open) {
            setOpen(true);
        }
    }, [isCurrent]);

    const handleClick = () => {
        if (!isDisabled) {
            // Toggle open state
            setOpen((prev) => !prev);
            // Set note type
            useNM.setCurrentNoteType(noteType);
            localStorage.setItem("lastOpenNoteType", String(noteType));
        }
    };

    const handleChevronClick = (e: React.SyntheticEvent) => {
        e.stopPropagation();
        if (!isDisabled) {
            setOpen((prev) => !prev);
        }
    };

    // A note dragged over the row takes the accent tint and a dashed ring, as a folder does.
    const header = (isDraggingOver: boolean) => (
        <NavItem
            actions={actions && !isDisabled ? actions(setMenuOpen) : undefined}
            actionsVisible={menuOpen}
            as="div"
            disabled={isDisabled}
            expanded={isDisabled ? undefined : open}
            icon={icon}
            label={title}
            sx={
                isDraggingOver
                    ? { background: g.accent.subtle, outline: `1px dashed ${g.accent.border}` }
                    : undefined
            }
            // The chevron is its own target: it folds the section without
            // selecting the note type.
            trailing={
                isDisabled ? (
                    <Box
                        component="span"
                        sx={{
                            ...type("caption"),
                            color: g.text.tertiary,
                            background: g.hover,
                            px: 0.75,
                            borderRadius: g.radius.xs,
                            textTransform: "uppercase",
                        }}
                    >
                        {t.notes.sidebar.soonBadge}
                    </Box>
                ) : undefined
            }
            onClick={handleClick}
            onToggleExpanded={handleChevronClick}
        />
    );

    return (
        <ListItem sx={{ mt: 0.5, p: 0 }} nested>
            {dropTarget ? (
                <DroppableHeader containerId={dropTarget.containerId} kind={dropTarget.kind}>
                    {(isDraggingOver) => header(isDraggingOver)}
                </DroppableHeader>
            ) : (
                header(false)
            )}

            {/* Collapsible content with smooth animation */}
            <Box
                sx={{
                    display: "grid",
                    transition: "grid-template-rows 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    gridTemplateRows: open ? "1fr" : "0fr",
                    "& > *": {
                        overflow: "hidden",
                    },
                }}
            >
                <List sx={navNestedListSx}>{children}</List>
            </Box>
        </ListItem>
    );
}
