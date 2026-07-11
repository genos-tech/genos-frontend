import { ReactNode, useMemo } from "react";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import { Stack } from "@mui/joy";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { buildTaskNoteContextCrumbs, TaskNoteCrumbKind } from "../../../../utils/note";
import { ContextCrumb, NoteBreadcrumbs } from "../../common/components/NoteBreadcrumbs";
import { NoteHistoryChip } from "../../common/components/NoteHistoryChip";

// Per-level glyphs for the Project → Milestone → Task container chain.
const TASK_CRUMB_ICON: Record<TaskNoteCrumbKind, ReactNode> = {
    project: <AccountTreeRoundedIcon />,
    milestone: <FlagRoundedIcon />,
    task: <AssignmentRoundedIcon />,
};

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

    // Container ancestry of the open task note, prepended to the note
    // breadcrumb: Project → Milestone (if any) → parent Task (if a
    // subtask) → Task, mirroring the sidebar's nesting. All notes in a
    // task-note chain belong to the same task, so it derives off the
    // chain's root meta node.
    const contextCrumbs = useMemo<ContextCrumb[]>(
        () =>
            buildTaskNoteContextCrumbs(useNM.currentTaskNoteChain?.[0]).map((c) => ({
                key: c.key,
                label: c.label,
                icon: TASK_CRUMB_ICON[c.kind],
            })),
        [useNM.currentTaskNoteChain]
    );

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
