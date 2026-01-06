import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { NoteBreadcrumbs } from "../../common/components/NoteBreadcrumbs";

interface TaskNoteHeaderProps {
    useNM: NoteManagementState;
}

export const TaskNoteHeader = ({ useNM }: TaskNoteHeaderProps) => {
    return (
        <NoteBreadcrumbs
            color="success"
            icon={<AssignmentRoundedIcon />}
            label="Task Notes"
            noteChain={useNM.currentTaskNoteChain}
            onNodeClick={(noteId) => useNM.loadNote(2, noteId, -1)}
        />
    );
};
