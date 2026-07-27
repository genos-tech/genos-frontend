import { memo } from "react";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { Box, IconButton, ListItem, ListItemButton, ListItemContent, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { ChatNoteMetaProps, MyNoteMetaProps, TaskNoteMetaProps } from "../../../../types/notes";
import { formatTaskDisplayId } from "../../../tasks/utils/taskDisplayId";
import { useNoteUnread } from "../context/NoteUnreadContext";

interface FavoriteNoteItemProps {
    note: MyNoteMetaProps | TaskNoteMetaProps | ChatNoteMetaProps;
    noteType: number;
    useNM: NoteManagementState;
}

function FavoriteNoteItemComponent({ note, noteType, useNM }: FavoriteNoteItemProps) {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();
    const { isUnread, markRead } = useNoteUnread();
    const hasUnread = isUnread(noteType, note.noteId);

    const getChatTypeLabel = (chatType: number): string => {
        switch (chatType) {
            case 1:
                return t.notes.chatTypes.dm;
            case 2:
                return t.notes.chatTypes.gm;
            case 3:
                return t.notes.chatTypes.pm;
            default:
                return t.notes.chatTypes.chat;
        }
    };

    // Check if this specific note is currently selected
    const isSelected =
        useNM.currentNoteType === noteType &&
        note?.noteId ===
            (noteType === 1
                ? useNM.currentMyNote?.noteId
                : noteType === 2
                  ? useNM.currentTaskNote?.noteId
                  : noteType === 3
                    ? useNM.currentChatNote?.noteId
                    : 0);

    const handleClick = () => {
        useNM.setCurrentNoteType(noteType);
        localStorage.setItem("lastOpenNoteType", String(noteType));
        useNM.loadNote(noteType, note.noteId, -1);
        if (hasUnread) markRead(noteType, note.noteId);
    };

    const handleRemoveFavorite = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await useNM.toggleFavorite(note.noteId, noteType);
    };

    // Get additional context based on note type
    const getSubLabel = (): string | null => {
        if (noteType === 2) {
            const taskNote = note as TaskNoteMetaProps;
            // Human-readable task id ("PRJ-123"), not the raw "#123".
            // `formatTaskDisplayId` falls back to "#<taskId>" only when
            // the backend didn't send `displayId` (project without a
            // code / pre-migration row).
            const displayId = formatTaskDisplayId({
                taskId: taskNote.taskId,
                displayId: taskNote.displayId,
            });
            return taskNote.projectName || taskNote.taskTitle
                ? `${taskNote.projectName || ""} ${taskNote.taskTitle ? displayId : ""}`.trim()
                : null;
        }
        if (noteType === 3) {
            const chatNote = note as ChatNoteMetaProps;
            return chatNote.chatTypeName || getChatTypeLabel(chatNote.chatType);
        }
        return null;
    };

    const subLabel = getSubLabel();

    return (
        <ListItem
            sx={{
                position: "relative",
                "--ListItem-paddingY": "0",
                "--ListItem-paddingX": "0",
            }}
        >
            <ListItemButton
                selected={isSelected}
                sx={{
                    borderRadius: "8px",
                    py: 0.5,
                    px: 1,
                    my: 0.125,
                    gap: 0.75,
                    minHeight: 30,
                    transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                        backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                        "& .favorite-remove-btn": {
                            opacity: 1,
                        },
                    },
                    "&.Mui-selected": {
                        backgroundColor: isDark
                            ? "rgba(var(--gp-brand-700-rgb), 0.12)"
                            : "rgba(var(--gp-brand-700-rgb), 0.08)",
                        "&:hover": {
                            backgroundColor: isDark
                                ? "rgba(var(--gp-brand-700-rgb), 0.18)"
                                : "rgba(var(--gp-brand-700-rgb), 0.12)",
                        },
                    },
                }}
                onClick={handleClick}
            >
                {/* Note indicator dot — red when there's an unread @mention. */}
                <Box
                    sx={{
                        width: hasUnread ? 8 : 6,
                        height: hasUnread ? 8 : 6,
                        borderRadius: "50%",
                        flexShrink: 0,
                        backgroundColor: hasUnread
                            ? isDark
                                ? "var(--gp-brandalt-400)"
                                : "var(--gp-brand-700)"
                            : isSelected
                              ? isDark
                                  ? "var(--gp-brandalt-400)"
                                  : "var(--gp-brand-800)"
                              : isDark
                                ? "rgba(255,255,255,0.2)"
                                : "rgba(0,0,0,0.15)",
                        transition: "all 0.2s ease",
                    }}
                />

                <ListItemContent sx={{ minWidth: 0 }}>
                    <Typography
                        level="body-xs"
                        sx={{
                            fontWeight: isSelected ? 500 : 400,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)",
                            fontSize: "0.775rem",
                            letterSpacing: "-0.01em",
                        }}
                    >
                        {note.title || t.notes.defaults.untitled}
                    </Typography>
                    {subLabel && (
                        <Typography
                            level="body-xs"
                            sx={{
                                fontWeight: 400,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                                fontSize: "0.65rem",
                            }}
                        >
                            {subLabel}
                        </Typography>
                    )}
                </ListItemContent>

                {/* Remove from favorites button */}
                <IconButton
                    className="favorite-remove-btn"
                    color="warning"
                    size="sm"
                    variant="plain"
                    sx={{
                        opacity: 0,
                        minWidth: 20,
                        minHeight: 20,
                        borderRadius: "4px",
                        transition: "opacity 0.15s ease",
                        "&:hover": {
                            backgroundColor: isDark
                                ? "rgba(245,158,11,0.15)"
                                : "rgba(245,158,11,0.1)",
                        },
                    }}
                    onClick={handleRemoveFavorite}
                >
                    <StarRoundedIcon sx={{ fontSize: 14, color: "#f59e0b" }} />
                </IconButton>
            </ListItemButton>
        </ListItem>
    );
}

export const FavoriteNoteItem = memo(FavoriteNoteItemComponent);
