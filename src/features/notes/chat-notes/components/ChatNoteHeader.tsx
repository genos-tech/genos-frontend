import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
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

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { GMAvatar } from "../../../../components/ui/avatars/GMAvatar";
import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { MoreMenu, MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { NoteHeaderActionsStyles } from "../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { NoteAskModal, useNoteAsk } from "../../../noteAsk";
import { SpotlightResult } from "../../../spotlight/types";
import { ModalDeleteChatNote } from "../../chat-notes/modals/ModalDeleteChatNote";
import { NoteBreadcrumbs } from "../../common/components/NoteBreadcrumbs";
import { NoteHistoryChip } from "../../common/components/NoteHistoryChip";
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
    const { t } = useTranslation();
    const { accessToken } = useAuth();

    // Chat type mapping for URL construction
    const CHAT_TYPE_PATH_MAP: Record<number, string> = {
        1: "dm",
        2: "gm",
        3: "pm",
        4: "mdm",
    };

    // ---- "Ask about this note" wiring ----
    // ChatNoteMain has its own header (this component) rather than
    // routing through `NoteHeaderActions`, so the Ask button + modal
    // are mounted here too. Same hook contract, just bound to chat
    // notes (noteType=3).
    const noteAsk = useNoteAsk({ accessToken, teamId: myself.teamId });
    const activeChatNoteId = useNM.currentChatNote?.noteId ?? null;
    const askButtonAvailable = activeChatNoteId != null;
    const openNoteAsk = () => {
        if (!askButtonAvailable || activeChatNoteId == null) return;
        noteAsk.open({ noteType: 3, noteId: activeChatNoteId });
    };
    // Citation click handler — same URL routing as NoteHeaderActions /
    // ThreadChatPaneHeader. Inline rather than shared because the
    // route shapes are short and rarely change.
    const onCitationSelect = (r: SpotlightResult) => {
        if (r.entity_type === "task" && r.task_id && r.project_id) {
            navigate(`/workspace/tasks/project/${r.project_id}/task/${r.task_id}`);
            return;
        }
        if (r.entity_type === "project" && r.project_id) {
            navigate(`/workspace/tasks/project/${r.project_id}`);
            return;
        }
        if (r.entity_type === "chat" && r.chat_type && r.chat_id) {
            const base = `/workspace/chat/${r.chat_type}/${r.chat_id}`;
            if (r.thread_id) {
                const url = `${base}/thread/${r.thread_id}`;
                navigate(r.message_id ? `${url}/message/${r.message_id}` : url);
            } else {
                navigate(r.message_id ? `${base}/message/${r.message_id}` : base);
            }
            return;
        }
        if (r.entity_type === "note" && r.note_id) {
            if (r.note_type === "personal") {
                navigate(`/workspace/notes/my/${r.note_id}`);
                return;
            }
            if (r.note_type === "task" && r.project_id && r.task_id) {
                navigate(
                    `/workspace/notes/task/project/${r.project_id}` +
                        `/task/${r.task_id}/note/${r.note_id}`
                );
                return;
            }
            if (r.note_type === "chat" && r.chat_type && r.chat_id && r.thread_id) {
                navigate(
                    `/workspace/notes/chat/${r.chat_type}` +
                        `/${r.chat_id}/thread/${r.thread_id}/note/${r.note_id}`
                );
                return;
            }
            navigate("/workspace/notes");
        }
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
                <Stack
                    alignItems="center"
                    direction="row"
                    spacing={1}
                    sx={{ minWidth: 0, flex: 1 }}
                >
                    <NoteBreadcrumbs
                        color="warning"
                        icon={<QuestionAnswerRoundedIcon />}
                        label={t.notes.header.chatNotesLabel}
                        noteChain={useNM.currentChatNoteChain}
                        onNodeClick={(noteId) => useNM.loadNote(3, noteId, -1)}
                    />
                    <NoteHistoryChip
                        myself={myself}
                        noteId={useNM.currentChatNote?.noteId ?? 0}
                        noteType={3}
                        setMyself={setMyself}
                        socket={socket}
                        useCM={useCM}
                        useNM={useNM}
                        useUISM={useUISM}
                    />
                </Stack>
            )}

            <Stack alignItems="center" direction="row" spacing={1} sx={{ pb: 0.5 }}>
                {/* History chip — in chat-page mode the breadcrumb is
                    replaced by `ACChatChildNotes` on the left, so we
                    keep the version chip with the other action buttons
                    on the right instead of orphaning it. */}
                {isInChatPage === true && useNM.currentChatNote && (
                    <NoteHistoryChip
                        myself={myself}
                        noteId={useNM.currentChatNote?.noteId ?? 0}
                        noteType={3}
                        setMyself={setMyself}
                        socket={socket}
                        useCM={useCM}
                        useNM={useNM}
                        useUISM={useUISM}
                    />
                )}

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

                {/* Open Related Chat Button. Gated on `chat` — the
                    resolved `AllChatProps` for this note's channel (found
                    in `useCM.allChats` by the note's channel UUID). When
                    the note has no resolvable channel (e.g. a stale/NULL
                    `channel` row, or a channel the user can't see), `chat`
                    is undefined and we hide the button rather than fire
                    `moveToSpecificChat` with a falsy id (which logged
                    "Chat not found: chatId=0"). We pass the chat's own
                    verified chatType/chatId so the lookup can't miss. */}
                {isInChatPage === false && chat && (
                    <Tooltip
                        size="sm"
                        title={t.notes.header.openRelatedChat}
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
                                // Seed the chat-panel note state with the note
                                // the user is already viewing BEFORE navigating.
                                // moveToSpecificChat only flips the visibility
                                // flag (setIsChatNoteVisibleInChat); it never
                                // populates chatPanelApi.note, so without this
                                // the chat-page ChatNoteMain reads a null
                                // chatPanelApi.note and renders an empty pane.
                                // setNote (not openOrCreate) carries the exact
                                // child note + its body with no refetch.
                                if (useNM.currentChatNote) {
                                    useNM.chatPanelApi.setNote(useNM.currentChatNote);
                                }
                                useCM.moveToSpecificChat(
                                    chat.chatType,
                                    chat.chatId,
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

                {/* "Ask about this note" — opens the AI Q&A modal.
                    Hidden until an active chat note is resolved; the
                    hook needs (noteType, noteId) to fetch the summary. */}
                {askButtonAvailable && (
                    <AppTooltip title={t.noteAsk.headerButton.tooltip}>
                        <IconButton
                            aria-label={t.noteAsk.headerButton.tooltip}
                            size="sm"
                            sx={actionButtonStyle}
                            variant="plain"
                            onClick={openNoteAsk}
                        >
                            <AutoAwesomeRoundedIcon
                                sx={{ fontSize: 18, color: styles.accentColor }}
                            />
                        </IconButton>
                    </AppTooltip>
                )}

                {/* More Options Dropdown */}
                {(() => {
                    const items: MoreMenuItem[] = [
                        {
                            id: "copyNoteLink",
                            label: t.notes.header.copyNoteLink,
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
                            label: t.notes.header.childNote,
                            icon: <AddIcon sx={{ fontSize: 18 }} />,
                            onClick: onCreateChildNote,
                        },
                        {
                            id: "openInNotes",
                            label: t.notes.header.openInNotes,
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
                            label: t.notes.header.deleteNote,
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
                        title={t.notes.header.close}
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

                {/* "Ask about this note" modal — mounted once per
                    ChatNoteHeader instance so state lives for the
                    lifetime of this note view. */}
                <NoteAskModal state={noteAsk} onSelectSource={onCitationSelect} />
            </Stack>
        </Stack>
    );
};
