import { useState, useEffect } from "react";
import { Box, Stack, Sheet } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BubbleUnderBar } from "./BubbleUnderBar";
import { BubbleAttachmentSheet } from "./BubbleAttachmentSheet";
import { BubbleUserName } from "./BubbleUserName";
import { BubbleThreadEditButton } from "./BubbleThreadEditButton";
import { ThreadMessageProps, ThreadProps } from "../../../../types/chat";
import { AvatarWithStatus } from "../../../../components/utils/avatarWithStatus";
import { extractHHMM } from "../../../../utils/dateUtils";
import { BnChatPreview } from "../../../../components/blockNote/bnChatPreview";
import { UserProps } from "../../../../types/admin";
import { ReactionProps } from "../../../../types/common";
import { ChatProps } from "../../../../types/chat";
import { EmojiPicker } from "../../../../components/emojiInput/EmojiPicker";

type threadMessageBubbleProps = {
    myself: UserProps;
    socket: Socket | null;
    thread: ThreadProps;
    variant: "sent" | "received";
    message: ThreadMessageProps;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    setIsInEdit: (value: boolean) => void;
    setEditTargetMessage: (value: ThreadMessageProps) => void;
    currentMessageIndex: number;
    setTargetMessageIndex: (value: number) => void;
};

export const ThreadMessageBubble = (props: threadMessageBubbleProps) => {
    const {
        myself,
        socket,
        thread,
        variant,
        message,
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
            setReactions([...reactions, selectedEmoji]);
            setSelectedEmoji(null);
        }
    }, [selectedEmoji]);

    return (
        <Box
            sx={{
                maxWidth: "90%",
                minWidth:
                    250 + (uniqueReactionEmojiCount < 10 ? uniqueReactionEmojiCount * 20 : 310),
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
                        pickerRightPosition={0}
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
                        ]}
                    >
                        <Stack direction="column" spacing={1.5}>
                            <Stack direction="row" spacing={1.5}>
                                {message.sender.isSystemUser !== true && (
                                    <Box sx={{ flex: 1 }}>
                                        <AvatarWithStatus
                                            userProfile={isSent ? myself : message.sender}
                                            socket={socket}
                                            thread={thread}
                                            online={message.sender.online}
                                            setOpeningService={setOpeningService}
                                            setCurrentMainChat={setCurrentMainChat}
                                        />
                                    </Box>
                                )}
                                <Box sx={{ flex: 20 }}>
                                    <Stack direction="row" spacing={2}>
                                        <BubbleUserName
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
                                </Box>
                            </Stack>

                            {message.content.length > 0 && (
                                <BnChatPreview
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
