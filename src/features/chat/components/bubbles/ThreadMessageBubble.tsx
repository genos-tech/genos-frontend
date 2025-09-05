import { useState, useEffect } from "react";
import { Box, Stack, Sheet } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BubbleUnderBar } from "./BubbleUnderBar";
import { BubbleAttachmentSheet } from "./BubbleAttachmentSheet";
import { BubbleUserName } from "./BubbleUserName";
import { BubbleThreadEditButton } from "./BubbleThreadEditButton";
import { ThreadMessageProps, ThreadProps } from "../../../../types/chat";
import { AvatarWithStatus } from "../../../../components/utils/avatarWithStatus";
import { extractHHMM, getCurrentTimestamp } from "../../../../utils/dateUtils";
import { BnChatPreview } from "../../../../components/blockNote/bnChatPreview";
import { UserProps } from "../../../../types/admin";
import { ReactionProps } from "../../../../types/common";
import { ChatProps } from "../../../../types/chat";
import { EmojiPicker } from "../../../../components/emojiInput/EmojiPicker";
import { EmojiReaction } from "../../../../components/emojiInput/EmojiReaction";

type threadMessageBubbleProps = {
    teamMemberStatus: Record<string, boolean>;
    myself: UserProps;
    socket: Socket | null;
    thread: ThreadProps;
    variant: "sent" | "received";
    message: ThreadMessageProps;
    isFocused: boolean;
    isSimpleBubble: boolean;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    setIsInEdit: (value: boolean) => void;
    setEditTargetMessage: (value: ThreadMessageProps) => void;
    currentMessageIndex: number;
    setTargetMessageIndex: (value: number) => void;
};

