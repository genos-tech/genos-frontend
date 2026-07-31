import { memo, ReactNode, useState } from "react";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CreateNewFolderRoundedIcon from "@mui/icons-material/CreateNewFolderRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DriveFileMoveRoundedIcon from "@mui/icons-material/DriveFileMoveRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import FileUploadRoundedIcon from "@mui/icons-material/FileUploadRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import NoteAddRoundedIcon from "@mui/icons-material/NoteAddRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import { Box, Chip, List, ListItem, ListItemButton, ListItemContent, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { MoreMenu, MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { MyNoteMetaTreeNode, TeamNoteFolderTreeNode } from "../../../../types/notes";
import { NOTE_ROLE_VIEWER } from "../../common/utils/noteRoles";

// Actions bubbled up to the single modal host in NoteSidebar — one
// modal instance serves every folder row, same as My Notes.
export type TeamFolderActionHandlers = {
    onCreateNoteHere: (folderId: number) => void;
    onImportNoteHere: (folderId: number) => void;
    onCreateSubfolder: (folder: TeamNoteFolderTreeNode) => void;
    onRenameFolder: (folder: TeamNoteFolderTreeNode) => void;
    onMoveFolder: (folder: TeamNoteFolderTreeNode) => void;
    onManageMembers: (folder: TeamNoteFolderTreeNode) => void;
    onEditTags: (folder: TeamNoteFolderTreeNode) => void;
    onDeleteFolder: (folder: TeamNoteFolderTreeNode) => void;
};

type TeamNoteFolderTreeProps = {
    folder: TeamNoteFolderTreeNode;
    useNM: NoteManagementState;
    actions: TeamFolderActionHandlers;
    renderNote: (node: MyNoteMetaTreeNode) => ReactNode;
    // Tag filter result, or null when no filter is active. Ancestors of
    // a match are included by the caller so a matching subfolder stays
    // reachable through its (unmatched) parent.
    visibleFolderIds?: Set<number> | null;
    depth?: number;
};

// One team folder row + its contents. Mirrors MyNoteFolderTree's visual
// language, with two differences that matter:
//
//  * A visibility glyph, because "who can see this" is the whole point
//    of the space and must be readable at a glance. A folder that
//    INHERITS shows its resolved (effective) visibility in muted form,
//    so an inheriting subfolder doesn't look like it has no protection.
//  * The "⋯" menu is ROLE-GATED. Viewers get no write actions, and only
//    the owner sees Delete — the server enforces all of this too, but a
//    menu full of actions that 403 is a bad experience.
//
// There is no DnD here: dragging a note between team folders would move
// content across ACL boundaries, so moves go through the explicit
// "Move to folder" dialog where the destination is a deliberate choice.
function TeamNoteFolderTreeComponent(props: TeamNoteFolderTreeProps) {
    const { folder, useNM, actions, renderNote, visibleFolderIds = null, depth = 0 } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

    const isExpanded = useNM.isFolderExpanded(folder.folderId);
    const isEmpty = folder.childFolders.length === 0 && folder.notes.length === 0;
    const [menuOpen, setMenuOpen] = useState(false);

    const FolderIcon = isExpanded ? FolderOpenRoundedIcon : FolderRoundedIcon;
    const canWrite = folder.myRoleId < NOTE_ROLE_VIEWER;
    const isOwner = folder.myRoleId === 1;
    // Null visibility = inherits, so fall back to what it resolves to.
    const shownVisibility = folder.visibility ?? folder.effectiveVisibility;
    const inherits = folder.visibility === null;

    const menuItems: MoreMenuItem[] = [];
    if (canWrite) {
        menuItems.push(
            {
                id: "new-note-here",
                label: t.notes.folders.newNoteHere,
                icon: <NoteAddRoundedIcon sx={{ fontSize: 16 }} />,
                onClick: () => actions.onCreateNoteHere(folder.folderId),
            },
            {
                id: "import-note-here",
                label: t.notes.header.importMarkdown,
                icon: <FileUploadRoundedIcon sx={{ fontSize: 16 }} />,
                onClick: () => actions.onImportNoteHere(folder.folderId),
            },
            {
                id: "new-subfolder",
                label: t.notes.folders.newSubfolder,
                icon: <CreateNewFolderRoundedIcon sx={{ fontSize: 16 }} />,
                onClick: () => actions.onCreateSubfolder(folder),
            },
            {
                id: "members",
                label: t.notes.teamNotes.manageAccess,
                icon: <GroupRoundedIcon sx={{ fontSize: 16 }} />,
                onClick: () => actions.onManageMembers(folder),
            },
            {
                id: "tags",
                label: t.notes.teamNotes.editTags,
                icon: <LocalOfferRoundedIcon sx={{ fontSize: 16 }} />,
                onClick: () => actions.onEditTags(folder),
            },
            {
                id: "rename",
                label: t.notes.folders.rename,
                icon: <DriveFileRenameOutlineRoundedIcon sx={{ fontSize: 16 }} />,
                onClick: () => actions.onRenameFolder(folder),
            },
            {
                id: "move",
                label: t.notes.folders.moveFolder,
                icon: <DriveFileMoveRoundedIcon sx={{ fontSize: 16 }} />,
                onClick: () => actions.onMoveFolder(folder),
            }
        );
    } else {
        // A viewer can still see who else has access.
        menuItems.push({
            id: "members",
            label: t.notes.teamNotes.viewAccess,
            icon: <GroupRoundedIcon sx={{ fontSize: 16 }} />,
            onClick: () => actions.onManageMembers(folder),
        });
    }
    if (isOwner) {
        menuItems.push({
            id: "delete",
            label: t.notes.folders.deleteFolder,
            icon: <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />,
            danger: true,
            onClick: () => actions.onDeleteFolder(folder),
        });
    }

    return (
        <Box>
            <ListItem nested>
                <ListItemButton
                    sx={{
                        borderRadius: "8px",
                        py: 0.5,
                        px: 1,
                        my: 0.25,
                        gap: 0.75,
                        minHeight: 32,
                        transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                        backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
                        "&:hover": {
                            backgroundColor: isDark
                                ? "rgba(255,255,255,0.06)"
                                : "rgba(0,0,0,0.04)",
                            "& .folder-menu-btn": { opacity: 1 },
                        },
                    }}
                    onClick={() => useNM.toggleFolderExpanded(folder.folderId)}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 16,
                            height: 16,
                            borderRadius: "4px",
                            flexShrink: 0,
                        }}
                    >
                        <ChevronRightRoundedIcon
                            sx={{
                                fontSize: 13,
                                color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.35)",
                                transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                            }}
                        />
                    </Box>

                    <FolderIcon
                        sx={{
                            fontSize: 14,
                            color: isDark ? "var(--gp-brandalt-400)" : "var(--gp-brand-700)",
                            flexShrink: 0,
                        }}
                    />

                    <ListItemContent sx={{ minWidth: 0 }}>
                        <Typography
                            level="body-xs"
                            sx={{
                                fontWeight: 600,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)",
                                fontSize: "0.75rem",
                                letterSpacing: "-0.01em",
                            }}
                        >
                            {folder.name}
                        </Typography>
                    </ListItemContent>

                    {/* Tags, capped at two on the row. The sidebar is
                        narrow and the folder NAME has to stay readable;
                        the rest are reachable from the tag filter and the
                        tag dialog. */}
                    {folder.tags.slice(0, 2).map((tag) => (
                        <Chip
                            key={tag.tagId}
                            size="sm"
                            variant="soft"
                            sx={{
                                "--Chip-minHeight": "16px",
                                flexShrink: 0,
                                fontSize: 10,
                                maxWidth: 72,
                                ...(tag.color ? { backgroundColor: tag.color } : {}),
                            }}
                        >
                            {tag.name}
                        </Chip>
                    ))}
                    {folder.tags.length > 2 && (
                        <Typography
                            level="body-xs"
                            sx={{
                                color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)",
                                flexShrink: 0,
                                fontSize: 10,
                            }}
                        >
                            +{folder.tags.length - 2}
                        </Typography>
                    )}

                    {/* Visibility at a glance. Muted when inherited, so
                        "private because its parent is" reads differently
                        from "private in its own right". */}
                    {shownVisibility === "private" ? (
                        <LockRoundedIcon
                            titleAccess={
                                inherits
                                    ? t.notes.teamNotes.privateInherited
                                    : t.notes.teamNotes.private
                            }
                            sx={{
                                fontSize: 12,
                                flexShrink: 0,
                                opacity: inherits ? 0.4 : 0.75,
                                color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.55)",
                            }}
                        />
                    ) : shownVisibility === "public" ? (
                        <PublicRoundedIcon
                            titleAccess={
                                inherits
                                    ? t.notes.teamNotes.publicInherited
                                    : t.notes.teamNotes.public
                            }
                            sx={{
                                fontSize: 12,
                                flexShrink: 0,
                                opacity: inherits ? 0.4 : 0.75,
                                color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.55)",
                            }}
                        />
                    ) : null}

                    <Box
                        className="folder-menu-btn"
                        sx={{ opacity: menuOpen ? 1 : 0, transition: "opacity 0.15s ease" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <MoreMenu
                            iconFontSize={14}
                            items={menuItems}
                            placement="bottom-end"
                            triggerSize={20}
                            onOpenChange={setMenuOpen}
                        />
                    </Box>
                </ListItemButton>

                {isExpanded && (
                    <List sx={{ pl: 1.5, "--List-nestedInsetStart": "16px" }}>
                        {folder.childFolders
                            .filter((c) => !visibleFolderIds || visibleFolderIds.has(c.folderId))
                            .map((child) => (
                                <TeamNoteFolderTree
                                    key={`team-folder-${child.folderId}`}
                                    actions={actions}
                                    depth={depth + 1}
                                    folder={child}
                                    renderNote={renderNote}
                                    useNM={useNM}
                                    visibleFolderIds={visibleFolderIds}
                                />
                            ))}
                        {folder.notes.map((note) => renderNote(note))}
                        {isEmpty && (
                            <Typography
                                level="body-xs"
                                sx={{
                                    px: 1.5,
                                    py: 0.5,
                                    fontStyle: "italic",
                                    color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                                }}
                            >
                                {t.notes.folders.emptyFolder}
                            </Typography>
                        )}
                    </List>
                )}
            </ListItem>
        </Box>
    );
}

export const TeamNoteFolderTree = memo(TeamNoteFolderTreeComponent);
