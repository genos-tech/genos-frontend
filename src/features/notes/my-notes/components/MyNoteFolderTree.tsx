import { memo, ReactNode, useState } from "react";
import CreateNewFolderRoundedIcon from "@mui/icons-material/CreateNewFolderRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DriveFileMoveRoundedIcon from "@mui/icons-material/DriveFileMoveRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import FileUploadRoundedIcon from "@mui/icons-material/FileUploadRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import FolderZipRoundedIcon from "@mui/icons-material/FolderZipRounded";
import NoteAddRoundedIcon from "@mui/icons-material/NoteAddRounded";
import { Box, List, ListItem, Typography } from "@mui/joy";

import { MoreMenu } from "../../../../components/ui/MoreMenu";
import { NavItem } from "../../../../components/ui/nav/NavItem";
import { navNestedListSx } from "../../../../components/ui/nav/navStyles";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { MyNoteFolderTreeNode, MyNoteMetaTreeNode } from "../../../../types/notes";
import {
    FolderFavoriteStar,
    highlightedFolderSx,
} from "../../common/components/FolderFavoriteStar";
import {
    DraggableNoteRow,
    DroppableHeader,
    DroppableNoteList,
    myFolderContainerId,
} from "../../common/dnd/sidebarNoteDnd";
import { folderFavoriteMenuItem } from "../../common/utils/folderFavoriteMenuItem";

// Actions bubbled up to the single modal host in NoteSidebar — one
// modal instance serves every folder row.
export type FolderActionHandlers = {
    onCreateNoteHere: (folderId: number) => void;
    onImportNoteHere: (folderId: number) => void;
    onExportFolder: (folder: MyNoteFolderTreeNode) => void;
    onCreateSubfolder: (folderId: number) => void;
    onRenameFolder: (folder: MyNoteFolderTreeNode) => void;
    onMoveFolder: (folder: MyNoteFolderTreeNode) => void;
    onDeleteFolder: (folder: MyNoteFolderTreeNode) => void;
};

type MyNoteFolderTreeProps = {
    folder: MyNoteFolderTreeNode;
    useNM: NoteManagementState;
    actions: FolderActionHandlers;
    // Renders one filed root note (the sidebar's existing
    // NoteTreeRenderer wrapper), so note rows look identical inside and
    // outside folders.
    renderNote: (node: MyNoteMetaTreeNode) => ReactNode;
    depth?: number;
};

