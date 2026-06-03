import { useEffect, useState } from "react";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import { Box, Button, IconButton, useColorScheme } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useTranslation } from "../../../i18n";
import { channelService } from "../../../services/channel/channelService";
import { UserProps } from "../../../types/admin";
import { ChannelKind } from "../../../types/channel";
import { MessageProps, ThreadMessageProps } from "../../../types/chat";
import { GroupedReactionProps, ReactionProps } from "../../../types/common";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { AppTooltip } from "../AppTooltip";

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

type EmojiReactionProps = {
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
export const EmojiReaction = (props: EmojiReactionProps) => {
    const {
        socket,
        myself,
        chatType,
        chatName,
        isThread,
        numReplies,
        dmPartnerUser,
        message,
        showUnderBarOption,
        reactions,
        setReactions,
        setShowEmojiPicker,
        setUniqueReactionEmojiCount,
    } = props;
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const [baseEmojiList, setBaseEmojiList] = useState<string[]>(["👍", "👀", "✅"]);
    const [groupedReactions, setGroupedReactions] = useState<GroupedReactionProps[]>(
        groupEmojis(reactions)
    );

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
        // v3 cutover. The legacy multi-emit `message_reaction` path
        // (one for the bubble, one for the "first thread message"
        // mirror at messageId === 1, one for the thread-reply count
        // broadcast at numReplies > 0) collapses to a single
        // `channelService.react / .unreact` call. The v3 backend's
        // `reaction.added` / `reaction.removed` broadcast covers
        // every visible surface (main pane, thread panel, bubble
        // counts) off a single Message row, so no mirroring needed.
        //
        // Works for both top-level and thread reactions — top-level
        // messages carry `messageIdWithChatId` (set by
        // `v3MessageToLegacy`), thread replies carry
        // `messageIdWithChatIdAndThreadId` (set by
        // `v3ThreadMessageToLegacy`). Both fields hold the v3 UUID.
        const v3MessageId = isThread
            ? (message as ThreadMessageProps).messageIdWithChatIdAndThreadId
            : (message as MessageProps).messageIdWithChatId;
        if (v3MessageId) {
            const v3ChannelId = (message as MessageProps | ThreadMessageProps)
                .chatId as unknown as string;
            const channelKind = chatType as ChannelKind;
            const existingIndex = reactions.findIndex(
                (r) => r.emoji === selectedEmoji && r.sender.userId === myself.userId
            );
            if (existingIndex !== -1) {
                setReactions(reactions.filter((_, idx) => idx !== existingIndex));
                void channelService
                    .unreact(v3MessageId, v3ChannelId, channelKind, selectedEmoji)
                    .catch((e) => console.error("[EmojiReaction] unreact failed:", e));
            } else {
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
                    .catch((e) => console.error("[EmojiReaction] react failed:", e));
            }
            return;
        }
    };

    return (
        <Box display="flex">
            {showUnderBarOption && (
                <>
                    {groupedReactions.length < 3 && (
                        <>
                            {baseEmojiList.map((emoji, index) => (
                                <Button
                                    key={`default-emoji-${index}`}
                                    size="sm"
                                    variant="plain"
                                    sx={{
                                        minWidth: "auto",
                                        paddingX: "4px",
                                        paddingY: "0",
                                        fontSize: "16px",
                                        "&:hover": {
                                            backgroundColor: isDark ? "#3730a3" : "#e0e7ff",
                                        },
                                    }}
                                    onClick={() => handleAddReaction(emoji)}
                                >
                                    {emoji}
                                </Button>
                            ))}
                        </>
                    )}
                    <AppTooltip size="sm" title={t.common.ui.emoji.reaction}>
                        <IconButton
                            key={`emoji-icon-${message.messageId}`}
                            size="sm"
                            variant="plain"
                            sx={{
                                minWidth: "auto",
                                paddingX: "4px",
                                paddingY: "0",
                                fontSize: "16px",
                                fontWeight: "bold",
                                "&:hover": {
                                    backgroundColor: isDark ? "#3730a3" : "#e0e7ff",
                                },
                            }}
                            onClick={() => {
                                setShowEmojiPicker(true);
                            }}
                        >
                            <SentimentSatisfiedAltIcon sx={{ fontSize: "24px" }} />
                        </IconButton>
                    </AppTooltip>
                </>
            )}
        </Box>
    );
};
