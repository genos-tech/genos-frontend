import { ReactNode, useMemo } from "react";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import { Stack } from "@mui/joy";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { buildTaskNoteContextCrumbs, TaskNoteCrumbKind } from "../../../../utils/note";
import { ContextCrumb, NoteBreadcrumbs } from "../../common/components/NoteBreadcrumbs";

// Per-level glyphs for the Project → Milestone → Task container chain.
const TASK_CRUMB_ICON: Record<TaskNoteCrumbKind, ReactNode> = {
    project: <AccountTreeRoundedIcon />,
    milestone: <FlagRoundedIcon />,
    task: <AssignmentRoundedIcon />,
};

interface TaskNoteHeaderProps {
    useNM: NoteManagementState;
}

export const TaskNoteHeader = ({ useNM }: TaskNoteHeaderProps) => {
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
            {/* Version history moved to the header's ⋮ (More) menu — see
                NoteHeaderActions. */}
        </Stack>
    );
};