// One user-created folder row + its contents (child folders first,
// then filed notes). Visual language mirrors GroupedNoteSection, but
// expansion is CONTROLLED (useNM.expandedNodeIds under `folder-` keys)
// so deep-link auto-reveal can open folders, and the header carries a
// hover "⋯" menu with the folder actions.
function MyNoteFolderTreeComponent(props: MyNoteFolderTreeProps) {
    const { folder, useNM, actions, renderNote, depth = 0 } = props;
    const { t } = useTranslation();

    const isExpanded = useNM.isFolderExpanded(folder.folderId);
    const isEmpty = folder.childFolders.length === 0 && folder.notes.length === 0;
    const [menuOpen, setMenuOpen] = useState(false);

    const FolderIcon = isExpanded ? FolderOpenRoundedIcon : FolderRoundedIcon;

    const isHighlighted = useNM.highlightedFolderId === folder.folderId;

    // A folder you drag a note over takes the accent tint and a dashed
    // ring; the folder a "jump to folder" landed on flashes the tint.
    // Keep the "..." trigger visible while its portal menu is open.
    const headerRow = (isDraggingOver: boolean) => (
        <NavItem
            actionsVisible={menuOpen}
            as="div"
            data-note-folder-id={folder.folderId}
            expanded={isExpanded}
            icon={<FolderIcon />}
            label={folder.name}
            actions={
                <>
                    <FolderFavoriteStar folderId={folder.folderId} useNM={useNM} />
                    <Box onClick={(e) => e.stopPropagation()}>
                        <MoreMenu
                            iconFontSize={14}
                            placement="bottom-end"
                            triggerSize={20}
                            items={[
                                folderFavoriteMenuItem(folder.folderId, useNM, {
                                    add: t.notes.sidebar.addToFavorites,
                                    remove: t.notes.sidebar.removeFromFavorites,
                                }),
                                {
                                    id: "new-note-here",
                                    kind: "newNote",
                                    label: t.notes.folders.newNoteHere,
                                    icon: <NoteAddRoundedIcon sx={{ fontSize: 16 }} />,
                                    onClick: () => actions.onCreateNoteHere(folder.folderId),
                                },
                                {
                                    id: "import-note-here",
                                    kind: "import",
                                    label: t.notes.header.importMarkdown,
                                    icon: <FileUploadRoundedIcon sx={{ fontSize: 16 }} />,
                                    onClick: () => actions.onImportNoteHere(folder.folderId),
                                },
                                {
                                    id: "export-folder",
                                    kind: "export",
                                    label: t.notes.exportZip.menuItem,
                                    icon: <FolderZipRoundedIcon sx={{ fontSize: 16 }} />,
                                    onClick: () => actions.onExportFolder(folder),
                                },
                                {
                                    id: "new-subfolder",
                                    kind: "newSubfolder",
                                    label: t.notes.folders.newSubfolder,
                                    icon: <CreateNewFolderRoundedIcon sx={{ fontSize: 16 }} />,
                                    onClick: () => actions.onCreateSubfolder(folder.folderId),
                                },
                                {
                                    id: "rename",
                                    kind: "rename",
                                    label: t.notes.folders.rename,
                                    icon: (
                                        <DriveFileRenameOutlineRoundedIcon sx={{ fontSize: 16 }} />
                                    ),
                                    onClick: () => actions.onRenameFolder(folder),
                                },
                                {
                                    id: "move",
                                    kind: "move",
                                    label: t.notes.folders.moveFolder,
                                    icon: <DriveFileMoveRoundedIcon sx={{ fontSize: 16 }} />,
                                    onClick: () => actions.onMoveFolder(folder),
                                },
                                {
                                    id: "delete",
                                    kind: "delete",
                                    label: t.notes.folders.deleteFolder,
                                    icon: <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />,
                                    danger: true,
                                    onClick: () => actions.onDeleteFolder(folder),
                                },
                            ]}
                            onOpenChange={setMenuOpen}
                        />
                    </Box>
                </>
            }
            sx={
                isDraggingOver
                    ? { background: g.accent.subtle, outline: `1px dashed ${g.accent.border}` }
                    : isHighlighted
                      ? highlightedFolderSx
                      : undefined
            }
            onClick={() => useNM.toggleFolderExpanded(folder.folderId)}
        />
    );

    return (
        <Box>
            <ListItem sx={{ p: 0 }} nested>
                {/* Folder header — always a drop target so notes can be
                    filed into a COLLAPSED folder too. */}
                <DroppableHeader containerId={myFolderContainerId(folder.folderId)} kind={1}>
                    {(isDraggingOver) => headerRow(isDraggingOver)}
                </DroppableHeader>

                {/* Contents: rendered only when expanded (collapsed
                    subtrees pay zero render cost — same trade-off as
                    NoteTreeRenderer). */}
                {isExpanded && (
                    <List sx={navNestedListSx}>
                        {folder.childFolders.map((child) => (
                            <MyNoteFolderTree
                                key={`folder-${child.folderId}`}
                                actions={actions}
                                depth={depth + 1}
                                folder={child}
                                renderNote={renderNote}
                                useNM={useNM}
                            />
                        ))}
                        <DroppableNoteList
                            containerId={myFolderContainerId(folder.folderId)}
                            kind={1}
                        >
                            {folder.notes.map((note, index) => (
                                <DraggableNoteRow
                                    key={`filed-note-${note.noteId}`}
                                    index={index}
                                    kind={1}
                                    noteId={note.noteId}
                                >
                                    {renderNote(note)}
                                </DraggableNoteRow>
                            ))}
                        </DroppableNoteList>
                        {isEmpty && (
                            <Typography
                                level="body-xs"
                                sx={{
                                    px: 1.5,
                                    py: 0.5,
                                    fontStyle: "italic",
                                    color: g.text.tertiary,
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

export const MyNoteFolderTree = memo(MyNoteFolderTreeComponent);
