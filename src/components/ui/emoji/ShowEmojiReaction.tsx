import { useEffect, useState } from "react";
import { Box, Chip } from "@mui/joy";
import { Socket } from "socket.io-client";

import { fmt, useTranslation } from "../../../i18n";
import { UserProps } from "../../../types/admin";
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
        // Backend's reaction handler skips its 8-way Django refetch when this
        // is present (see backend/socketio_events/message_reaction_handlers.py).
        const emptyUser = {
            userName: "",
            userId: "",
            avatarImgPath: "",
            tsLastSeen: "",
            tsJoined: "",
            customStatus: "",
        };
        const messageSnapshot = {
            sender: message.sender,
            receiver:
                chatType === 1
                    ? message.sender.userId === myself.userId
                        ? dmPartnerUser
                        : myself
                    : emptyUser,
            dmPartnerUser: chatType === 1 ? dmPartnerUser : emptyUser,
            taskId: message.taskId,
            content: message.content,
            tsSent: message.tsSent,
            tsUpdated: message.tsUpdated,
        };

        const existingIndex = reactions.findIndex(
            (r) => r.emoji === selectedEmoji && r.sender.userId === myself.userId
        );
        if (existingIndex !== -1) {
            // Emoji already exists, remove it
            const updatedReactions = reactions.filter((_, idx) => idx !== existingIndex);
            setReactions(updatedReactions);
            if (socket) {
                socket.emit("message_reaction", {
                    method_type: "DELETE",
                    team_id: myself.teamId,
                    chat_type: chatType,
                    chat_name: chatName,
                    chat_id: message.chatId,
                    thread_id: isThread === true ? message.threadId : message.messageId || 0,
                    message_id: message.messageId,
                    message_body: message.content,
                    message_sender: message.sender,
                    dm_partner_user_id:
                        message.sender.userId === myself.userId
                            ? dmPartnerUser.userId
                            : myself.userId,
                    is_thread_binary: isThread === true ? 1 : 0,
                    reaction_emoji: selectedEmoji,
                    current_emojis: reactions,
                    messageSnapshot,
                });

                // If the reaction is for the first message in the thread,
                // delete the reaction from the parent message as well
                if (isThread === true && message.messageId === 1 && chatType !== 3) {
                    socket.emit("message_reaction", {
                        method_type: "DELETE",
                        team_id: myself.teamId,
                        chat_type: chatType,
                        chat_name: chatName,
                        chat_id: message.chatId,
                        thread_id: message.threadId,
                        message_id: message.threadId,
                        message_body: message.content,
                        message_sender: message.sender,
                        dm_partner_user_id:
                            message.sender.userId === myself.userId
                                ? dmPartnerUser.userId
                                : myself.userId,
                        is_thread_binary: 0,
                        reaction_emoji: selectedEmoji,
                        current_emojis: reactions,
                        messageSnapshot,
                    });
                }

                // Update the first thread message as well
                // But not doing this for PM thead.
                if (isThread === false && numReplies > 0 && chatType !== 3) {
                    socket.emit("message_reaction", {
                        method_type: "DELETE",
                        team_id: myself.teamId,
                        chat_type: chatType,
                        chat_name: chatName,
                        chat_id: message.chatId,
                        thread_id: message.messageId,
                        message_id: 1,
                        message_body: message.content,
                        message_sender: message.sender,
                        dm_partner_user_id:
                            message.sender.userId === myself.userId
                                ? dmPartnerUser.userId
                                : myself.userId,
                        is_thread_binary: 1,
                        reaction_emoji: selectedEmoji,
                        current_emojis: reactions,
                        messageSnapshot,
                    });
                }
            }
        } else {
            // Emoji not in reactions, add it
            setReactions([
                ...reactions,
                {
                    id: -1,
                    emoji: selectedEmoji,
                    sender: myself,
                    tsSent: getLocalCurrentTimestamp(),
                },
            ]);
            if (socket) {
                socket.emit("message_reaction", {
                    method_type: "POST",
                    team_id: myself.teamId,
                    chat_type: chatType,
                    chat_name: chatName,
                    chat_id: message.chatId,
                    thread_id: isThread === true ? message.threadId : message.messageId || 0,
                    message_id: message.messageId,
                    message_body: message.content,
                    message_sender: message.sender,
                    dm_partner_user_id:
                        message.sender.userId === myself.userId
                            ? dmPartnerUser.userId
                            : myself.userId,
                    is_thread_binary: isThread === true ? 1 : 0,
                    reaction_emoji: selectedEmoji,
                    current_emojis: reactions,
                    messageSnapshot,
                });

                // Update the parent message as well if it's the first thread message
                if (isThread === true && message.messageId === 1 && chatType !== 3) {
                    socket.emit("message_reaction", {
                        method_type: "POST",
                        team_id: myself.teamId,
                        chat_type: chatType,
                        chat_name: chatName,
                        chat_id: message.chatId,
                        thread_id: message.threadId,
                        message_id: message.threadId,
                        message_body: message.content,
                        message_sender: message.sender,
                        dm_partner_user_id:
                            message.sender.userId === myself.userId
                                ? dmPartnerUser.userId
                                : myself.userId,
                        is_thread_binary: 0,
                        reaction_emoji: selectedEmoji,
                        current_emojis: reactions,
                        messageSnapshot,
                        send_activity: false,
                    });
                }

                // Update the first thread message as well
                if (isThread === false && chatType !== 3 && numReplies > 0) {
                    socket.emit("message_reaction", {
                        method_type: "POST",
                        team_id: myself.teamId,
                        chat_type: chatType,
                        chat_name: chatName,
                        chat_id: message.chatId,
                        thread_id: message.messageId,
                        message_body: message.content,
                        message_sender: message.sender,
                        message_id: 1,
                        dm_partner_user_id:
                            message.sender.userId === myself.userId
                                ? dmPartnerUser.userId
                                : myself.userId,
                        is_thread_binary: 1,
                        reaction_emoji: selectedEmoji,
                        current_emojis: reactions,
                        messageSnapshot,
                        send_activity: false,
                    });
                }
            }
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
                        {emoji}
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
