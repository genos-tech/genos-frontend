import { useEffect, useState } from "react";
import { Box, Chip } from "@mui/joy";
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
import { EmojiGlyph } from "./EmojiGlyph";

export const groupEmojis = (reactions: ReactionProps[]): GroupedReactionProps[] => {
    const map = new Map<string, { count: number; senders: UserProps[] }>();

    reactions.forEach(({ emoji, sender }) => {
        const entry = map.get(emoji);
        if (entry) {
            entry.count += 1;
            entry.senders.push(sender);
        } else {
            map.set(emoji, { count: 1, senders: [sender] });
        }
    });

    return Array.from(map.entries())
        .map(([emoji, { count, senders }]) => ({
            emoji,
            count,
            senders,
        }))
        .sort((a, b) => b.count - a.count);
};

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
        showUnderBarOption,
        reactions,
        setReactions,
        setShowEmojiPicker,
        setUniqueReactionEmojiCount,
    } = props;
    const { t } = useTranslation();
    const [baseEmojiList, setBaseEmojiList] = useState<string[]>(["👀", "👍", "✅"]);
    const [groupedReactions, setGroupedReactions] = useState<GroupedReactionProps[]>(
        groupEmojis(reactions)
    );
    const displayed = groupedReactions.slice(0, 10);
    const hidden = groupedReactions.slice(10);

    useEffect(() => {
        const groupedReactionEmojis: string[] = groupedReactions.map((item) => item.emoji);
        setBaseEmojiList(baseEmojiList.filter((emoji) => !groupedReactionEmojis.includes(emoji)));
    }, [groupedReactions, reactions]);

    useEffect(() => {
        const _groupedReactions = groupEmojis(reactions);
        setUniqueReactionEmojiCount(_groupedReactions.length);
    }, []);

    useEffect(() => {
        const _groupedReactions = groupEmojis(reactions);
        setUniqueReactionEmojiCount(_groupedReactions.length);
        setGroupedReactions(_groupedReactions);
    }, [reactions]);

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
        <Box display="flex">
            {displayed.map(({ senders, emoji, count }, index) => (
                <AppTooltip
                    key={`tooltip-${index}`}
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
                    <Chip
                        key={`emoji-chip-${emoji}-${index}`}
                        size="sm"
                        color={
                            senders.some((u) => u.userId === myself.userId) ? "success" : "neutral"
                        }
                        sx={{
                            fontSize: "0.9rem",
                            cursor: "pointer",
                            px: 0.5,
                            py: 0.5,
                            mx: 0.2,
                        }}
                        variant={
                            senders.some((u) => u.userId === myself.userId) ? "solid" : "outlined"
                        }
                        onClick={() => handleAddReaction(emoji)}
                    >
                        <EmojiGlyph emoji={emoji} />
                        {count}
                    </Chip>
                </AppTooltip>
            ))}

            {hidden.length > 0 && (
                <AppTooltip
                    size="sm"
                    title={hidden.map(({ emoji, count }) => `${emoji} ${count}`).join(" ")}
                >
                    <Chip size="sm" sx={{ fontSize: "0.8rem" }} variant="plain">
                        {fmt(t.common.ui.emoji.moreLabel, { count: hidden.length })}
                    </Chip>
                </AppTooltip>
            )}
        </Box>
    );
};
