// The "Messages / Pinned" tabs of a chat pane (MIP-2487). The message list stays mounted under
// the Pinned tab, so its scroll position and the jump machinery survive the switch.

import { ReactNode, useEffect, useId, useRef, useState } from "react";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PushPinRoundedIcon from "@mui/icons-material/PushPinRounded";
import { Box, IconButton, Typography } from "@mui/joy";

import { useNoteModalHostZIndex } from "../../../../components/modals/noteModalHostZIndex";
import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { EmojiText } from "../../../../components/ui/emoji/EmojiText";
import { Spinner } from "../../../../components/ui/feedback/Skeleton";
import { TabStrip } from "../../../../components/ui/feedback/TabStrip";
import { toast } from "../../../../components/ui/feedback/toastStore";
import { touchTargetSx } from "../../../../components/ui/touchTargets";
import { fmt, useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";
import { focusRing } from "../../../../theme/tokens";
import { MessagePin } from "../../../../types/channel";
import { ChatProps } from "../../../../types/chat";
import { extractYYYYMMDDHHMM } from "../../../../utils/dateUtils";
import { useIsChatArchived } from "../../../archive/archiveState";
import { useChannelMessagePins } from "../../hooks/useMessagePins";
import { changeMessagePin, MESSAGE_PIN_TOAST_ID, pinnedExcerpt } from "../../utils/messagePins";

type PinnedMessagesFrameProps = {
    chat: ChatProps;
    setCurrentChat: (update: (prev: ChatProps | undefined) => ChatProps | undefined) => void;
    /** Called with the index of each row seen, as `MessageListRenderer` reports it. */
    onMessageSeenIndex: (index: number) => void;
    /** The messages and composer, given the seen-row handler to wire to the list. */
    children: (onMessageSeenIndex: (index: number) => void) => ReactNode;
};

export const PinnedMessagesFrame = (props: PinnedMessagesFrameProps) => {
    // A chat in a preview modal is a snapshot with nowhere to jump to: its setter is the
    // page's own, so a jump there would move the chat behind the dialog.
    const isModalHosted = useNoteModalHostZIndex() != null;
    return isModalHosted ? <>{props.children(props.onMessageSeenIndex)}</> : <Tabs {...props} />;
};

const Tabs = ({
    chat,
    setCurrentChat,
    onMessageSeenIndex,
    children,
}: PinnedMessagesFrameProps) => {
    const { t } = useTranslation();
    const held = useChannelMessagePins(chat.chatId);
    const archived = useIsChatArchived(chat);
    const [openFor, setOpenFor] = useState<string | null>(null);
    // The pin whose history is loading.
    const [jumping, setJumping] = useState<MessagePin | null>(null);
    const count = held?.pins.length ?? 0;
    // A chat with nothing pinned looks as it always did.
    const available = count + (held?.hiddenCount ?? 0) > 0;
    const open = available && openFor === chat.chatId;
    useEffect(() => {
        setOpenFor(null);
    }, [available, chat.chatId]);

    // The jump waits for history, and the pane may show another chat by then.
    const chatIdRef = useRef(chat.chatId);
    chatIdRef.current = chat.chatId;
    const rootRef = useRef<HTMLDivElement>(null);
    const focusSelectedTab = () =>
        requestAnimationFrame(() =>
            rootRef.current
                ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
                ?.focus()
        );

    // Rows that arrive under the Pinned tab are not read. The observer reports a row once,
    // so keep the newest and report it when the person comes back by the Messages tab. A
    // jump forgets it: they land somewhere else.
    const unseenRef = useRef<number | null>(null);
    useEffect(() => {
        unseenRef.current = null;
    }, [chat.chatId]);
    const reportSeen = open
        ? (index: number) => {
              unseenRef.current = Math.max(index, unseenRef.current ?? index);
          }
        : onMessageSeenIndex;
    const choose = (id: string) => {
        setOpenFor(id === "pinned" ? chat.chatId : null);
        if (id !== "pinned" && unseenRef.current !== null) {
            onMessageSeenIndex(unseenRef.current);
            unseenRef.current = null;
        }
    };

    const jumpTo = async (pin: MessagePin) => {
        if (jumping?.channelId === pin.channelId) return;
        setJumping(pin);
        const found = await channelService.loadMessagesBackTo(pin.channelId, pin.messageId);
        setJumping((current) => (current === pin ? null : current));
        if (chatIdRef.current !== pin.channelId) return;
        if (!found) {
            toast.error(t.chat.pinnedMessages.jumpFailed, { id: MESSAGE_PIN_TOAST_ID });
            return;
        }
        unseenRef.current = null;
        setOpenFor(null);
        focusSelectedTab();
        // An updater: the load above has just queued the older rows into the chat, and
        // writing back the object held here would drop them.
        setCurrentChat((prev) =>
            prev && prev.chatId === pin.channelId
                ? { ...prev, jumpNonce: Date.now(), moveToSpecificIndex: pin.messageId }
                : prev
        );
    };

    const panelId = useId();

    return (
        <Box ref={rootRef} sx={{ display: "contents" }}>
            {available && (
                <Box sx={{ flexShrink: 0, minWidth: 0, px: 2, pt: 0.5 }}>
                    <TabStrip
                        ariaLabel={t.chat.pinnedMessages.tabsAria}
                        size="sm"
                        value={open ? "pinned" : "messages"}
                        tabs={[
                            {
                                icon: <ChatBubbleOutlineRoundedIcon />,
                                id: "messages",
                                label: t.chat.pinnedMessages.messagesTab,
                            },
                            {
                                count,
                                icon: <PushPinRoundedIcon />,
                                id: "pinned",
                                label: t.chat.pinnedMessages.pinnedTab,
                                panelId,
                            },
                        ]}
                        onChange={choose}
                    />
                </Box>
            )}
            <Box
                sx={{
                    display: "flex",
                    flex: 1,
                    flexDirection: "column",
                    minHeight: 0,
                    position: "relative",
                }}
            >
                <Box
                    inert={open}
                    sx={{
                        display: "flex",
                        flex: 1,
                        flexDirection: "column",
                        // Keeps the layers of what is underneath below the panel.
                        isolation: "isolate",
                        minHeight: 0,
                    }}
                >
                    {children(reportSeen)}
                </Box>
                {open && held && (
                    <Box
                        aria-label={t.chat.pinnedMessages.listAria}
                        id={panelId}
                        role="tabpanel"
                        sx={{
                            backgroundColor: "background.surface",
                            inset: 0,
                            // Room for the phone's floating Genos button under the last row.
                            pb: "var(--fab-clearance, 0px)",
                            overflowY: "auto",
                            position: "absolute",
                            zIndex: 1,
                        }}
                    >
                        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 1 }}>
                            {held.pins.map((pin) => (
                                <PinnedRow
                                    key={pin.id}
                                    archived={archived}
                                    loading={jumping?.id === pin.id}
                                    pin={pin}
                                    onOpen={() => void jumpTo(pin)}
                                    onUnpin={async () => {
                                        await changeMessagePin(
                                            pin.channelId,
                                            pin.messageId,
                                            false
                                        );
                                        // The row is gone with its button: keep the keyboard
                                        // in the list, or on the tabs.
                                        requestAnimationFrame(() => {
                                            const next =
                                                rootRef.current?.querySelector<HTMLElement>(
                                                    '[role="tabpanel"] li button'
                                                );
                                            if (next) next.focus();
                                            else focusSelectedTab();
                                        });
                                    }}
                                />
                            ))}
                        </Box>
                        {held.hiddenCount > 0 && (
                            <Typography level="body-xs" sx={{ px: 2, py: 1 }}>
                                {fmt(
                                    held.hiddenCount === 1
                                        ? t.chat.pinnedMessages.hiddenOne
                                        : t.chat.pinnedMessages.hiddenMany,
                                    { count: held.hiddenCount }
                                )}
                            </Typography>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

type PinnedRowProps = {
    pin: MessagePin;
    archived: boolean;
    loading: boolean;
    onOpen: () => void;
    onUnpin: () => void;
};

const PinnedRow = ({ pin, archived, loading, onOpen, onUnpin }: PinnedRowProps) => {
    const textId = useId();
    const { t } = useTranslation();
    const { message } = pin;
    const sender = message.sender;
    const senderName = sender?.userName ?? "";
    return (
        <Box
            component="li"
            sx={{
                alignItems: "flex-start",
                borderBottom: "1px solid",
                borderColor: "divider",
                display: "flex",
                gap: 0.5,
            }}
        >
            <Box
                aria-busy={loading}
                component="button"
                type="button"
                sx={{
                    "&:hover": { backgroundColor: "background.level1" },
                    alignItems: "flex-start",
                    background: "transparent",
                    border: 0,
                    borderRadius: "sm",
                    color: "inherit",
                    cursor: "pointer",
                    display: "flex",
                    flex: 1,
                    font: "inherit",
                    gap: 1.25,
                    minWidth: 0,
                    p: 1,
                    textAlign: "start",
                    "&:focus-visible": { ...focusRing, outlineOffset: "-2px" },
                }}
                onClick={onOpen}
            >
                <UserAvatar
                    clickable={false}
                    fallbackName={senderName}
                    showPulseDot={false}
                    size={32}
                    userId={sender?.userId}
                />
                <Box id={textId} sx={{ flex: 1, minWidth: 0 }}>
                    <Box
                        sx={{
                            alignItems: "baseline",
                            columnGap: 1,
                            display: "flex",
                            flexWrap: "wrap",
                        }}
                    >
                        <Typography
                            level="title-sm"
                            sx={{ minWidth: 0, overflowWrap: "anywhere" }}
                        >
                            {senderName}
                        </Typography>
                        <Typography level="body-xs">
                            {extractYYYYMMDDHHMM(message.tsSent)}
                        </Typography>
                    </Box>
                    <Typography
                        level="body-sm"
                        sx={{
                            WebkitBoxOrient: "vertical",
                            WebkitLineClamp: 2,
                            color: "text.primary",
                            display: "-webkit-box",
                            overflow: "hidden",
                            overflowWrap: "anywhere",
                        }}
                    >
                        <EmojiText text={pinnedExcerpt(message)} />
                    </Typography>
                    <Typography level="body-xs">
                        {pin.pinnedBy
                            ? fmt(t.chat.pinnedMessages.pinnedBy, { name: pin.pinnedBy.username })
                            : t.chat.pinnedMessages.pinnedByDeleted}
                    </Typography>
                </Box>
                {loading && <Spinner size="xs" />}
            </Box>
            {!archived && (
                <AppTooltip title={t.chat.pinnedMessages.unpin}>
                    <IconButton
                        aria-describedby={textId}
                        aria-label={t.chat.pinnedMessages.unpin}
                        color="neutral"
                        size="sm"
                        sx={{ flexShrink: 0, mt: 1, ...touchTargetSx("&") }}
                        variant="plain"
                        onClick={onUnpin}
                    >
                        <CloseRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </AppTooltip>
            )}
        </Box>
    );
};
