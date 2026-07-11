import { useMemo } from "react";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import { Stack } from "@mui/joy";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { ContextCrumb, NoteBreadcrumbs } from "../../common/components/NoteBreadcrumbs";
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
    const { t } = useTranslation();

    // Container ancestry of the open task note: Project → Task, prepended
    // to the note breadcrumb. All notes in a task-note chain belong to the
    // same task, so the names come off the chain's root meta node (falls
    // back to ids on an older API that omits projectName/taskTitle).
    const contextCrumbs = useMemo<ContextCrumb[]>(() => {
        const root = useNM.currentTaskNoteChain?.[0];
        if (!root) return [];
        return [
            {
                key: `proj-${root.projectId}`,
                label: root.projectName || `#${root.projectId}`,
                icon: <AccountTreeRoundedIcon />,
            },
            {
                key: `task-${root.taskId}`,
                label: root.taskTitle || root.displayId || `#${root.taskId}`,
                icon: <AssignmentRoundedIcon />,
            },
        ];
    }, [useNM.currentTaskNoteChain]);

    return (
        <Stack alignItems="center" direction="row" spacing={1} sx={{ minWidth: 0, flex: 1 }}>
            <NoteBreadcrumbs
                color="success"
                contextCrumbs={contextCrumbs}
                icon={<AssignmentRoundedIcon />}
                label={t.notes.header.taskNotesLabel}
                noteChain={useNM.currentTaskNoteChain}
                onNodeClick={(noteId) => useNM.loadNote(2, noteId, -1)}
            />
            <NoteHistoryChip
                myself={myself}
                noteId={useNM.currentTaskNote?.noteId ?? 0}
                noteType={2}
                setMyself={setMyself}
                socket={socket}
                useCM={useCM}
                useNM={useNM}
                useUISM={useUISM}
            />
        </Stack>
    );
};
