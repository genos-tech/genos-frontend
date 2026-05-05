import AddIcon from "@mui/icons-material/Add";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import NoteAddRoundedIcon from "@mui/icons-material/NoteAddRounded";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import {
    Box,
    Divider,
    Dropdown,
    IconButton,
    Menu,
    MenuButton,
    MenuItem,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";
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

// Amber/Orange theme for Chat Notes
const HEADER_STYLES = {
    dark: {
        buttonBg: "linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(245,158,11,0.12) 100%)",
        buttonHover:
            "linear-gradient(135deg, rgba(251,191,36,0.22) 0%, rgba(245,158,11,0.22) 100%)",
        buttonBorder: "rgba(251,191,36,0.3)",
        primaryButtonBg: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
        primaryButtonHover: "linear-gradient(135deg, #fcd34d 0%, #fbbf24 100%)",
        dangerBg: "linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(220,38,38,0.12) 100%)",
        dangerHover: "linear-gradient(135deg, rgba(239,68,68,0.22) 0%, rgba(220,38,38,0.22) 100%)",
        dangerBorder: "rgba(239,68,68,0.3)",
        menuBg: "linear-gradient(180deg, rgba(30,32,44,0.98) 0%, rgba(20,22,34,0.99) 100%)",
        menuBorder: "rgba(251,191,36,0.15)",
        textColor: "#fef3c7",
        accentColor: "#fbbf24",
        glowColor: "rgba(251,191,36,0.3)",
        avatarBg: "rgba(251,191,36,0.1)",
        avatarBorder: "rgba(251,191,36,0.2)",
    },
    light: {
        buttonBg: "linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(245,158,11,0.1) 100%)",
        buttonHover:
            "linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(245,158,11,0.18) 100%)",
        buttonBorder: "rgba(217,119,6,0.25)",
        primaryButtonBg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        primaryButtonHover: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
        dangerBg: "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220,38,38,0.08) 100%)",
        dangerHover: "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.15) 100%)",
        dangerBorder: "rgba(239,68,68,0.2)",
        menuBg: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(254,243,199,0.95) 100%)",
        menuBorder: "rgba(217,119,6,0.12)",
        textColor: "#78350f",
        accentColor: "#d97706",
        glowColor: "rgba(217,119,6,0.2)",
        avatarBg: "rgba(245,158,11,0.08)",
        avatarBorder: "rgba(217,119,6,0.15)",
    },
};

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
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? HEADER_STYLES.dark : HEADER_STYLES.light;
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

    // Primary button style (Child Note)
    const primaryButtonStyle = {
        background: styles.primaryButtonBg,
        color: isDark ? "#1c1917" : "#fff",
        fontWeight: 600,
        fontSize: "13px",
        borderRadius: "10px",
        border: "none",
        px: 1.5,
        py: 0.75,
        gap: 0.5,
        height: 36,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: `0 2px 8px ${styles.glowColor}, inset 0 1px 0 rgba(255,255,255,0.15)`,
        "&:hover": {
            background: styles.primaryButtonHover,
            transform: "translateY(-2px)",
            boxShadow: `0 6px 16px ${styles.glowColor}, inset 0 1px 0 rgba(255,255,255,0.2)`,
        },
    };

    // Danger button style (Close)
    const dangerButtonStyle = {
        background: styles.dangerBg,
        border: `1px solid ${styles.dangerBorder}`,
        borderRadius: "10px",
        color: "#ef4444",
        minWidth: 36,
        height: 36,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
            background: styles.dangerHover,
            transform: "translateY(-1px)",
            boxShadow: "0 4px 12px rgba(239,68,68,0.2)",
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
                    <Box sx={avatarContainerStyle}>
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
                    <Box sx={avatarContainerStyle}>
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

                {/* Open Related Chat Button */}
                {isInChatPage === false && (
                    <Tooltip
                        size="sm"
                        title="Open Related Chat"
                        variant="soft"
                        sx={{
                            background: styles.menuBg,
                            border: `1px solid ${styles.menuBorder}`,
                            borderRadius: "8px",
                            backdropFilter: "blur(8px)",
                        }}
                    >
                        <IconButton
                            size="sm"
                            variant="plain"
                            sx={actionButtonStyle}
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
                <Dropdown>
                    <MenuButton
                        slots={{ root: IconButton }}
                        slotProps={{
                            root: {
                                size: "sm",
                                variant: "plain",
                                sx: actionButtonStyle,
                            },
                        }}
                    >
                        <MoreHorizRoundedIcon sx={{ fontSize: 20, color: styles.accentColor }} />
                    </MenuButton>
                    <Menu
                        size="sm"
                        sx={{
                            background: styles.menuBg,
                            backdropFilter: "blur(12px)",
                            border: `1px solid ${styles.menuBorder}`,
                            borderRadius: "12px",
                            boxShadow: isDark
                                ? `0 12px 40px rgba(0,0,0,0.5), 0 0 20px ${styles.glowColor}`
                                : `0 12px 40px rgba(0,0,0,0.12), 0 0 15px ${styles.glowColor}`,
                            p: 0.75,
                            minWidth: 200,
                            "& .MuiMenuItem-root": {
                                borderRadius: "8px",
                                transition: "all 0.15s ease-out",
                            },
                        }}
                    >
                        {/* Copy Note Link */}
                        {useNM.currentChatNote ? (
                            <MenuItem
                                onClick={async () => {
                                    const note = useNM.currentChatNote;
                                    if (note) {
                                        const CHAT_TYPE_MAP: Record<number, string> = {
                                            1: "dm",
                                            2: "gm",
                                            3: "pm",
                                        };
                                        const chatTypePath = CHAT_TYPE_MAP[note.chatType];
                                        if (chatTypePath) {
                                            const noteUrl = `${window.location.origin}/home/notes/chat/${chatTypePath}/${note.chatId}/thread/${note.threadId}/note/${note.noteId}`;
                                            try {
                                                await navigator.clipboard.writeText(noteUrl);
                                            } catch (err) {
                                                console.error("Failed to copy link:", err);
                                            }
                                        }
                                    }
                                }}
                                sx={{
                                    gap: 1.25,
                                    py: 0.875,
                                    "&:hover": {
                                        background: isDark
                                            ? "rgba(52,211,153,0.18)"
                                            : "rgba(5,150,105,0.12)",
                                        "& .copy-icon-box": {
                                            background: isDark
                                                ? "rgba(52,211,153,0.25)"
                                                : "rgba(5,150,105,0.18)",
                                            borderColor: isDark
                                                ? "rgba(52,211,153,0.4)"
                                                : "rgba(5,150,105,0.3)",
                                        },
                                        "& .copy-text": {
                                            color: isDark ? "#34d399" : "#059669",
                                        },
                                    },
                                }}
                            >
                                <Box
                                    className="copy-icon-box"
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 28,
                                        height: 28,
                                        borderRadius: "7px",
                                        background: isDark
                                            ? "rgba(52,211,153,0.12)"
                                            : "rgba(5,150,105,0.08)",
                                        border: `1px solid ${isDark ? "rgba(52,211,153,0.25)" : "rgba(5,150,105,0.2)"}`,
                                        transition: "all 0.15s ease",
                                    }}
                                >
                                    <ContentCopyRoundedIcon
                                        sx={{
                                            fontSize: 16,
                                            color: isDark ? "#34d399" : "#059669",
                                        }}
                                    />
                                </Box>
                                <Typography
                                    className="copy-text"
                                    level="body-sm"
                                    sx={{
                                        fontWeight: 500,
                                        color: styles.textColor,
                                        transition: "color 0.15s ease",
                                    }}
                                >
                                    Copy note link
                                </Typography>
                            </MenuItem>
                        ) : null}

                        {/* Child Note */}
                        <MenuItem
                            onClick={onCreateChildNote}
                            sx={{
                                gap: 1.25,
                                py: 0.875,
                                "&:hover": {
                                    background: styles.buttonHover,
                                },
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 28,
                                    height: 28,
                                    borderRadius: "7px",
                                    background: styles.buttonBg,
                                    border: `1px solid ${styles.buttonBorder}`,
                                }}
                            >
                                <AddIcon sx={{ fontSize: 16, color: styles.accentColor }} />
                            </Box>
                            <Typography
                                level="body-sm"
                                sx={{ fontWeight: 500, color: styles.textColor }}
                            >
                                Child Note
                            </Typography>
                        </MenuItem>

                        {/* Open in Notes */}
                        {isInChatPage && (
                            <MenuItem
                                onClick={() => {
                                    const note = useNM.currentChatNote;
                                    if (note) {
                                        const chatTypePath = CHAT_TYPE_PATH_MAP[note.chatType];
                                        if (chatTypePath) {
                                            navigate(
                                                `/home/notes/chat/${chatTypePath}/${note.chatId}/thread/${note.threadId}/note/${note.noteId}`
                                            );
                                        }
                                    }
                                }}
                                sx={{
                                    gap: 1.25,
                                    py: 0.875,
                                    "&:hover": {
                                        background: styles.buttonHover,
                                    },
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 28,
                                        height: 28,
                                        borderRadius: "7px",
                                        background: styles.buttonBg,
                                        border: `1px solid ${styles.buttonBorder}`,
                                    }}
                                >
                                    <LaunchRoundedIcon
                                        sx={{ fontSize: 16, color: styles.accentColor }}
                                    />
                                </Box>
                                <Typography
                                    level="body-sm"
                                    sx={{ fontWeight: 500, color: styles.textColor }}
                                >
                                    Open in Notes
                                </Typography>
                            </MenuItem>
                        )}

                        <Divider sx={{ my: 0.5, opacity: 0.3 }} />

                        {/* Delete Note */}
                        <MenuItem
                            onClick={onDeleteNote}
                            sx={{
                                gap: 1.25,
                                py: 0.875,
                                "&:hover": {
                                    background: styles.dangerHover,
                                },
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 28,
                                    height: 28,
                                    borderRadius: "7px",
                                    background: styles.dangerBg,
                                    border: `1px solid ${styles.dangerBorder}`,
                                }}
                            >
                                <DeleteOutlineRoundedIcon
                                    sx={{ fontSize: 16, color: "#ef4444" }}
                                />
                            </Box>
                            <Typography level="body-sm" sx={{ fontWeight: 500, color: "#ef4444" }}>
                                Delete Note
                            </Typography>
                        </MenuItem>
                    </Menu>
                </Dropdown>

                {/* Close Button */}
                {isInChatPage === true && (
                    <Tooltip
                        size="sm"
                        title="Close Notes"
                        variant="soft"
                        sx={{
                            background: styles.menuBg,
                            border: `1px solid ${styles.menuBorder}`,
                            borderRadius: "8px",
                            backdropFilter: "blur(8px)",
                        }}
                    >
                        <IconButton
                            size="sm"
                            variant="plain"
                            sx={dangerButtonStyle}
                            onClick={() => {
                                useCM.setIsChatNoteVisibleInChat(false);
                                if (useCM.setIsMainChatVisible) {
                                    useCM.setIsMainChatVisible(true);
                                }
                            }}
                        >
                            <CloseRoundedIcon sx={{ fontSize: 18 }} />
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
