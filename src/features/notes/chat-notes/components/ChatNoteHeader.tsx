import AddIcon from "@mui/icons-material/Add";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVert from "@mui/icons-material/MoreVert";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import {
    Box,
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
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/common/avatarWithStatus";
import { GMAvatar } from "../../../../components/common/GMAvatar";
import { ProjectAvatar } from "../../../../components/common/ProjectAvatar";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ChatNoteProps } from "../../../../types/notes";
import { ModalDeleteChatNote } from "../../chat-notes/modals/ModalDeleteChatNote";
import { ACChatChildNotes } from "./autocompletes/ACChatChildNotes";

interface ChatNoteHeaderProps {
    chat: any;
    isInChatPage: boolean;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    UIM: UIStateManagementState;
    TM: TaskManagementState;
    setCurrentProject: (project: any) => void;
    socket: Socket | null;
    TEM: TeamManagementState;
    CM: ChatManagementState;
    NM: NoteManagementState;
    openDeleteNote: boolean;
    setOpenDeleteNote: (open: boolean) => void;
    openSearchBox: boolean;
    setOpenSearchBox: (open: boolean) => void;
    handleCloseTab: (tabIndex: number, closingNoteId: number) => Promise<void>;
    onCreateChildNote: () => void;
    onDeleteNote: () => void;
}

