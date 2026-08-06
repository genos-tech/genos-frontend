import { useMemo } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import { Stack, Typography } from "@mui/joy";

import { useIsMobile } from "../../../../hooks/common/useIsMobile";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { buildFolderCrumbChain } from "../../../../utils/note";
import { ContextCrumb, NoteBreadcrumbs } from "../../common/components/NoteBreadcrumbs";

interface MyNoteHeaderProps {
    useNM: NoteManagementState;
}

export const MyNoteHeader = ({ useNM }: MyNoteHeaderProps) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();

    // Sidebar-folder ancestry of the open note, prepended to the note
    // breadcrumb. `folderId` is only meaningful on a chain's ROOT note
    // (children inherit their root's folder), so resolve it from
    // chain[0]. Folder-less and shared notes yield an empty chain (see
    // buildFolderCrumbChain) — no segments render.
    const { currentMyNoteChain, myNoteFolders, currentMyNote } = useNM;
    const folderCrumbs = useMemo<ContextCrumb[]>(
        () =>
            buildFolderCrumbChain(myNoteFolders, currentMyNoteChain?.[0]?.folderId ?? null).map(
                (f) => ({
                    key: `folder-${f.folderId}`,
                    label: f.name,
                    icon: <FolderRoundedIcon />,
                })
            ),
        [currentMyNoteChain, myNoteFolders]
    );

    // Mobile: the breadcrumb trail is hidden (see NoteBreadcrumbs), so
    // this slot is just the current title — it shares the single header
    // row with back + actions.
    if (isMobile) {
        return (
            <Typography level="title-sm" sx={{ flex: 1, minWidth: 0, fontWeight: 700 }} noWrap>
                {currentMyNote?.title || t.notes.header.myNotesLabel}
            </Typography>
        );
    }

    return (
        <Stack alignItems="center" direction="row" spacing={1} sx={{ minWidth: 0, flex: 1 }}>
            <NoteBreadcrumbs
                color="primary"
                contextCrumbs={folderCrumbs}
                icon={<AssignmentRoundedIcon />}
                label={t.notes.header.myNotesLabel}
                noteChain={useNM.currentMyNoteChain}
                onNodeClick={(noteId) => useNM.loadNote(1, noteId, -1)}
            />
            {/* Version history moved to the header's ⋮ (More) menu — see
                NoteHeaderActions. */}
        </Stack>
    );
};
