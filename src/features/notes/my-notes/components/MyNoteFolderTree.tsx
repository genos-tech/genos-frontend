import { memo, ReactNode, useState } from "react";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CreateNewFolderRoundedIcon from "@mui/icons-material/CreateNewFolderRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DriveFileMoveRoundedIcon from "@mui/icons-material/DriveFileMoveRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import FileUploadRoundedIcon from "@mui/icons-material/FileUploadRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import FolderZipRoundedIcon from "@mui/icons-material/FolderZipRounded";
import NoteAddRoundedIcon from "@mui/icons-material/NoteAddRounded";
import { Box, List, ListItem, ListItemButton, ListItemContent, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { MoreMenu } from "../../../../components/ui/MoreMenu";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { MyNoteFolderTreeNode, MyNoteMetaTreeNode } from "../../../../types/notes";
import {
    DraggableNoteRow,
    DroppableHeader,
    DroppableNoteList,
    myFolderContainerId,
} from "../../common/dnd/sidebarNoteDnd";

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
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

    const isExpanded = useNM.isFolderExpanded(folder.folderId);
    const isEmpty = folder.childFolders.length === 0 && folder.notes.length === 0;
    const [menuOpen, setMenuOpen] = useState(false);

    const FolderIcon = isExpanded ? FolderOpenRoundedIcon : FolderRoundedIcon;

    const headerRow = (isDraggingOver: boolean) => (
        <ListItemButton
            sx={{
                borderRadius: "8px",
                py: 0.5,
                px: 1,
                my: 0.25,
                gap: 0.75,
                minHeight: 32,
                transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                backgroundColor: isDraggingOver
                    ? isDark
                        ? "rgba(var(--gp-brand-700-rgb), 0.18)"
                        : "rgba(var(--gp-brand-700-rgb), 0.1)"
                    : isDark
                      ? "rgba(255,255,255,0.02)"
                      : "rgba(0,0,0,0.01)",
                outline: isDraggingOver ? "1px dashed" : "none",
                outlineColor: isDark
                    ? "rgba(var(--gp-brandalt-400-rgb), 0.7)"
                    : "rgba(var(--gp-brand-700-rgb), 0.5)",
                // Hover-only on real pointers — sticky :hover on touch
                // eats the first tap (folder won't expand until tap #2).
                "@media (hover: hover) and (pointer: fine)": {
                    "&:hover": {
                        backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                        "& .folder-menu-btn": {
                            opacity: 1,
                        },
                    },
                },
            }}
            onClick={() => useNM.toggleFolderExpanded(folder.folderId)}
        >
            {/* Chevron */}
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

            {/* Hover-revealed folder actions; always visible on touch. */}
            <Box
                className="folder-menu-btn"
                sx={{
                    opacity: menuOpen ? 1 : 0,
                    transition: "opacity 0.15s ease",
                    "@media (hover: none)": { opacity: 1 },
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <MoreMenu
                    iconFontSize={14}
                    placement="bottom-end"
                    triggerSize={20}
                    items={[
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
                            id: "export-folder",
                            label: t.notes.exportZip.menuItem,
                            icon: <FolderZipRoundedIcon sx={{ fontSize: 16 }} />,
                            onClick: () => actions.onExportFolder(folder),
                        },
                        {
                            id: "new-subfolder",
                            label: t.notes.folders.newSubfolder,
                            icon: <CreateNewFolderRoundedIcon sx={{ fontSize: 16 }} />,
                            onClick: () => actions.onCreateSubfolder(folder.folderId),
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
                        },
                        {
                            id: "delete",
                            label: t.notes.folders.deleteFolder,
                            icon: <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />,
                            danger: true,
                            onClick: () => actions.onDeleteFolder(folder),
                        },
                    ]}
                    onOpenChange={setMenuOpen}
                />
            </Box>
        </ListItemButton>
    );

    return (
        <Box>
            <ListItem nested>
                {/* Folder header — always a drop target so notes can be
                    filed into a COLLAPSED folder too. */}
                <DroppableHeader containerId={myFolderContainerId(folder.folderId)} kind={1}>
                    {(isDraggingOver) => headerRow(isDraggingOver)}
                </DroppableHeader>

                {/* Contents: rendered only when expanded (collapsed
                    subtrees pay zero render cost — same trade-off as
                    NoteTreeRenderer). */}
                {isExpanded && (
                    <List
                        sx={{
                            pl: 1.5,
                            "--List-nestedInsetStart": "16px",
                        }}
                    >
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

export const MyNoteFolderTree = memo(MyNoteFolderTreeComponent);
