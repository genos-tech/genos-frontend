import { memo } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { Box, ListItem, ListItemButton, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";

interface ChildNoteCreatorProps {
    node: any;
    timestamp: string;
    useNM: NoteManagementState;
}

export const ChildNoteCreator = memo(function ChildNoteCreator({
    node,
    timestamp,
    useNM,
}: ChildNoteCreatorProps) {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

    const handleCreateChildNote = () => {
        if (node.noteType === 1) {
            useNM.handleCreateNewMyNote(node.noteId);
        } else if (node.noteType === 2) {
            useNM.handleCreateNewTaskNote(node.noteId, node.projectId, node.taskId);
        } else if (node.noteType === 3) {
            useNM.handleCreateNewChatNote(
                node.noteId,
                node.chatType,
                node.chatId,
                node.isThread,
                node.threadId
            );
        }
    };

    return (
        <Box key={`child-creator-${node.noteId}-${timestamp}`} sx={{ py: 0.25 }}>
            <ListItem nested sx={{ py: 0 }}>
                <ListItemButton
                    onClick={handleCreateChildNote}
                    sx={{
                        borderRadius: "8px",
                        py: 0.375,
                        px: 0.875,
                        gap: 0.75,
                        minHeight: 28,
                        border: isDark
                            ? "1px dashed rgba(255,255,255,0.12)"
                            : "1px dashed rgba(0,0,0,0.1)",
                        backgroundColor: "transparent",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        "&:hover": {
                            backgroundColor: isDark
                                ? "rgba(124,58,237,0.08)"
                                : "rgba(124,58,237,0.06)",
                            borderColor: isDark ? "rgba(124,58,237,0.3)" : "rgba(124,58,237,0.25)",
                            "& .add-icon": {
                                color: isDark ? "#a78bfa" : "#7c3aed",
                                transform: "rotate(90deg)",
                            },
                            "& .add-text": {
                                color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)",
                            },
                        },
                    }}
                >
                    <Box
                        className="add-icon"
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 16,
                            height: 16,
                            borderRadius: "4px",
                            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                            color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)",
                        }}
                    >
                        <AddRoundedIcon sx={{ fontSize: 14 }} />
                    </Box>
                    <Typography
                        className="add-text"
                        level="body-xs"
                        sx={{
                            fontWeight: 400,
                            fontSize: "0.7rem",
                            letterSpacing: "0.01em",
                            color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)",
                            transition: "color 0.2s ease",
                        }}
                    >
                        {t.notes.sidebar.addSubNote}
                    </Typography>
                </ListItemButton>
            </ListItem>
        </Box>
    );
});
