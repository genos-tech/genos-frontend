import { ReactNode, useEffect, useState } from "react";
import { Box, List, ListItem } from "@mui/joy";

import { NavItem } from "../../../../components/ui/nav/NavItem";
import { navNestedListSx } from "../../../../components/ui/nav/navStyles";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";

interface NoteTypeSectionProps {
    title: string;
    noteType: number;
    icon: ReactNode;
    children: ReactNode;
    useNM: NoteManagementState;
    isDisabled?: boolean;
    /**
     * Override "is the open note mine?", which is otherwise the note's
     * bucket matching this section's. Needed by the one case where a row
     * renders outside its bucket's section: a folder another team shared
     * with us keeps bucket 8 (it is a team note in storage and in every
     * bucket-keyed lookup) but hangs under Shared Notes. Without this,
     * opening one lights up and unfolds Team Notes — a section the row
     * isn't in.
     */
    isSelected?: boolean;
}

export function NoteTypeSection({
    title,
    noteType,
    icon,
    children,
    useNM,
    isDisabled = false,
    isSelected: isSelectedOverride,
}: NoteTypeSectionProps) {
    const { t } = useTranslation();
    const isSelected = isSelectedOverride ?? useNM.currentNoteType === noteType;

    // Initialize open state based on whether this section is selected
    const [open, setOpen] = useState(isSelected);

    // Auto-expand when this note type becomes selected
    useEffect(() => {
        if (isSelected && !open) {
            setOpen(true);
        }
    }, [isSelected]);

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

    return (
        <ListItem sx={{ mt: 0.5, p: 0 }} nested>
            <NavItem
                as="div"
                disabled={isDisabled}
                expanded={isDisabled ? undefined : open}
                icon={icon}
                label={title}
                selected={isSelected}
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
