import { useEffect, useState } from "react";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import { Box, Button, IconButton, Tooltip } from "@mui/joy";
import { Socket } from "socket.io-client";

import { UserProps } from "../../types/admin";
import { MessageProps, ThreadMessageProps } from "../../types/chat";
import { GroupedReactionProps, ReactionProps } from "../../types/common";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";

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
    const [baseEmojiList, setBaseEmojiList] = useState<string[]>(["👀", "👍", "✅"]);
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
                        send_activity: false,
                    });
                }
            }
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
                                    onClick={() => handleAddReaction(emoji)}
                                    variant="plain"
                                    size="sm"
                                    sx={{
                                        minWidth: "auto",
                                        paddingX: "4px",
                                        paddingY: "0",
                                        fontSize: "16px",
                                    }}
                                >
                                    {emoji}
                                </Button>
                            ))}
                        </>
                    )}
                    <Tooltip size="sm" title="React">
                        <IconButton
                            key={`emoji-icon-${message.messageId}`}
                            onClick={() => {
                                setShowEmojiPicker(true);
                            }}
                            variant="plain"
                            size="sm"
                            sx={{
                                minWidth: "auto",
                                paddingX: "4px",
                                paddingY: "0",
                                fontSize: "16px",
                                fontWeight: "bold",
                            }}
                        >
                            <SentimentSatisfiedAltIcon sx={{ fontSize: "24px" }} />
                        </IconButton>
                    </Tooltip>
                </>
            )}
        </Box>
    );
};
