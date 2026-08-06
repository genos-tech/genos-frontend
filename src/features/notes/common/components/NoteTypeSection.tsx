import { ReactNode, useEffect, useState } from "react";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { Box, List, ListItem, ListItemButton, ListItemContent, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";

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
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
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

    const handleChevronClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isDisabled) {
            setOpen((prev) => !prev);
        }
    };

    return (
        <ListItem sx={{ mt: 0.5 }} nested>
            <ListItemButton
                disabled={isDisabled}
                selected={isSelected}
                sx={{
                    borderRadius: "10px",
                    py: 0.875,
                    px: 1.5,
                    gap: 1.5,
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    opacity: isDisabled ? 0.5 : 1,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    // Hover-only on real pointers — sticky :hover on touch
                    // can eat the first tap before the section expands.
                    "@media (hover: hover) and (pointer: fine)": {
                        "&:hover": {
                            backgroundColor: isDisabled
                                ? "transparent"
                                : isDark
                                  ? "rgba(255,255,255,0.06)"
                                  : "rgba(0,0,0,0.04)",
                        },
                    },
                    "&.Mui-selected": {
                        backgroundColor: isDark
                            ? "rgba(var(--gp-brand-700-rgb), 0.15)"
                            : "rgba(var(--gp-brand-700-rgb), 0.1)",
                        "@media (hover: hover) and (pointer: fine)": {
                            "&:hover": {
                                backgroundColor: isDark
                                    ? "rgba(var(--gp-brand-700-rgb), 0.2)"
                                    : "rgba(var(--gp-brand-700-rgb), 0.15)",
                            },
                        },
                    },
                    "&.Mui-disabled": {
                        opacity: 0.5,
                    },
                }}
                onClick={handleClick}
            >
                <Box
                    sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                        transition: "all 0.2s ease",
                        color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)",
                    }}
                >
                    {icon}
                </Box>
                <ListItemContent sx={{ minWidth: 0 }}>
                    <Typography
                        level="body-sm"
                        sx={{
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.8)",
                        }}
                    >
                        {title}
                    </Typography>
                </ListItemContent>
                {!isDisabled && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 20,
                            height: 20,
                            borderRadius: "6px",
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            "&:hover": {
                                backgroundColor: isDark
                                    ? "rgba(255,255,255,0.1)"
                                    : "rgba(0,0,0,0.08)",
                            },
                        }}
                        onClick={handleChevronClick}
                    >
                        <ChevronRightRoundedIcon
                            sx={{
                                fontSize: 16,
                                color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)",
                                transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                                transform: open ? "rotate(90deg)" : "rotate(0deg)",
                            }}
                        />
                    </Box>
                )}
                {isDisabled && (
                    <Typography
                        level="body-xs"
                        sx={{
                            fontSize: 9,
                            fontWeight: 500,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                            backgroundColor: isDark
                                ? "rgba(255,255,255,0.08)"
                                : "rgba(0,0,0,0.05)",
                            px: 0.75,
                            py: 0.25,
                            borderRadius: "4px",
                        }}
                    >
                        {t.notes.sidebar.soonBadge}
                    </Typography>
                )}
            </ListItemButton>

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
                <List
                    sx={{
                        pl: 1,
                        "--List-nestedInsetStart": "20px",
                    }}
                >
                    {children}
                </List>
            </Box>
        </ListItem>
    );
}
