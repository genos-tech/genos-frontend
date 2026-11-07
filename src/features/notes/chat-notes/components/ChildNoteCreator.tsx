import { memo } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { ListItem } from "@mui/joy";

import { NavItem } from "../../../../components/ui/nav/NavItem";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";

interface ChildNoteCreatorProps {
    node: any;
    // Not read here: it is part of the props so `memo` re-renders the button
    // when the sidebar tree changes. It used to be baked into the root `key`,
    // which remounted the button on every bump; keep it out of keys.
    timestamp: string;
    useNM: NoteManagementState;
}

export const ChildNoteCreator = memo(function ChildNoteCreator({
    node,
    useNM,
}: ChildNoteCreatorProps) {
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
        <ListItem sx={{ p: 0 }} nested>
            <NavItem
                as="div"
                icon={<AddRoundedIcon />}
                label={t.notes.sidebar.addSubNote}
                variant="dashed"
                onClick={handleCreateChildNote}
            />
        </ListItem>
    );
});
