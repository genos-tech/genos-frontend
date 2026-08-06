import { memo } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import WindowRoundedIcon from "@mui/icons-material/WindowRounded";
import { Box, ListItem, ListItemButton, ListItemContent, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { ChatNoteMetaProps, MyNoteMetaProps, TaskNoteMetaProps } from "../../../../types/notes";
import { useNoteUnread } from "../context/NoteUnreadContext";
import { isPersonalNoteBucket } from "../utils/noteTypeAlias";

interface RecentNoteItemProps {
    note: MyNoteMetaProps | TaskNoteMetaProps | ChatNoteMetaProps;
    noteType: number;
    useNM: NoteManagementState;
}

function getTypeIcon(noteType: number) {
    switch (noteType) {
        case 1:
            return <WindowRoundedIcon sx={{ fontSize: 14 }} />;
        case 2:
            return <AssignmentRoundedIcon sx={{ fontSize: 14 }} />;
        case 3:
            return <QuestionAnswerRoundedIcon sx={{ fontSize: 14 }} />;
        // Sidebar buckets over note_type 1 — they need their own glyphs
        // or every shared / team note reads as a My note.
        case 4:
            return <ShareRoundedIcon sx={{ fontSize: 14 }} />;
        case 8:
            return <GroupsRoundedIcon sx={{ fontSize: 14 }} />;
        default:
            return null;
    }
}

function getTypeColor(noteType: number, isDark: boolean) {
    switch (noteType) {
        case 1:
            return isDark ? "#818cf8" : "#6366f1";
        case 2:
            return isDark ? "#4ade80" : "#22c55e";
        case 3:
            return isDark ? "#fb923c" : "#f97316";
        case 4:
            return isDark ? "#38bdf8" : "#0ea5e9";
        case 8:
            return isDark ? "#c084fc" : "#a855f7";
        default:
            return isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
    }
}

function RecentNoteItemComponent({ note, noteType, useNM }: RecentNoteItemProps) {
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

    const isSelected =
        useNM.currentNoteType === noteType &&
        note?.noteId ===
            (noteType === 2
                ? useNM.currentTaskNote?.noteId
                : noteType === 3
                  ? useNM.currentChatNote?.noteId
                  : // 1, 4 and 8 all ride the currentMyNote slot.
                    isPersonalNoteBucket(noteType)
                    ? useNM.currentMyNote?.noteId
                    : 0);

    const handleClick = () => {
        useNM.setCurrentNoteType(noteType);
        localStorage.setItem("lastOpenNoteType", String(noteType));
        // loadNote internally calls recordNoteOpen on success, which in
        // turn promotes this row to the top of the recents list — so we
        // don't need to call recordNoteOpen ourselves here.
        useNM.loadNote(noteType, note.noteId, -1);
        if (hasUnread) markRead(noteType, note.noteId);
    };

    // Per-type sub-label so the user can distinguish identically-titled
    // notes across different tasks / chats. Personal notes have no
    // additional context.
    const getSubLabel = (): string | null => {
        if (noteType === 2) {
            const taskNote = note as TaskNoteMetaProps;
            return taskNote.projectName || taskNote.taskTitle
                ? `${taskNote.projectName || ""} ${taskNote.taskTitle ? `#${taskNote.taskId}` : ""}`.trim()
                : null;
        }
        if (noteType === 3) {
            const chatNote = note as ChatNoteMetaProps;
            return chatNote.chatTypeName || getChatTypeLabel(chatNote.chatType);
        }
        return null;
    };

    const subLabel = getSubLabel();
    const typeColor = getTypeColor(noteType, isDark);

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
                    // Hover-only on real pointers — sticky :hover on touch
                    // can eat the first tap before the note opens.
                    "@media (hover: hover) and (pointer: fine)": {
                        "&:hover": {
                            backgroundColor: isDark
                                ? "rgba(255,255,255,0.05)"
                                : "rgba(0,0,0,0.03)",
                        },
                    },
                    "&.Mui-selected": {
                        backgroundColor: isDark
                            ? "rgba(var(--gp-brand-700-rgb), 0.12)"
                            : "rgba(var(--gp-brand-700-rgb), 0.08)",
                        "@media (hover: hover) and (pointer: fine)": {
                            "&:hover": {
                                backgroundColor: isDark
                                    ? "rgba(var(--gp-brand-700-rgb), 0.18)"
                                    : "rgba(var(--gp-brand-700-rgb), 0.12)",
                            },
                        },
                    },
                }}
                onClick={handleClick}
            >
                {/* Type icon */}
                <Box
                    sx={{
                        width: 18,
                        height: 18,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: typeColor,
                    }}
                >
                    {getTypeIcon(noteType)}
                </Box>

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
                {hasUnread && (
                    <Box
                        sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            flexShrink: 0,
                            backgroundColor: isDark
                                ? "var(--gp-brandalt-400)"
                                : "var(--gp-brand-700)",
                        }}
                    />
                )}
            </ListItemButton>
        </ListItem>
    );
}

export const RecentNoteItem = memo(RecentNoteItemComponent);