export const ThreadMessageBubble = (props: threadMessageBubbleProps) => {
    const {
        teamMemberStatus,
        myself,
        socket,
        thread,
        variant,
        message,
        isFocused,
        isSimpleBubble,
        setOpeningService,
        setCurrentMainChat,
        setIsInEdit,
        setEditTargetMessage,
        currentMessageIndex,
        setTargetMessageIndex,
    } = props;
    const isSent = variant === "sent";
    const dtSent = extractHHMM(message.tsSent);

    // Reaction handling
    const [showUnderBarOption, setShowUnderBarOption] = useState(false);
    const [reactions, setReactions] = useState<ReactionProps[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);
    const [uniqueReactionEmojiCount, setUniqueReactionEmojiCount] = useState<number>(0);
    useEffect(() => {
        if (message.reactions) {
            setReactions(message.reactions.allReactions);
        }
    }, []);

    useEffect(() => {
        if (message.reactions) {
            setReactions(message.reactions.allReactions);
        }
    }, [message]);

    useEffect(() => {
        if (selectedEmoji !== null) {
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
                        chat_type: thread.chatType,
                        chat_name: thread.chatName,
                        chat_id: message.chatId,
                        thread_id: message.threadId,
                        message_id: message.messageId,
                        message_body: message.content,
                        dm_partner_user_id:
                            message.sender.userId === myself.userId
                                ? thread.dmPartnerUser?.userId
                                : myself.userId,
                        is_thread_binary: 1,
                        reaction_emoji: selectedEmoji,
                        current_emojis: reactions,
                    });

                    // If the reaction is for the first message in the thread,
                    // delete the reaction from the parent message as well.
                    // But not doing this for PM thead.
                    if (message.messageId === 1 && thread.chatType !== 3) {
                        socket.emit("message_reaction", {
                            method_type: "DELETE",
                            team_id: myself.teamId,
                            chat_type: thread.chatType,
                            chat_name: thread.chatName,
                            chat_id: message.chatId,
                            thread_id: -1,
                            message_id: message.threadId,
                            message_body: message.content,
                            dm_partner_user_id:
                                message.sender.userId === myself.userId
                                    ? thread.dmPartnerUser?.userId
                                    : myself.userId,
                            is_thread_binary: 0,
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
                        tsSent: getCurrentTimestamp(),
                    },
                ]);
                if (socket) {
                    socket.emit("message_reaction", {
                        method_type: "POST",
                        team_id: myself.teamId,
                        chat_type: thread.chatType,
                        chat_name: thread.chatName,
                        chat_id: message.chatId,
                        thread_id: message.threadId,
                        message_id: message.messageId,
                        message_body: message.content,
                        dm_partner_user_id:
                            message.sender.userId === myself.userId
                                ? thread.dmPartnerUser?.userId
                                : myself.userId,
                        is_thread_binary: 1,
                        reaction_emoji: selectedEmoji,
                        current_emojis: reactions,
                    });

                    // Update the parent message as well if it's the first thread message
                    // But not doing this for PM thead.
                    if (message.messageId === 1 && thread.chatType !== 3) {
                        socket.emit("message_reaction", {
                            method_type: "POST",
                            team_id: myself.teamId,
                            chat_type: thread.chatType,
                            chat_name: thread.chatName,
                            chat_id: message.chatId,
                            thread_id: -1,
                            message_id: message.threadId,
                            message_body: message.content,
                            dm_partner_user_id:
                                message.sender.userId === myself.userId
                                    ? thread.dmPartnerUser?.userId
                                    : myself.userId,
                            is_thread_binary: 0,
                            reaction_emoji: selectedEmoji,
                            current_emojis: reactions,
                            send_activity: false,
                        });
                    }
                }
            }
            setSelectedEmoji(null);
        }
    }, [selectedEmoji]);

    return (
        <Box
            sx={{
                maxWidth: "90%",
                minWidth:
                    (isSimpleBubble ? 100 : 200) +
                    (uniqueReactionEmojiCount < 10 ? uniqueReactionEmojiCount * 20 : 310),
                whiteSpace: "normal",
                wordBreak: "break-word",
            }}
        >
            {message.attachment ? (
                <BubbleAttachmentSheet
                    fileName={message.attachment.fileName}
                    fileSize={message.attachment.size}
                    isSent={isSent}
                />
            ) : (
                <Box sx={{ position: "relative" }}>
                    <EmojiPicker
                        showEmojiPicker={showEmojiPicker}
                        setShowEmojiPicker={setShowEmojiPicker}
                        setSelectedEmoji={setSelectedEmoji}
                        pickerBottomPosition={10}
                        pickerRightPosition={isSent ? 0 : -40}
                    />
                    <Sheet
                        color={isSent ? "primary" : "neutral"}
                        variant={isSent ? "solid" : "soft"}
                        onMouseEnter={() => setShowUnderBarOption(true)}
                        onMouseLeave={() => setShowUnderBarOption(false)}
                        sx={[
                            {
                                p: 1,
                                borderRadius: "lg",
                            },
                            isSent
                                ? {
                                      borderTopRightRadius: 0,
                                  }
                                : {
                                      borderTopRightRadius: "lg",
                                  },
                            isSent
                                ? {
                                      borderTopLeftRadius: "lg",
                                  }
                                : {
                                      borderTopLeftRadius: 0,
                                  },
                            isSent
                                ? {
                                      backgroundColor: "neutral.plainColor",
                                  }
                                : {
                                      backgroundColor: "neutral.outlinedBorder",
                                  },
                            isFocused
                                ? {
                                      background: "#1cb15dff",
                                  }
                                : {
                                      background: "",
                                  },
                        ]}
                    >
                        <Stack direction="column" spacing={1.5}>
                            {showUnderBarOption === true && isSimpleBubble === true && (
                                <Stack direction="row" spacing={0}>
                                    <BubbleUserName
                                        isSimpleBubble={isSimpleBubble}
                                        sender={message.sender}
                                        chatType={thread.chatType}
                                        taskId={thread.taskId}
                                        taskStatus={null}
                                        userName={message.sender.userName}
                                        isSent={isSent}
                                        dtSent={dtSent}
                                        tsSent={message.tsSent}
                                        tsUpdated={message.tsUpdated}
                                        isThread={true}
                                    />

                                    <Box sx={{ textAlign: "right", pl: "10px" }}>
                                        <EmojiReaction
                                            socket={socket}
                                            myself={myself}
                                            chatType={thread.chatType}
                                            chatName={thread.chatName}
                                            dmPartnerUser={thread.dmPartnerUser}
                                            message={message}
                                            numReplies={0}
                                            isThread={true}
                                            showUnderBarOption={showUnderBarOption}
                                            reactions={reactions}
                                            setReactions={setReactions}
                                            setShowEmojiPicker={setShowEmojiPicker}
                                            setUniqueReactionEmojiCount={
                                                setUniqueReactionEmojiCount
                                            }
                                        />
                                    </Box>

                                    {/* 
                                        TODO: How to edit the first message in the thread?
                                        When we edit it, we also need to update the parent message.
                                        */}
                                    {message.sender.userId === myself.userId && (
                                        <BubbleThreadEditButton
                                            message={message}
                                            setIsInEdit={setIsInEdit}
                                            setEditTargetMessage={setEditTargetMessage}
                                            currentMessageIndex={currentMessageIndex}
                                            setTargetMessageIndex={setTargetMessageIndex}
                                        />
                                    )}
                                </Stack>
                            )}

                            {isSimpleBubble === false && (
                                <Stack direction="row" spacing={1.5}>
                                    {message.sender.isSystemUser !== true && (
                                        <Box sx={{ flex: 1 }}>
                                            <AvatarWithStatus
                                                myself={myself}
                                                avatarUser={isSent ? myself : message.sender}
                                                isOnline={
                                                    teamMemberStatus[
                                                        isSent
                                                            ? myself.userId
                                                            : message.sender.userId
                                                    ]
                                                }
                                                socket={socket}
                                                thread={thread}
                                                setOpeningService={setOpeningService}
                                                setCurrentMainChat={setCurrentMainChat}
                                            />
                                        </Box>
                                    )}
                                    <Box sx={{ flex: 20 }}>
                                        <Stack direction="row" spacing={2}>
                                            <BubbleUserName
                                                isSimpleBubble={isSimpleBubble}
                                                sender={message.sender}
                                                chatType={thread.chatType}
                                                taskId={thread.taskId}
                                                taskStatus={null}
                                                userName={message.sender.userName}
                                                isSent={isSent}
                                                dtSent={dtSent}
                                                tsSent={message.tsSent}
                                                tsUpdated={message.tsUpdated}
                                                isThread={true}
                                            />

                                            {showUnderBarOption === true && (
                                                <>
                                                    <Box sx={{ textAlign: "right", pl: "10px" }}>
                                                        <EmojiReaction
                                                            socket={socket}
                                                            myself={myself}
                                                            chatType={thread.chatType}
                                                            chatName={thread.chatName}
                                                            dmPartnerUser={thread.dmPartnerUser}
                                                            message={message}
                                                            numReplies={0}
                                                            isThread={true}
                                                            showUnderBarOption={showUnderBarOption}
                                                            reactions={reactions}
                                                            setReactions={setReactions}
                                                            setShowEmojiPicker={setShowEmojiPicker}
                                                            setUniqueReactionEmojiCount={
                                                                setUniqueReactionEmojiCount
                                                            }
                                                        />
                                                    </Box>
                                                    {message.sender.userId === myself.userId && (
                                                        <BubbleThreadEditButton
                                                            message={message}
                                                            setIsInEdit={setIsInEdit}
                                                            setEditTargetMessage={
                                                                setEditTargetMessage
                                                            }
                                                            currentMessageIndex={
                                                                currentMessageIndex
                                                            }
                                                            setTargetMessageIndex={
                                                                setTargetMessageIndex
                                                            }
                                                        />
                                                    )}
                                                </>
                                            )}
                                        </Stack>
                                    </Box>
                                </Stack>
                            )}

                            {message.content.length > 0 && (
                                <BnChatPreview
                                    teamMemberStatus={teamMemberStatus}
                                    myself={myself}
                                    socket={socket}
                                    key={`${thread.chatId}-${thread.threadId}-${message.messageId}-${thread.chatType}-${message.tsUpdated}`}
                                    content={message.content}
                                    isSent={isSent}
                                    setCurrentChat={setCurrentMainChat}
                                    setOpeningService={setOpeningService}
                                />
                            )}
                        </Stack>

                        <BubbleUnderBar
                            socket={socket}
                            myself={myself}
                            chatType={thread.chatType}
                            chatName={thread.chatName}
                            dmPartnerUser={thread.dmPartnerUser}
                            message={message}
                            numReplies={0}
                            isThread={true}
                            isSent={isSent}
                            showUnderBarOption={showUnderBarOption}
                            reactions={reactions}
                            setReactions={setReactions}
                            setUniqueReactionEmojiCount={setUniqueReactionEmojiCount}
                            setShowEmojiPicker={setShowEmojiPicker}
                        />
                    </Sheet>
                </Box>
            )}
        </Box>
    );
};
