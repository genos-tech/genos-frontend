import AddIcon from "@mui/icons-material/Add";
import CancelIcon from "@mui/icons-material/Cancel";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import { Box, IconButton, Stack, Tooltip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { GMAvatar } from "../../../../components/ui/avatars/GMAvatar";
import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { MoreMenu, MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { NoteHeaderActionsStyles } from "../../../../components/ui/styles/commonStyle";
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
    isInTaskPage: boolean;
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
    isInTaskPage,
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
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? NoteHeaderActionsStyles.dark : NoteHeaderActionsStyles.light;
    const navigate = useNavigate();

    // Chat type mapping for URL construction
    const CHAT_TYPE_PATH_MAP: Record<number, string> = {
        1: "dm",
        2: "gm",
        3: "pm",
        4: "mdm",
    };

    // Action button style
    const actionButtonStyle = {
        background: styles.buttonBg,
        border: `1px solid ${styles.buttonBorder}`,
        borderRadius: "10px",
        color: styles.textColor,
        minWidth: 36,
        height: 36,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
            background: styles.buttonHover,
            transform: "translateY(-1px)",
            boxShadow: `0 4px 12px ${styles.glowColor}`,
        },
    };

    // Danger button style (Close)
    const dangerButtonStyle = {
        background: styles.dangerBg,
        border: `1px solid ${styles.dangerBorder}`,
        borderRadius: "10px",
        width: "36px",
        height: "36px",
        transition: "all 0.2s ease",
        "&:hover": {
            background: styles.dangerHover,
            transform: "translateY(-1px)",
        },
    };

    // Avatar container style
    const avatarContainerStyle = {
        p: 0.5,
        borderRadius: "10px",
        background: styles.avatarBg,
        border: `1px solid ${styles.avatarBorder}`,
        transition: "all 0.2s ease",
        "&:hover": {
            background: isDark ? "rgba(251,191,36,0.15)" : "rgba(245,158,11,0.12)",
        },
    };

    return (
        <Stack
            alignItems="center"
            direction="row"
            justifyContent="space-between"
            sx={{
                width: "100%",
            }}
        >
            {isInChatPage === true && useNM.currentChatNote && (
                <Box
                    sx={{
                        ml: "5px",
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

            <Stack alignItems="center" direction="row" spacing={1} sx={{ pb: 0.5 }}>
                {/* Chat Avatars with styled containers */}
                {chat && chat.chatType === 1 && (
                    <Box sx={avatarContainerStyle}>
                        <AvatarWithStatus
                            avatarUser={useTEM.teamMemberProfiles[chat.dmPartnerUser.userId]}
                            chat={chat}
                            isYou={false}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useUISM={useUISM}
                        />
                    </Box>
                )}
                {chat && chat.chatType === 2 && (
                    <Box sx={avatarContainerStyle}>
                        <GMAvatar
                            gmChat={chat}
                            isYou={false}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    </Box>
                )}
                {chat && chat.chatType === 3 && (
                    <Box sx={avatarContainerStyle}>
                        <ProjectAvatar
                            myself={myself}
                            pmChat={chat}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    </Box>
                )}

                {/* Open Related Chat Button */}
                {isInChatPage === false && (
                    <Tooltip
                        size="sm"
                        title="Open related chat"
                        variant="outlined"
                        sx={{
                            background: styles.menuBg,
                            border: `1px solid ${styles.menuBorder}`,
                            borderRadius: "8px",
                            backdropFilter: "blur(8px)",
                        }}
                    >
                        <IconButton
                            size="sm"
                            sx={actionButtonStyle}
                            variant="plain"
                            onClick={() => {
                                useCM.moveToSpecificChat(
                                    useNM.currentChatNote?.chatType || 0,
                                    useNM.currentChatNote?.chatId || 0,
                                    useNM.currentChatNote?.threadId || 0,
                                    true,
                                    false,
                                    useTM.setCurrentPreviewTaskId,
                                    usePM.setCurrentProject
                                );
                            }}
                        >
                            <QuestionAnswerIcon sx={{ fontSize: 18, color: styles.accentColor }} />
                        </IconButton>
                    </Tooltip>
                )}

                {/* More Options Dropdown */}
                {(() => {
                    const items: MoreMenuItem[] = [
                        {
                            id: "copyNoteLink",
                            label: "Copy note link",
                            icon: <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />,
                            visible: !!useNM.currentChatNote,
                            onClick: async () => {
                                const note = useNM.currentChatNote;
                                if (note) {
                                    const CHAT_TYPE_MAP: Record<number, string> = {
                                        1: "dm",
                                        2: "gm",
                                        3: "pm",
                                    };
                                    const chatTypePath = CHAT_TYPE_MAP[note.chatType];
                                    if (chatTypePath) {
                                        const noteUrl = `${window.location.origin}/workspace/notes/chat/${chatTypePath}/${note.chatId}/thread/${note.threadId}/note/${note.noteId}`;
                                        try {
                                            await navigator.clipboard.writeText(noteUrl);
                                        } catch (err) {
                                            console.error("Failed to copy link:", err);
                                        }
                                    }
                                }
                            },
                        },
                        {
                            id: "childNote",
                            label: "Child Note",
                            icon: <AddIcon sx={{ fontSize: 18 }} />,
                            onClick: onCreateChildNote,
                        },
                        {
                            id: "openInNotes",
                            label: "Open in Notes",
                            icon: <LaunchRoundedIcon sx={{ fontSize: 18 }} />,
                            visible: isInChatPage,
                            onClick: () => {
                                const note = useNM.currentChatNote;
                                if (note) {
                                    const chatTypePath = CHAT_TYPE_PATH_MAP[note.chatType];
                                    if (chatTypePath) {
                                        navigate(
                                            `/workspace/notes/chat/${chatTypePath}/${note.chatId}/thread/${note.threadId}/note/${note.noteId}`
                                        );
                                    }
                                }
                            },
                        },
                        {
                            id: "deleteNote",
                            label: "Delete Note",
                            icon: <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />,
                            danger: true,
                            onClick: onDeleteNote,
                        },
                    ];
                    return (
                        <MoreMenu
                            iconFontSize={20}
                            items={items}
                            placement="bottom-end"
                            triggerSize={36}
                            triggerSx={actionButtonStyle}
                        />
                    );
                })()}

                {/* Close Button */}
                {(isInChatPage === true || isInTaskPage === true) && (
                    <Tooltip
                        size="sm"
                        title="Close"
                        variant="outlined"
                        sx={{
                            background: styles.menuBg,
                            border: `1px solid ${styles.menuBorder}`,
                            borderRadius: "8px",
                            backdropFilter: "blur(8px)",
                        }}
                    >
                        <IconButton
                            size="sm"
                            sx={dangerButtonStyle}
                            variant="plain"
                            onClick={() => {
                                useCM.setIsChatNoteVisibleInChat(false);
                                if (useCM.setIsMainChatVisible) {
                                    useCM.setIsMainChatVisible(true);
                                }
                                if (isInTaskPage) {
                                    useNM.setIsTaskNoteVisible(false);
                                }
                            }}
                        >
                            <CancelIcon
                                sx={{
                                    fontSize: "20px",
                                    color: isDark ? "#e879c3" : "#c026a8",
                                }}
                            />
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
