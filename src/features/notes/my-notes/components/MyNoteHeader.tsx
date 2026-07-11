import { useMemo } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import { Stack } from "@mui/joy";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { buildFolderCrumbChain } from "../../../../utils/note";
import { NoteBreadcrumbs } from "../../common/components/NoteBreadcrumbs";
import { NoteHistoryChip } from "../../common/components/NoteHistoryChip";

interface MyNoteHeaderProps {
    useNM: NoteManagementState;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    socket: any;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
}

export const MyNoteHeader = ({
    useNM,
    myself,
    setMyself,
    socket,
    useCM,
    useUISM,
}: MyNoteHeaderProps) => {
    const { t } = useTranslation();

    // Sidebar-folder ancestry of the open note, prepended to the note
    // breadcrumb. `folderId` is only meaningful on a chain's ROOT note
    // (children inherit their root's folder), so resolve it from
    // chain[0]. Folder-less and shared notes yield an empty chain (see
    // buildFolderCrumbChain) — no segments render.
    const { currentMyNoteChain, myNoteFolders } = useNM;
    const folderChain = useMemo(
        () => buildFolderCrumbChain(myNoteFolders, currentMyNoteChain?.[0]?.folderId ?? null),
        [currentMyNoteChain, myNoteFolders]
    );

    return (
        <Stack alignItems="center" direction="row" spacing={1} sx={{ minWidth: 0, flex: 1 }}>
            <NoteBreadcrumbs
                color="primary"
                folderChain={folderChain}
                icon={<AssignmentRoundedIcon />}
                label={t.notes.header.myNotesLabel}
                noteChain={useNM.currentMyNoteChain}
                onNodeClick={(noteId) => useNM.loadNote(1, noteId, -1)}
            />
            <NoteHistoryChip
                myself={myself}
                noteId={useNM.currentMyNote?.noteId ?? 0}
                noteType={1}
                setMyself={setMyself}
                socket={socket}
                useCM={useCM}
                useNM={useNM}
                useUISM={useUISM}
            />
        </Stack>
    );
};
