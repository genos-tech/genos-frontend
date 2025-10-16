import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVert from "@mui/icons-material/MoreVert";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import WindowIcon from "@mui/icons-material/Window";
import {
    Breadcrumbs,
    Dropdown,
    IconButton,
    Menu,
    MenuButton,
    MenuItem,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";

import { NoteManagementState } from "../../../hooks/notes/useNoteManagement";
import { MyNoteMetaTreeNode } from "../../../types/notes";
import { ModalDeleteMyNote } from "../modals/ModalDeleteMyNote";

interface NoteHeaderProps {
    currentMyNoteChain: MyNoteMetaTreeNode[] | undefined;
    NM: NoteManagementState;
    onCreateNewNote: () => void;
    onCreateChildNote: () => void;
    onDeleteNote: () => void;
    openDeleteNote: boolean;
    setOpenDeleteNote: (open: boolean) => void;
    handleCloseTab: (tabIndex: number, closingNoteId: number) => Promise<void>;
    myself: any;
}

export const NoteHeader = ({
    currentMyNoteChain,
    NM,
    onCreateNewNote,
    onCreateChildNote,
    onDeleteNote,
    openDeleteNote,
    setOpenDeleteNote,
    handleCloseTab,
    myself,
}: NoteHeaderProps) => {
    return (
        <Stack
            alignItems="center"
            direction="row"
            justifyContent="space-between"
            sx={{
                width: "100%",
                height: "30px",
                mt: "10px",
                mb: "5px",
            }}
        >
            <Breadcrumbs aria-label="breadcrumbs" separator="›">
                <IconButton
                    color="primary"
                    component="button"
                    variant="soft"
                    sx={{
                        fontSize: "14px",
                    }}
                >
                    <WindowIcon sx={{ fontSize: "20px" }} />
                    My Notes
                </IconButton>
                {currentMyNoteChain &&
                    currentMyNoteChain.map((node) => (
                        <Typography
                            key={node.noteId}
                            component="button"
                            level="title-sm"
                            sx={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                color: "#646CFF",
                                textAlign: "left",
                                fontWeight: "bold",
                            }}
                            onClick={() => {
                                NM.loadNote(1, node.noteId, -1);
                            }}
                        >
                            {node.title.length > 14 ? `${node.title.slice(0, 14)}...` : node.title}
                        </Typography>
                    ))}
            </Breadcrumbs>

            <Stack direction={"row"}>
                <Tooltip size="sm" title="Create a New Note">
                    <IconButton
                        color="neutral"
                        component="button"
                        size="sm"
                        sx={{ px: "10px", mb: "5px" }}
                        variant="plain"
                        onClick={onCreateNewNote}
                    >
                        <PlaylistAddIcon sx={{ mr: "2px" }} />
                        New Note
                    </IconButton>
                </Tooltip>
                <Dropdown>
                    <Tooltip title="More Options">
                        <MenuButton
                            slots={{ root: IconButton }}
                            sx={{ mb: "5px" }}
                            slotProps={{
                                root: { color: "neutral" },
                            }}
                        >
                            <MoreVert />
                        </MenuButton>
                    </Tooltip>
                    <Menu size="sm">
                        <MenuItem onClick={onCreateChildNote}>
                            <AddIcon />
                            Child Note
                        </MenuItem>
                        <MenuItem
                            sx={{
                                color: "red",
                                fontWeight: "bold",
                            }}
                            onClick={onDeleteNote}
                        >
                            <DeleteIcon sx={{ color: "red" }} />
                            Delete Note
                        </MenuItem>
                    </Menu>
                </Dropdown>
            </Stack>
            {NM.currentMyNote && (
                <ModalDeleteMyNote
                    currentMyNote={NM.currentMyNote}
                    currentTabIndex={NM.selectedTabIndex}
                    handleCloseTab={handleCloseTab}
                    myNoteMeta={NM.myNoteMeta}
                    myself={myself}
                    openDeleteNote={openDeleteNote}
                    setMyNoteMeta={NM.setMyNoteMeta}
                    setOpenDeleteNote={setOpenDeleteNote}
                />
            )}
        </Stack>
    );
};
