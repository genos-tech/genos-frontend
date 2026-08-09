import { useMemo } from "react";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import { Chip, IconButton, Stack, Typography } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useIsMobile } from "../../../../hooks/common/useIsMobile";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { buildFolderCrumbChain } from "../../../../utils/note";
import { ContextCrumb, NoteBreadcrumbs } from "../../common/components/NoteBreadcrumbs";

interface TeamNoteHeaderProps {
    useNM: NoteManagementState;
}

// Header for a note open from the Team Notes space.
//
// Mirrors MyNoteHeader, but resolves its folder ancestry from
// `teamNoteFolders` rather than `myNoteFolders`. That difference is the
// whole reason this component exists: MyNoteHeader was rendering for
// team notes and looking up a team folder id in the PERSONAL folder
// list, which never contains it — so the breadcrumb collapsed to a bare
// "My Notes" label with no path, which read as a broken/missing header.
//
// It also shows the folder's effective visibility, because in a shared
// space "who else can see this" is part of knowing where you are.
export const TeamNoteHeader = ({ useNM }: TeamNoteHeaderProps) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const { teamNoteFolders, teamNoteMeta, currentMyNote } = useNM;

    // Team notes ride `currentMyNote` (they're personal notes), so the
    // folder comes from the meta row rather than a chain.
    const folderId = useMemo(() => {
        const noteId = currentMyNote?.noteId;
        if (noteId == null) return null;
        return teamNoteMeta.find((n) => n.noteId === noteId)?.folderId ?? null;
    }, [currentMyNote?.noteId, teamNoteMeta]);

    const folderCrumbs = useMemo<ContextCrumb[]>(
        () =>
            buildFolderCrumbChain(teamNoteFolders, folderId).map((f) => ({
                key: `team-folder-${f.folderId}`,
                label: f.name,
                icon: <FolderRoundedIcon />,
            })),
        [teamNoteFolders, folderId]
    );

    const folder = folderId != null ? teamNoteFolders.find((f) => f.folderId === folderId) : null;
    const visibility = folder?.effectiveVisibility ?? null;
    const visibilityLabel =
        visibility === "public"
            ? t.notes.teamNotes.visibilityPublic
            : t.notes.teamNotes.visibilityPrivate;

    // Mobile: title + icon-only visibility (full "Only people I invite"
    // chip forced a second header row). Shares one row with back +
    // actions.
    if (isMobile) {
        return (
            <Stack alignItems="center" direction="row" spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                <Typography level="title-sm" sx={{ flex: 1, minWidth: 0, fontWeight: 700 }} noWrap>
                    {currentMyNote?.title || t.notes.labels.teamNotes}
                </Typography>
                {visibility && (
                    <AppTooltip size="sm" title={visibilityLabel}>
                        <IconButton
                            aria-label={visibilityLabel}
                            size="sm"
                            sx={{ flexShrink: 0 }}
                            variant="plain"
                        >
                            {visibility === "public" ? (
                                <PublicRoundedIcon sx={{ fontSize: 18 }} />
                            ) : (
                                <LockRoundedIcon sx={{ fontSize: 18 }} />
                            )}
                        </IconButton>
                    </AppTooltip>
                )}
            </Stack>
        );
    }

    return (
        <Stack alignItems="center" direction="row" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            <NoteBreadcrumbs
                color="primary"
                contextCrumbs={folderCrumbs}
                icon={<GroupsRoundedIcon />}
                label={t.notes.labels.teamNotes}
                noteChain={currentMyNote ? [currentMyNote] : []}
                onNodeClick={(noteId) => useNM.loadNote(8, noteId, -1)}
            />
            {visibility && (
                <Chip
                    color={visibility === "public" ? "success" : "neutral"}
                    size="sm"
                    sx={{ flexShrink: 0, fontSize: 10 }}
                    variant="soft"
                    startDecorator={
                        visibility === "public" ? (
                            <PublicRoundedIcon sx={{ fontSize: 12 }} />
                        ) : (
                            <LockRoundedIcon sx={{ fontSize: 12 }} />
                        )
                    }
                >
                    {visibilityLabel}
                </Chip>
            )}
        </Stack>
    );
};
