import AddIcon from "@mui/icons-material/Add";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVert from "@mui/icons-material/MoreVert";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import {
    Box,
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

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { GMAvatar } from "../../../../components/ui/avatars/GMAvatar";
import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ModalDeleteChatNote } from "../../chat-notes/modals/ModalDeleteChatNote";
import { NoteBreadcrumbs } from "../../common/components/NoteBreadcrumbs";
import { ACChatChildNotes } from "./autocompletes/ACChatChildNotes";

interface ChatNoteHeaderProps {
    chat: any;
    isInChatPage: boolean;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useUISM: UIStateManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useNM: NoteManagementState;
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
    useUISM,
    useTM,
    usePM,
    socket,
    useTEM,
    useCM,
    useNM,
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
            {isInChatPage === true && useNM.currentChatNote && (
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
                        useNM={useNM}
                    />
                </Box>
            )}

            {isInChatPage === false && (
                <NoteBreadcrumbs
                    color="warning"
                    icon={<QuestionAnswerRoundedIcon />}
                    label="Chat Notes"
                    noteChain={useNM.currentChatNoteChain}
                    onNodeClick={(noteId) => useNM.loadNote(3, noteId, -1)}
                />
            )}

            <Stack direction={"row"}>
                {/* Chat Avatar */}
                {chat && chat.chatType === 1 && (
                    <Box sx={{ mt: "2px", mr: "5px" }}>
                        <AvatarWithStatus
                            avatarUser={useTEM.teamMemberProfiles[chat.dmPartnerUser.userId]}
                            chat={chat}
                            useCM={useCM}
                            isYou={false}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useUISM={useUISM}
                        />
                    </Box>
                )}
                {chat && chat.chatType === 2 && (
                    <Box sx={{ mt: "2px", mr: "5px" }}>
                        <GMAvatar
                            useCM={useCM}
                            gmChat={chat}
                            isYou={false}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    </Box>
                )}
                {chat && chat.chatType === 3 && (
                    <Box sx={{ mt: "2px", mr: "5px" }}>
                        <ProjectAvatar
                            useCM={useCM}
                            myself={myself}
                            pmChat={chat}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    </Box>
                )}

                {/* Action Buttons */}
                {isInChatPage && useNM.currentChatNote && (
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
                                useUISM.setOpeningService(3);
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
                                useCM.moveToSpecificChat(
                                    useNM.currentChatNote?.chatType || 0,
                                    useNM.currentChatNote?.chatId || 0,
                                    useNM.currentChatNote?.threadId || 0,
                                    true, // openTaskNoteInChat
                                    false, // openThreadTaskPreview
                                    useUISM.setOpeningService,
                                    useTM.setCurrentPreviewTaskId,
                                    usePM.setCurrentProject
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
                                useCM.setIsChatNoteVisibleInChat(false);

                                // Open main chat pane
                                if (useCM.setIsMainChatVisible) {
                                    useCM.setIsMainChatVisible(true);
                                }
                            }}
                        >
                            <CancelIcon />
                        </IconButton>
                    </Tooltip>
                )}

                {/* Delete Modal */}
                {useNM.currentChatNote && (
                    <ModalDeleteChatNote
                        handleCloseTab={handleCloseTab}
                        myself={myself}
                        openDeleteNote={openDeleteNote}
                        setOpenDeleteNote={setOpenDeleteNote}
                        useNM={useNM}
                    />
                )}
            </Stack>
        </Stack>
    );
};
