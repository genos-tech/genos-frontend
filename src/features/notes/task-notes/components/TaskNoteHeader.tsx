import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import { Stack } from "@mui/joy";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { UserProps } from "../../../../types/admin";
import { NoteBreadcrumbs } from "../../common/components/NoteBreadcrumbs";
import { NoteHistoryChip } from "../../common/components/NoteHistoryChip";

interface TaskNoteHeaderProps {
    useNM: NoteManagementState;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    socket: any;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
}

export const TaskNoteHeader = ({
    useNM,
    myself,
    setMyself,
    socket,
    useCM,
    useUISM,
}: TaskNoteHeaderProps) => {
    return (
        <Stack alignItems="center" direction="row" spacing={1} sx={{ minWidth: 0, flex: 1 }}>
            <NoteBreadcrumbs
                color="success"
                icon={<AssignmentRoundedIcon />}
                label="Task Notes"
                noteChain={useNM.currentTaskNoteChain}
                onNodeClick={(noteId) => useNM.loadNote(2, noteId, -1)}
            />
            <NoteHistoryChip
                useNM={useNM}
                noteType={2}
                noteId={useNM.currentTaskNote?.noteId ?? 0}
                myself={myself}
                setMyself={setMyself}
                socket={socket}
                useCM={useCM}
                useUISM={useUISM}
            />
        </Stack>
    );
};
