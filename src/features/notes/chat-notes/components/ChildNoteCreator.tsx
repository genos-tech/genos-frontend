import { memo } from "react";
import AddIcon from "@mui/icons-material/Add";
import { Box, List, ListItem, ListItemButton, ListItemContent, Typography } from "@mui/joy";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";

interface ChildNoteCreatorProps {
    node: any;
    timestamp: string;
    NM: NoteManagementState;
}

export const ChildNoteCreator = memo(function ChildNoteCreator({
    node,
    timestamp,
    NM,
}: ChildNoteCreatorProps) {
    const handleCreateChildNote = () => {
        if (node.noteType === 1) {
            NM.handleCreateNewMyNote(node.noteId);
        } else if (node.noteType === 2) {
            NM.handleCreateNewTaskNote(node.noteId, node.projectId, node.taskId);
        } else if (node.noteType === 3) {
            NM.handleCreateNewChatNote(
                node.noteId,
                node.chatType,
                node.chatId,
                node.isThread,
                node.threadId
            );
        }
    };

    return (
        <List>
            <Box key={`note-box-${node.noteId}-${timestamp}`}>
                <ListItem key={`note-${node.noteId}-${timestamp}`} nested>
                    <ListItemButton
                        sx={{ my: "1px" }}
                        variant="plain"
                        onClick={handleCreateChildNote}
                    >
                        <ListItemContent>
                            <Typography level="title-sm" startDecorator={<AddIcon />}>
                                Child Note
                            </Typography>
                        </ListItemContent>
                    </ListItemButton>
                </ListItem>
            </Box>
        </List>
    );
});
