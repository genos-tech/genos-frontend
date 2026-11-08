// `sort-keys` + `react/jsx-sort-props` disabled file-wide: this 842-
// line legacy chat-pane header carries ~80 violations in Joy UI `sx`
// prop objects and prop lists whose visual grouping is intentional and
// not worth re-sorting given the surface is legacy chat code slated
// for replacement by the v3 channel UI.
/* eslint-disable react/jsx-sort-props */
import { useMemo, useState } from "react";
import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import SwapVertRoundedIcon from "@mui/icons-material/SwapVertRounded";
import VideoCameraFrontRoundedIcon from "@mui/icons-material/VideoCameraFrontRounded";
import { Badge, Button, Dropdown, IconButton, MenuButton, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";
import { Socket } from "socket.io-client";

import { useNoteModalHostZIndex } from "../../../../components/modals/noteModalHostZIndex";
import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { Spinner } from "../../../../components/ui/feedback/Skeleton";
import { Toast } from "../../../../components/ui/feedback/Toast";
import { modalChromeEndPadding } from "../../../../components/ui/modal/modalChrome";
import { MenuRow, MenuSurface } from "../../../../components/ui/MoreMenu";
import { pageHeaderFrameSx } from "../../../../components/ui/page/pageHeaderFrame";
import { ChatPaneHeaderStyles } from "../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../context/AuthContext";
import { useCalendarModal } from "../../../../context/CalendarModalContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../../../hooks/common/useIsMobile";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import {
    MuteMenuItem,
    MuteToggleButton,
} from "../../../../services/notifications/MuteToggleButton";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { AllChatProps, ChatProps } from "../../../../types/chat";
import { isMac } from "../../../../utils/platform";
import { createEvent, deleteEvent, getEvent } from "../../../integrations/services/calendar";
import { redirectToOAuthConnect } from "../../../integrations/services/oauth";
import { useMarkAllChatActivityRead } from "../../hooks/useMarkAllChatActivityRead";
import { sendChatMessage } from "../../services/sendChatMessage";
import { chatDisplayName } from "../../utils/chatDisplayName";
import { ModalAddMembers } from "../modals/ModalAddMembers";
import { ModalShareMeetLink } from "../modals/ModalShareMeetLink";
import { HeaderUserName } from "./HeaderUserName";

type MainChatPaneHeaderProps = {
    chat: ChatProps;
    incompleteTodoCount: number;
    isToDoVisible: boolean;
    myself: UserProps;
    setIsToDoVisible: (value: boolean) => void;
    setMyself: (value: UserProps) => void;
    useUISM: UIStateManagementState;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
};

export const MainChatPaneHeader = (props: MainChatPaneHeaderProps) => {
    const {
        chat,
        incompleteTodoCount,
        isToDoVisible,
        myself,
        setIsToDoVisible,
        setMyself,
        useUISM,
        socket,
        useTEM,
        useCM,
        useTM,
    } = props;

    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const isMobile = useIsMobile();
    // Set only inside a preview modal, which draws its own Close (MIP-1296).
    const isModalHosted = useNoteModalHostZIndex() != null;
    const navigate = useNavigate();
    const styles = isDark ? ChatPaneHeaderStyles.dark : ChatPaneHeaderStyles.light;

    const isYou: boolean = myself.userId === chat.dmPartnerUser.userId;

    // Name to persist when this chat is muted. `chat.chatName` is empty for a
    // DM whose partner didn't resolve and ALWAYS empty for an MDM, and an empty
    // name is dropped by the API — which left Settings → Muted items rendering
    // the raw chat UUID. Derive the same name the header itself shows instead.
    // Read off the `allChats` row because `mdmMembers` rides only on that row,
    // not on `currentMainChat`.
    const muteLabel =
        chatDisplayName(
            useCM.allChats.find((c) => c.chatId === chat.chatId && c.chatType === chat.chatType) ??
                chat,
            myself,
            useTEM.teamMemberProfiles
        ) || undefined;

    const [openAddMembers, setOpenAddMembers] = useState(false);

    // Compact calendar modal — opener pulled from the global
    // provider. Returns null outside the provider (e.g. pre-auth
    // routes), in which case the IconButton renders nothing below.
    const calendarModal = useCalendarModal();

    // Quick Meet flow state. The throwaway calendar event is deleted
    // immediately after the Meet link is minted — Google keeps the
    // meeting space valid for hours after the linking event is gone,
    // so the calendar stays clean.
    const { accessToken } = useAuth();
    const [quickMeetLoading, setQuickMeetLoading] = useState(false);
    // `needsGrant` swaps the snackbar's action button to a
    // "Grant access" CTA that re-runs the connect-intent OAuth flow.
    // `needsReconnect` is the same OAuth flow but for a revoked/expired
    // refresh token — only the button label differs ("Reconnect").
    const [quickMeetSnackbar, setQuickMeetSnackbar] = useState<{
        kind: "error" | "info";
        text: string;
        needsGrant?: boolean;
        needsReconnect?: boolean;
    } | null>(null);
    // Link held for the share-confirm modal; null when modal is closed.
    const [shareMeetLink, setShareMeetLink] = useState<string | null>(null);

    const handleQuickMeet = async () => {
        if (!accessToken || quickMeetLoading) return;
        setQuickMeetLoading(true);
        setQuickMeetSnackbar(null);

        const now = new Date();
        const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
        const event = await createEvent(
            accessToken,
            {
                add_meet: true,
                end: { dateTime: inOneHour.toISOString() },
                start: { dateTime: now.toISOString() },
                summary: t.chat.headers.quickMeetEventTitle,
            },
            (err) => {
                setQuickMeetSnackbar({
                    kind: "error",
                    text: err || t.chat.headers.quickMeetFailed,
                });
            }
        );
        if (event === "google_not_connected") {
            setQuickMeetLoading(false);
            setQuickMeetSnackbar({
                kind: "error",
                text: t.chat.headers.quickMeetNotConnected,
            });
            return;
        }
        if (event === "calendar_scope_missing") {
            setQuickMeetLoading(false);
            setQuickMeetSnackbar({
                kind: "error",
                text: t.chat.headers.quickMeetScopeMissing,
                needsGrant: true,
            });
            return;
        }
        if (event === "google_reauth_required") {
            setQuickMeetLoading(false);
            setQuickMeetSnackbar({
                kind: "error",
                text: t.chat.headers.quickMeetReauth,
                needsReconnect: true,
            });
            return;
        }
        if (!event) {
            setQuickMeetLoading(false);
            return;
        }

        // hangoutLink may not be present on the create response;
        // conferenceData.createRequest.status.statusCode can be
        // "pending". Poll up to ~5 s for the link to appear.
        let link = event.hangoutLink;
        for (let i = 0; !link && i < 5; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            const refreshed = await getEvent(accessToken, event.id);
            if (refreshed && typeof refreshed === "object" && "hangoutLink" in refreshed) {
                link = refreshed.hangoutLink;
            }
        }
        setQuickMeetLoading(false);

        // Always clean up the throwaway event; the Meet space survives.
        void deleteEvent(accessToken, event.id);

        if (!link) {
            setQuickMeetSnackbar({ kind: "error", text: t.chat.headers.quickMeetFailed });
            return;
        }

        // Best-effort clipboard copy so the user can paste the link
        // elsewhere even if they cancel the share modal. Fails silently
        // under non-secure origin / iframe sandboxes.
        try {
            await navigator.clipboard.writeText(link);
        } catch {
            /* clipboard not available — link still shown in modal */
        }

        setShareMeetLink(link);
    };

    const handleShareMeetLink = async () => {
        const link = shareMeetLink;
        setShareMeetLink(null);
        if (!link || !socket) return;
        // Mirror the BlockNote document shape `bnChatEditor` emits — a
        // paragraph block with a `link` inline node so the URL renders
        // as a clickable hyperlink (plain text wouldn't auto-linkify on
        // the receive side). It ends with the empty paragraph every stored
        // body ends with (see `withTrailingBlank`), which the renderers drop.
        const content = [
            {
                type: "paragraph",
                content: [
                    {
                        type: "link",
                        href: link,
                        content: [{ type: "text", text: link, styles: {} }],
                    },
                ],
            },
            {
                type: "paragraph",
                content: [],
            },
        ];
        await sendChatMessage({
            socket,
            chat,
            content,
            myself,
            useCM,
            setCurrentChat: useCM.setCurrentMainChat,
        });
    };

    const handleQuickMeetGrant = () => {
        if (!accessToken) return;
        setQuickMeetSnackbar(null);
        // Redirects to Google's OAuth consent page; on return the
        // callback handler upgrades the existing ConnectedAccount's
        // scopes in place.
        void redirectToOAuthConnect("google", accessToken, undefined, () => undefined);
    };

    // Quick Meet is meaningless in self-DMs (no one to meet) and
    // disabled in PM (PM messages must be system-user + task-linked;
    // the share path can't post there). Surfaced in DM/GM/MDM.
    const showQuickMeet = chat.chatType !== 3 && !isYou;

    const { markAllAsRead } = useMarkAllChatActivityRead({ myself, useCM });

    // PUNCH LIST (v3 chatId migration): `chat.chatId` is `string`
    // post-flip; `ActivityMessageProps.chatId` and the
    // `useMarkAllChatActivityRead` API are still `number`. Cast once;
    // legacy `/` socket activity events carry numeric chatIds, so the
    // comparison is meaningful for those rows. UUID-shaped v3 chatIds
    // won't match the legacy activity store, which is the right
    // behavior — the v3 read-cursor path handles its own state.
    const chatIdLegacy = chat.chatId as unknown as number;

    const unreadActivityCount = useMemo(
        () =>
            useCM.activityMessages.filter(
                (a) =>
                    a.chatType === chat.chatType && a.chatId === chatIdLegacy && a.isRead === false
            ).length,
        [useCM.activityMessages, chat.chatType, chatIdLegacy]
    );

    const switchSubToMain = () => {
        if (useCM.isSubChatVisible === true) {
            useCM.setCurrentMainChat(useCM.currentSubChat as ChatProps);
            useCM.setIsSubChatVisible(false);
        } else {
            useCM.setIsMainChatVisible(false);
        }
    };

    const swapChat = () => {
        useCM.setCurrentMainChat(useCM.currentSubChat as ChatProps);
        useCM.setCurrentSubChat(chat);
    };

    // Mobile back navigation. Mirrors useChatRouting's
    // CHAT_TYPE_REVERSE_MAP; duplicated here to avoid plumbing the whole
    // routing hook through this component's prop surface.
    const CHAT_TYPE_TO_PATH: Record<number, string> = {
        1: "dm",
        2: "gm",
        3: "pm",
        4: "mdm",
        5: "activity",
        6: "flagged",
    };
    const handleMobileBack = () => {
        const typePath = CHAT_TYPE_TO_PATH[chat.chatType] ?? "dm";
        navigate(`/workspace/chat/${typePath}`);
    };

    if (isMobile) {
        return (
            <Stack
                direction="row"
                sx={{
                    // The shared top bar (height, hairline, page background), with the
                    // back button's tighter side padding.
                    ...pageHeaderFrameSx,
                    justifyContent: "space-between",
                    alignItems: "center",
                    px: 1,
                    gap: 0.5,
                    // In a preview modal the dialog's own buttons float over this corner.
                    ...modalChromeEndPadding("8px"),
                }}
            >
                <IconButton
                    size="sm"
                    variant="plain"
                    onClick={handleMobileBack}
                    aria-label={t.chat.headers.backToChat}
                    sx={{ flexShrink: 0 }}
                >
                    <ArrowBackIosNewRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>

                <Stack
                    direction="row"
                    sx={{ alignItems: "center", flex: 1, minWidth: 0, overflow: "hidden" }}
                >
                    <HeaderUserName
                        chat={chat}
                        useCM={useCM}
                        isYou={isYou}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />
                </Stack>

                <Stack direction="row" sx={{ alignItems: "center", gap: 0.25, flexShrink: 0 }}>
                    {/* Self-DM: the ToDo toggle is the primary action, so it
                        takes the visible icon slot and mute moves into the
                        overflow menu below. Every other chat keeps mute
                        surfaced here (it has no ToDo pane). */}
                    {isYou === true ? (
                        isToDoVisible === true ? (
                            <AppTooltip size="sm" title={t.chat.headers.backToChat}>
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    onClick={() => setIsToDoVisible(false)}
                                    aria-label={t.chat.headers.backToChat}
                                >
                                    <QuestionAnswerRoundedIcon
                                        sx={{ fontSize: 18, color: styles.accentColor }}
                                    />
                                </IconButton>
                            </AppTooltip>
                        ) : (
                            <AppTooltip size="sm" title={t.chat.headers.todoTooltip}>
                                <Badge
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    badgeContent={incompleteTodoCount}
                                    color="primary"
                                    size="sm"
                                >
                                    <IconButton
                                        size="sm"
                                        variant="plain"
                                        onClick={() => setIsToDoVisible(true)}
                                        aria-label={t.chat.headers.todoTooltip}
                                    >
                                        <ChecklistRoundedIcon
                                            sx={{ fontSize: 18, color: styles.accentColor }}
                                        />
                                    </IconButton>
                                </Badge>
                            </AppTooltip>
                        )
                    ) : (
                        <MuteToggleButton
                            chatType={chat.chatType}
                            chatId={chat.chatId}
                            chatName={muteLabel}
                        />
                    )}

                    <Dropdown>
                        <MenuButton
                            slots={{ root: IconButton }}
                            slotProps={{ root: { size: "sm", variant: "plain" } }}
                        >
                            <MoreVertRoundedIcon sx={{ fontSize: 20 }} />
                        </MenuButton>
                        <MenuSurface placement="bottom-end" sx={{ minWidth: 200 }}>
                            {unreadActivityCount > 0 && (
                                <MenuRow
                                    icon={<DoneAllRoundedIcon />}
                                    onClick={() => markAllAsRead(chat.chatType, chatIdLegacy)}
                                >
                                    {t.chat.headers.markAllReadAria}
                                </MenuRow>
                            )}

                            {showQuickMeet && (
                                <MenuRow
                                    disabled={quickMeetLoading}
                                    icon={
                                        quickMeetLoading ? (
                                            <Spinner />
                                        ) : (
                                            <VideoCameraFrontRoundedIcon />
                                        )
                                    }
                                    onClick={handleQuickMeet}
                                >
                                    {t.chat.headers.quickMeetTooltip}
                                </MenuRow>
                            )}

                            {chat.chatType === 3 && (
                                <MenuRow
                                    icon={<AddTaskRoundedIcon />}
                                    onClick={() => {
                                        useCM.setIsMainChatVisible(true);
                                        useCM.setIsThreadVisible(false);
                                        useTM.setIsTaskPreviewVisible(false);
                                        useTM.setIsCreatingTask({
                                            flag: true,
                                            parentTaskId: null,
                                            rootTaskId: null,
                                            creationKind: "task",
                                            milestoneId: null,
                                        });
                                    }}
                                >
                                    {t.chat.headers.createNewTaskTooltip}
                                </MenuRow>
                            )}

                            {isYou === true && calendarModal && (
                                <MenuRow
                                    onClick={calendarModal.open}
                                    icon={<CalendarMonthRoundedIcon />}
                                >
                                    {t.calendar.openTooltip}
                                </MenuRow>
                            )}

                            {useCM.isSubChatVisible && (
                                <MenuRow onClick={() => swapChat()} icon={<SwapVertRoundedIcon />}>
                                    {t.chat.headers.swapChats}
                                </MenuRow>
                            )}

                            {(chat.chatType === 4 || chat.chatType === 1) && (
                                <MenuRow
                                    onClick={() => setOpenAddMembers(true)}
                                    icon={<PersonAddRoundedIcon />}
                                >
                                    {t.chat.headers.addMembers}
                                </MenuRow>
                            )}

                            {/* Self-DM only: ToDo lives in the visible icon
                                slot above, so mute is surfaced here in the
                                overflow instead. Other chats keep mute as
                                their visible icon and don't need this. */}
                            {isYou === true && (
                                <MuteMenuItem
                                    chatType={chat.chatType}
                                    chatId={chat.chatId}
                                    chatName={muteLabel}
                                />
                            )}
                        </MenuSurface>
                    </Dropdown>
                </Stack>

                {/* Modals and snackbars still need to render in mobile mode */}
                {(chat.chatType === 4 || chat.chatType === 1) && (
                    <ModalAddMembers
                        socket={socket}
                        myself={myself}
                        chat={chat as unknown as AllChatProps}
                        open={openAddMembers}
                        setOpen={setOpenAddMembers}
                        useCM={useCM}
                        useTEM={useTEM}
                        useUISM={useUISM}
                        setMyself={setMyself}
                    />
                )}
                <ModalShareMeetLink
                    open={shareMeetLink !== null}
                    link={shareMeetLink}
                    onShare={handleShareMeetLink}
                    onCancel={() => setShareMeetLink(null)}
                />
                <Toast
                    action={
                        quickMeetSnackbar?.needsGrant || quickMeetSnackbar?.needsReconnect
                            ? {
                                  label: quickMeetSnackbar.needsReconnect
                                      ? t.chat.headers.quickMeetReconnect
                                      : t.chat.headers.quickMeetGrant,
                                  onClick: handleQuickMeetGrant,
                              }
                            : undefined
                    }
                    duration={4000}
                    open={quickMeetSnackbar !== null}
                    tone={quickMeetSnackbar?.kind === "error" ? "danger" : "neutral"}
                    onClose={() => setQuickMeetSnackbar(null)}
                >
                    {quickMeetSnackbar?.text}
                </Toast>
            </Stack>
        );
    }

    return (
        <Stack
            direction="row"
            sx={{
                // The channel header is this pane's page header: the shared frame.
                ...pageHeaderFrameSx,
                justifyContent: "space-between",
                alignItems: "center",
                // In a preview modal the dialog's own buttons float over this corner.
                ...modalChromeEndPadding("24px"),
            }}
        >
            <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} sx={{ alignItems: "center" }}>
                <HeaderUserName
                    chat={chat}
                    useCM={useCM}
                    isYou={isYou}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            </Stack>

            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                {/* Per-chat mute toggle */}
                <MuteToggleButton
                    chatType={chat.chatType}
                    chatId={chat.chatId}
                    chatName={muteLabel}
                />

                {/* Mark all activity in this chat as read */}
                {unreadActivityCount > 0 && (
                    <AppTooltip size="sm" title={t.chat.headers.markAllReadAria}>
                        <IconButton
                            size="sm"
                            variant="plain"
                            onClick={() => markAllAsRead(chat.chatType, chatIdLegacy)}
                            aria-label={t.chat.headers.markAllReadAria}
                        >
                            <DoneAllRoundedIcon sx={{ fontSize: 18, color: styles.accentColor }} />
                        </IconButton>
                    </AppTooltip>
                )}

                {/* Quick Meet — mint a Meet link, copy to clipboard, offer to share */}
                {showQuickMeet && (
                    <AppTooltip size="sm" title={t.chat.headers.quickMeetTooltip}>
                        <IconButton
                            size="sm"
                            variant="plain"
                            loading={quickMeetLoading}
                            onClick={handleQuickMeet}
                            aria-label={t.chat.headers.quickMeetTooltip}
                        >
                            <VideoCameraFrontRoundedIcon
                                sx={{ fontSize: 18, color: styles.accentColor }}
                            />
                        </IconButton>
                    </AppTooltip>
                )}

                {/* Create Task Button */}
                {chat.chatType === 3 && (
                    <AppTooltip size="sm" title={t.chat.headers.createNewTaskTooltip}>
                        <IconButton
                            size="sm"
                            color="primary"
                            variant="solid"
                            onClick={() => {
                                useCM.setIsMainChatVisible(true);
                                useCM.setIsThreadVisible(false);
                                useTM.setIsTaskPreviewVisible(false);
                                useTM.setIsCreatingTask({
                                    flag: true,
                                    parentTaskId: null,
                                    rootTaskId: null,
                                    creationKind: "task",
                                    milestoneId: null,
                                });
                            }}
                        >
                            <AddTaskRoundedIcon sx={{ fontSize: 18, color: "#fff" }} />
                        </IconButton>
                    </AppTooltip>
                )}

                {/* To-Do Button (only for self chat) */}
                {isYou === true && (
                    <>
                        {isToDoVisible === true ? (
                            <AppTooltip size="sm" title={t.chat.headers.backToChat}>
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    onClick={() => setIsToDoVisible(false)}
                                >
                                    <QuestionAnswerRoundedIcon
                                        sx={{ fontSize: 18, color: styles.accentColor }}
                                    />
                                </IconButton>
                            </AppTooltip>
                        ) : (
                            <AppTooltip size="sm" title={t.chat.headers.todoTooltip}>
                                <Badge
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    badgeContent={incompleteTodoCount}
                                    color="primary"
                                    size="sm"
                                    sx={{
                                        "& .MuiBadge-badge": {
                                            zIndex: 1,
                                            background: g.accent.solid,
                                            border: "2px solid",
                                            borderColor: isDark ? "#1e2028" : "#fff",
                                        },
                                    }}
                                >
                                    <IconButton
                                        size="sm"
                                        variant="plain"
                                        onClick={() => setIsToDoVisible(true)}
                                    >
                                        <ChecklistRoundedIcon
                                            sx={{ fontSize: 18, color: styles.accentColor }}
                                        />
                                    </IconButton>
                                </Badge>
                            </AppTooltip>
                        )}

                        {/* Compact Calendar modal — only surfaced
                            in the DM-with-self header (per the
                            Phase 3 plan). Keyboard shortcut
                            Ctrl+Cmd+C / Ctrl+Alt+C is the other
                            entry point. */}
                        {calendarModal && (
                            <AppTooltip
                                size="sm"
                                title={`${t.calendar.openTooltip} (${
                                    isMac()
                                        ? t.calendar.openShortcut.mac
                                        : t.calendar.openShortcut.windows
                                })`}
                            >
                                <IconButton
                                    size="sm"
                                    variant="plain"
                                    onClick={calendarModal.open}
                                    aria-label={t.calendar.openTooltip}
                                >
                                    <CalendarMonthRoundedIcon
                                        sx={{ fontSize: 18, color: styles.accentColor }}
                                    />
                                </IconButton>
                            </AppTooltip>
                        )}
                    </>
                )}

                {/* Swap Chat Button */}
                {useCM.isSubChatVisible && (
                    <AppTooltip size="sm" title={t.chat.headers.swapChats}>
                        <IconButton size="sm" variant="plain" onClick={() => swapChat()}>
                            <SwapVertRoundedIcon
                                sx={{ fontSize: 18, color: styles.accentColor }}
                            />
                        </IconButton>
                    </AppTooltip>
                )}

                {/* Add Members Button (MDM / DM) */}
                {(chat.chatType === 4 || chat.chatType === 1) && (
                    <AppTooltip size="sm" title={t.chat.headers.addMembers}>
                        <IconButton
                            size="sm"
                            variant="plain"
                            onClick={() => setOpenAddMembers(true)}
                        >
                            <PersonAddRoundedIcon
                                sx={{ fontSize: 18, color: styles.accentColor }}
                            />
                        </IconButton>
                    </AppTooltip>
                )}

                {/* Close Button. A preview modal has its own Close, right where this one
                    would sit (MIP-1296). */}
                {!isModalHosted && (
                    <AppTooltip size="sm" title={t.chat.headers.close}>
                        <IconButton
                            size="sm"
                            color="danger"
                            variant="plain"
                            onClick={() => switchSubToMain()}
                        >
                            <CloseRoundedIcon
                                sx={{ fontSize: 18, color: "var(--gp-tint-danger-alt)" }}
                            />
                        </IconButton>
                    </AppTooltip>
                )}
            </Stack>

            {/* Add Members Modal */}
            {(chat.chatType === 4 || chat.chatType === 1) && (
                <ModalAddMembers
                    socket={socket}
                    myself={myself}
                    chat={chat as unknown as AllChatProps}
                    open={openAddMembers}
                    setOpen={setOpenAddMembers}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                    setMyself={setMyself}
                />
            )}

            {/* Share-Meet-Link confirm modal — opens once the link is
                in the clipboard. Approve sends the link to chat using
                the same optimistic-update path as the BlockNote editor;
                Cancel just closes and the user keeps the clipboard. */}
            <ModalShareMeetLink
                open={shareMeetLink !== null}
                link={shareMeetLink}
                onShare={handleShareMeetLink}
                onCancel={() => setShareMeetLink(null)}
            />

            {/* Quick Meet error snackbar — only renders on failure /
                missing-scope / not-connected paths. The success path
                opens the share modal instead. */}
            <Toast
                action={
                    quickMeetSnackbar?.needsGrant || quickMeetSnackbar?.needsReconnect
                        ? {
                              label: quickMeetSnackbar.needsReconnect
                                  ? t.chat.headers.quickMeetReconnect
                                  : t.chat.headers.quickMeetGrant,
                              onClick: handleQuickMeetGrant,
                          }
                        : undefined
                }
                duration={4000}
                open={quickMeetSnackbar !== null}
                tone={quickMeetSnackbar?.kind === "error" ? "danger" : "neutral"}
                onClose={() => setQuickMeetSnackbar(null)}
            >
                {quickMeetSnackbar?.text}
            </Toast>
        </Stack>
    );
};
