import { useEffect, useState } from "react";
import { Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { fmt, useTranslation } from "../../../i18n";
import { channelService } from "../../../services/channel/channelService";
import { notifyActionError } from "../../../services/requestErrorNotifier";
import { UserProps } from "../../../types/admin";
import { ChannelKind } from "../../../types/channel";
import { MessageProps, ThreadMessageProps } from "../../../types/chat";
import { GroupedReactionProps, ReactionProps } from "../../../types/common";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { AppTooltip } from "../AppTooltip";
import { MoreReactionsChip, ReactionChip } from "./ReactionChip";
import { groupEmojis } from "./showEmojiReactionHelpers";

type ShowEmojiReactionProps = {
    socket: Socket | null;
    myself: UserProps;
    chatType: number;
    chatName: string;
    isThread: boolean;
    numReplies: number;
    dmPartnerUser: UserProps;
    message: MessageProps | ThreadMessageProps;
    showUnderBarOption: boolean;
    reactions: ReactionProps[];
    setReactions: (value: ReactionProps[]) => void;
    setShowEmojiPicker: (value: boolean) => void;
    setUniqueReactionEmojiCount: (value: number) => void;
};
export const ShowEmojiReaction = (props: ShowEmojiReactionProps) => {
    const {
        myself,
        chatType,
        isThread,
        message,
        reactions,
        setReactions,
        setUniqueReactionEmojiCount,
    } = props;
    const { t } = useTranslation();
    // This component renders reaction CHIPS only. It used to also carry a
    // `baseEmojiList` quick-pick state (+ a filter effect), but the JSX
    // never rendered it — the quick-pick row lives in `EmojiReaction`,
    // which the bubbles mount alongside this. Removed rather than wired to
    // the quick-reactions preference, so there's exactly one place drawing
    // that row.
    const [groupedReactions, setGroupedReactions] = useState<GroupedReactionProps[]>(
        groupEmojis(reactions)
    );
    const displayed = groupedReactions.slice(0, 10);
    const hidden = groupedReactions.slice(10);

    useEffect(() => {
        const _groupedReactions = groupEmojis(reactions);
        setUniqueReactionEmojiCount(_groupedReactions.length);
        setGroupedReactions(_groupedReactions);
    }, [reactions, setUniqueReactionEmojiCount]);

    const handleAddReaction = (selectedEmoji: string) => {
        // v3 cutover. The legacy multi-emit `message_reaction` path (one
        // for the bubble, one for the "first thread message" mirror at
        // messageId === 1, one for the thread-reply-count broadcast at
        // numReplies > 0) collapses to a single `channelService.react /
        // .unreact` call — the same migration `EmojiReaction` already made.
        // The legacy `"message_reaction"` socket event lost its Flask
        // handler in the v3 migration, so every emit here was silently
        // dropped: a chip toggle updated optimistically then reverted on
        // the next delta sync and never reached other viewers. The v3
        // backend's `reaction.added` / `reaction.removed` broadcast now
        // patches every visible surface (main pane, thread panel, bubble
        // counts) off one Message row, so no mirroring is needed.
        //
        // Top-level messages carry `messageIdWithChatId`; thread replies
        // carry `messageIdWithChatIdAndThreadId` — both hold the v3 UUID.
        const v3MessageId = isThread
            ? (message as ThreadMessageProps).messageIdWithChatIdAndThreadId
            : (message as MessageProps).messageIdWithChatId;
        if (!v3MessageId) return;
        const v3ChannelId = (message as MessageProps | ThreadMessageProps)
            .chatId as unknown as string;
        const channelKind = chatType as ChannelKind;
        const existingIndex = reactions.findIndex(
            (r) => r.emoji === selectedEmoji && r.sender.userId === myself.userId
        );
        if (existingIndex !== -1) {
            // Optimistic remove — the server's `reaction.removed` broadcast converges.
            setReactions(reactions.filter((_, idx) => idx !== existingIndex));
            void channelService
                .unreact(v3MessageId, v3ChannelId, channelKind, selectedEmoji)
                .catch((e) => console.error("[ShowEmojiReaction] unreact failed:", e));
        } else {
            // Optimistic add; the fabricated `id: -1` is replaced by the broadcast row.
            setReactions([
                ...reactions,
                {
                    id: -1,
                    emoji: selectedEmoji,
                    sender: myself,
                    tsSent: getLocalCurrentTimestamp(),
                },
            ]);
            void channelService
                .react(v3MessageId, v3ChannelId, channelKind, selectedEmoji)
                .catch((e) => {
                    console.error("[ShowEmojiReaction] react failed:", e);
                    notifyActionError(e);
                });
        }
    };

    return (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
            {displayed.map(({ senders, emoji, count }) => (
                <AppTooltip
                    key={`emoji-chip-${emoji}`}
                    title={fmt(
                        senders.length > 5
                            ? t.common.ui.emoji.multipleReacted
                            : t.common.ui.emoji.singleReacted,
                        {
                            names: senders
                                .slice(0, 5)
                                .map((sender) => `${sender.userName} `)
                                .join(" and "),
                        }
                    )}
                >
                    <ReactionChip
                        count={count}
                        emoji={emoji}
                        mine={senders.some((u) => u.userId === myself.userId)}
                        onClick={() => handleAddReaction(emoji)}
                    />
                </AppTooltip>
            ))}

            {hidden.length > 0 && (
                <AppTooltip
                    size="sm"
                    title={hidden.map(({ emoji, count }) => `${emoji} ${count}`).join(" ")}
                >
                    <MoreReactionsChip
                        text={fmt(t.common.ui.emoji.moreLabel, { count: hidden.length })}
                    />
                </AppTooltip>
            )}
        </Box>
    );
};
