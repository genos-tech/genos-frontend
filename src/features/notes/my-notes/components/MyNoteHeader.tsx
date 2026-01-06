import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { NoteBreadcrumbs } from "../../common/components/NoteBreadcrumbs";

interface MyNoteHeaderProps {
    useNM: NoteManagementState;
}

export const MyNoteHeader = ({ useNM }: MyNoteHeaderProps) => {
    return (
        <NoteBreadcrumbs
            color="primary"
            icon={<AssignmentRoundedIcon />}
            label="My Notes"
            noteChain={useNM.currentMyNoteChain}
            onNodeClick={(noteId) => useNM.loadNote(1, noteId, -1)}
        />
    );
};
