import { memo } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import WindowRoundedIcon from "@mui/icons-material/WindowRounded";
import { Box, ListItem, ListItemButton, ListItemContent, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { ChatNoteMetaProps, MyNoteMetaProps, TaskNoteMetaProps } from "../../../../types/notes";

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
        default:
            return isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
    }
}

function getChatTypeLabel(chatType: number): string {
    switch (chatType) {
        case 1:
            return "DM";
        case 2:
            return "GM";
        case 3:
            return "PM";
        default:
            return "Chat";
    }
}

function RecentNoteItemComponent({ note, noteType, useNM }: RecentNoteItemProps) {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

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
        // loadNote internally calls recordNoteOpen on success, which in
        // turn promotes this row to the top of the recents list — so we
        // don't need to call recordNoteOpen ourselves here.
        useNM.loadNote(noteType, note.noteId, -1);
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
                onClick={handleClick}
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
                    },
                    "&.Mui-selected": {
                        backgroundColor: isDark ? "rgba(124,58,237,0.12)" : "rgba(124,58,237,0.08)",
                        "&:hover": {
                            backgroundColor: isDark
                                ? "rgba(124,58,237,0.18)"
                                : "rgba(124,58,237,0.12)",
                        },
                    },
                }}
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
                        {note.title || "Untitled"}
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
            </ListItemButton>
        </ListItem>
    );
}

export const RecentNoteItem = memo(RecentNoteItemComponent);