export const ChatNoteHeader = ({
    chat,
    isInChatPage,
    myself,
    setMyself,
    UIM,
    TM,
    setCurrentProject,
    socket,
    TEM,
    CM,
    NM,
    openDeleteNote,
    setOpenDeleteNote,
    openSearchBox,
    setOpenSearchBox,
    handleCloseTab,
    onCreateChildNote,
    onDeleteNote,
}: ChatNoteHeaderProps) => {
    return (
        <Stack
            alignItems="center"
            direction="row"
            justifyContent="space-between"
            sx={{
                width: "100%",
                height: "30px",
                mt: isInChatPage === true ? "0px" : "10px",
                mb: "5px",
            }}
        >
            {isInChatPage === true && NM.currentChatNote && (
                <Box
                    sx={{
                        ml: "5px",
                        mb: "10px",
                        width: "40%",
                    }}
                >
                    <ACChatChildNotes
                        myself={myself}
                        openSearchBox={openSearchBox}
                        setOpenSearchBox={setOpenSearchBox}
                        NM={NM}
                    />
                </Box>
            )}

            {isInChatPage === false && (
                <Breadcrumbs aria-label="breadcrumbs" separator="›">
                    <IconButton
                        color="warning"
                        component="button"
                        variant="soft"
                        sx={{
                            fontSize: "14px",
                        }}
                    >
                        <QuestionAnswerRoundedIcon sx={{ fontSize: "20px" }} />
                        Chat Notes
                    </IconButton>
                    {NM.currentChatNoteChain &&
                        NM.currentChatNoteChain.map((node, index) => (
                            <Tooltip
                                key={`chat-note-tooltip-${index}`}
                                size="sm"
                                title={node.title}
                                variant="outlined"
                            >
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
                                        NM.loadNote(3, node.noteId, -1);
                                    }}
                                >
                                    {node.title.length > 14
                                        ? `${node.title.slice(0, 14)}...`
                                        : node.title}
                                </Typography>
                            </Tooltip>
                        ))}
                </Breadcrumbs>
            )}

            <Stack direction={"row"}>
                {/* Chat Avatar */}
                {chat && chat.chatType === 1 && (
                    <Box sx={{ mt: "2px", mr: "5px" }}>
                        <AvatarWithStatus
                            avatarUser={TEM.teamMemberProfiles[chat.dmPartnerUser.userId]}
                            chat={chat}
                            CM={CM}
                            isYou={false}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            UIM={UIM}
                        />
                    </Box>
                )}
                {chat && chat.chatType === 2 && (
                    <Box sx={{ mt: "2px", mr: "5px" }}>
                        <GMAvatar
                            CM={CM}
                            gmChat={chat}
                            isYou={false}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            TEM={TEM}
                            UIM={UIM}
                        />
                    </Box>
                )}
                {chat && chat.chatType === 3 && (
                    <Box sx={{ mt: "2px", mr: "5px" }}>
                        <ProjectAvatar
                            CM={CM}
                            myself={myself}
                            pmChat={chat}
                            setMyself={setMyself}
                            socket={socket}
                            TEM={TEM}
                            UIM={UIM}
                        />
                    </Box>
                )}

                {/* Action Buttons */}
                {isInChatPage && NM.currentChatNote && (
                    <IconButton
                        color="neutral"
                        component="button"
                        variant="plain"
                        sx={{
                            fontSize: "14px",
                            paddingRight: "10px",
                            height: "5px",
                        }}
                        onClick={onCreateChildNote}
                    >
                        <AddIcon />
                        Child Note
                    </IconButton>
                )}

                {isInChatPage && (
                    <Tooltip size="sm" title="Open in Notes" variant="outlined">
                        <IconButton
                            color="neutral"
                            size="sm"
                            sx={{ mb: "5px" }}
                            variant="plain"
                            onClick={() => {
                                UIM.setOpeningService(3);
                            }}
                        >
                            <OpenInNewIcon />
                        </IconButton>
                    </Tooltip>
                )}

                {isInChatPage === false && (
                    <Tooltip size="sm" title="Open Related Chat" variant="outlined">
                        <IconButton
                            color="neutral"
                            size="sm"
                            sx={{ mb: "5px" }}
                            variant="plain"
                            onClick={() => {
                                CM.moveToSpecificChat(
                                    NM.currentChatNote?.chatType || 0,
                                    NM.currentChatNote?.chatId || 0,
                                    NM.currentChatNote?.threadId || 0,
                                    true, // openTaskNoteInChat
                                    false, // openThreadTaskPreview
                                    UIM.setOpeningService,
                                    TM.setCurrentPreviewTaskId,
                                    setCurrentProject
                                );
                            }}
                        >
                            <QuestionAnswerIcon />
                        </IconButton>
                    </Tooltip>
                )}

                <Dropdown>
                    <MenuButton
                        slots={{ root: IconButton }}
                        sx={{ mb: "5px" }}
                        slotProps={{
                            root: { color: "neutral" },
                        }}
                    >
                        <MoreVert />
                    </MenuButton>
                    <Menu size="sm">
                        <MenuItem onClick={onCreateChildNote}>
                            <AddIcon />
                            Child Note
                        </MenuItem>
                        <MenuItem
                            sx={{
                                color: "red",
                            }}
                            onClick={onDeleteNote}
                        >
                            <DeleteIcon sx={{ color: "red" }} />
                            <Typography color="danger" level="title-sm">
                                Delete Note
                            </Typography>
                        </MenuItem>
                    </Menu>
                </Dropdown>

                {isInChatPage === true && (
                    <Tooltip size="sm" title="Close Notes" variant="outlined">
                        <IconButton
                            color="neutral"
                            size="sm"
                            sx={{ mb: "5px" }}
                            variant="plain"
                            onClick={() => {
                                CM.setIsChatNoteVisibleInChat(false);

                                // Open main chat pane
                                if (CM.setIsMainChatVisible) {
                                    CM.setIsMainChatVisible(true);
                                }
                            }}
                        >
                            <CancelIcon />
                        </IconButton>
                    </Tooltip>
                )}

                {/* Delete Modal */}
                {NM.currentChatNote && (
                    <ModalDeleteChatNote
                        handleCloseTab={handleCloseTab}
                        myself={myself}
                        openDeleteNote={openDeleteNote}
                        setOpenDeleteNote={setOpenDeleteNote}
                        NM={NM}
                    />
                )}
            </Stack>
        </Stack>
    );
};
