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
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { UserProps } from "../../../../types/admin";
import { ChatNoteProps } from "../../../../types/notes";
import { ModalDeleteChatNote } from "../../chat-notes/modals/ModalDeleteChatNote";
import { ACChatChildNotes } from "./autocompletes/ACChatChildNotes";

interface ChatNoteHeaderProps {
    currentChatNote: ChatNoteProps | null;
    currentChatNoteChain: any[] | undefined;
    chat: any;
    isInChatPage: boolean;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    setOpeningService: (service: number) => void;
    setCurrentPreviewTaskId: (id: number) => void;
    setCurrentProject: (project: any) => void;
    socket: Socket | null;
    teamMemberProfiles: Record<string, UserProps>;
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
    currentChatNote,
    currentChatNoteChain,
    chat,
    isInChatPage,
    myself,
    setMyself,
    setOpeningService,
    setCurrentPreviewTaskId,
    setCurrentProject,
    socket,
    teamMemberProfiles,
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
            {isInChatPage === true && currentChatNote && (
                <Box
                    sx={{
                        ml: "5px",
                        mb: "10px",
                        width: "40%",
                    }}
                >
                    <ACChatChildNotes
                        myself={myself}
                        noteId={currentChatNote.noteId}
                        openSearchBox={openSearchBox}
                        setCurrentChatNote={NM.setCurrentChatNote}
                        setOpenSearchBox={setOpenSearchBox}
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
                    {currentChatNoteChain &&
                        currentChatNoteChain.map((node, index) => (
                            <Tooltip title={node.title} key={`chat-note-tooltip-${index}`}>
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
                            chat={chat}
                            isYou={false}
                            myself={myself}
                            setMyself={setMyself}
                            setOpeningService={setOpeningService}
                            socket={socket}
                            avatarUser={teamMemberProfiles[chat.dmPartnerUser.userId]}
                            setCurrentMainChat={CM.setCurrentMainChat}
                        />
                    </Box>
                )}
                {chat && chat.chatType === 2 && (
                    <Box sx={{ mt: "2px", mr: "5px" }}>
                        <GMAvatar
                            funcSetAllChats={CM.funcSetAllChats}
                            gmChat={chat}
                            isYou={false}
                            myself={myself}
                            setMyself={setMyself}
                            setOpeningService={setOpeningService}
                            socket={socket}
                            teamMemberProfiles={teamMemberProfiles}
                            setCurrentMainChat={CM.setCurrentMainChat}
                        />
                    </Box>
                )}
                {chat && chat.chatType === 3 && (
                    <Box sx={{ mt: "2px", mr: "5px" }}>
                        <ProjectAvatar
                            funcSetAllChats={CM.funcSetAllChats}
                            myself={myself}
                            pmChat={chat}
                            setMyself={setMyself}
                            setOpeningService={setOpeningService}
                            socket={socket}
                            teamMemberProfiles={teamMemberProfiles}
                            setCurrentMainChat={CM.setCurrentMainChat}
                        />
                    </Box>
                )}

                {/* Action Buttons */}
                {isInChatPage && currentChatNote && (
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
                    <Tooltip title="Open in Notes">
                        <IconButton
                            color="neutral"
                            size="sm"
                            sx={{ mb: "5px" }}
                            variant="plain"
                            onClick={() => {
                                setOpeningService(3);
                            }}
                        >
                            <OpenInNewIcon />
                        </IconButton>
                    </Tooltip>
                )}

                {isInChatPage === false && (
                    <Tooltip title="Open Related Chat">
                        <IconButton
                            color="neutral"
                            size="sm"
                            sx={{ mb: "5px" }}
                            variant="plain"
                            onClick={() => {
                                CM.moveToSpecificChat(
                                    currentChatNote?.chatType || 0,
                                    currentChatNote?.chatId || 0,
                                    currentChatNote?.threadId || 0,
                                    true, // openTaskNoteInChat
                                    false, // openThreadTaskPreview
                                    setOpeningService,
                                    setCurrentPreviewTaskId,
                                    setCurrentProject
                                );
                            }}
                        >
                            <QuestionAnswerIcon />
                        </IconButton>
                    </Tooltip>
                )}

                {/* More Options Dropdown */}
                <Dropdown>
                    <Tooltip title="More Options" placement="left-start">
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

                {isInChatPage === true && (
                    <Tooltip title="Close Notes">
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
                {currentChatNote && (
                    <ModalDeleteChatNote
                        chatNoteMeta={NM.chatNoteMeta}
                        currentChatNote={currentChatNote}
                        currentTabIndex={NM.selectedTabIndex}
                        handleCloseTab={handleCloseTab}
                        myself={myself}
                        openDeleteNote={openDeleteNote}
                        setChatNoteMeta={NM.setChatNoteMeta}
                        setOpenDeleteNote={setOpenDeleteNote}
                    />
                )}
            </Stack>
        </Stack>
    );
};
