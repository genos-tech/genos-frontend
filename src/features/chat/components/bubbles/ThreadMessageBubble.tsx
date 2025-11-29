import { useEffect, useRef, useState } from "react";
import { Box, Sheet, Stack } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnChatPreview } from "../../../../components/editors/bnChatPreview";
import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { EmojiPicker } from "../../../../components/ui/emoji/EmojiPicker";
import { EmojiReaction } from "../../../../components/ui/emoji/EmojiReaction";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import {
    ChatProps,
    FlaggedMessageProps,
    ThreadMessageProps,
    ThreadProps,
} from "../../../../types/chat";
import { ReactionProps } from "../../../../types/common";
import { extractYYYYMMDDHHMM, getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
import { BubbleAttachmentSheet } from "./BubbleAttachmentSheet";
import { BubbleDeleteButton } from "./BubbleDeleteButton";
import { BubbleFlagButton } from "./BubbleFlagButton";
import { BubbleThreadEditButton } from "./BubbleThreadEditButton";
import { BubbleUnderBar } from "./BubbleUnderBar";
import { BubbleUserName } from "./BubbleUserName";

type threadMessageBubbleProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    thread: ThreadProps;
    variant: "sent" | "received";
    message: ThreadMessageProps;
    isScrolling: boolean;
    isFocused: boolean;
    isSimpleBubble: boolean;
    useUISM: UIStateManagementState;
    setIsInEdit: (value: boolean) => void;
    setEditTargetMessage: (value: ThreadMessageProps) => void;
    currentMessageIndex: number;
    setTargetMessageIndex: (value: number) => void;
    useCM: ChatManagementState;
};

export const ThreadMessageBubble = (props: threadMessageBubbleProps) => {
    const {
        useTEM,
        myself,
        setMyself,
        socket,
        thread,
        variant,
        message,
        isScrolling,
        isFocused,
        isSimpleBubble,
        useUISM,
        setIsInEdit,
        setEditTargetMessage,
        currentMessageIndex,
        setTargetMessageIndex,
        useCM,
    } = props;

    const { accessToken } = useAuth();
    const isSent = variant === "sent";
    const dtSent = extractYYYYMMDDHHMM(message.tsSent);

    // Reaction handling
    const [showUnderBarOption, setShowUnderBarOption] = useState(false);
    const [reactions, setReactions] = useState<ReactionProps[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);
    const [uniqueReactionEmojiCount, setUniqueReactionEmojiCount] = useState<number>(0);

    // Dynamic positioning for emoji picker
    const bubbleRef = useRef<HTMLDivElement>(null);
    const [pickerBottomPosition, setPickerBottomPosition] = useState<number>(40);
    const [pickerRightPosition, setPickerRightPosition] = useState<number | string>(
        isSent ? 0 : "auto"
    );
    const [pickerLeftPosition, setPickerLeftPosition] = useState<number | string>(
        isSent ? "auto" : 0
    );
    const [emojiPickerPositionCalculated, setEmojiPickerPositionCalculated] =
        useState<boolean>(false);
    useEffect(() => {
        if (showEmojiPicker && bubbleRef.current) {
            const rect = bubbleRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const pickerHeight = 435; // Approximate height of emoji picker
            const pickerWidth = 352; // Approximate width of emoji picker

            // Calculate vertical position
            // If there's enough space above, show picker above the bubble
            // Otherwise show below
            if (rect.top > pickerHeight + 20) {
                // Show above the bubble
                setPickerBottomPosition(40);
            } else if (viewportHeight - rect.bottom > pickerHeight + 20) {
                // Show below the bubble
                setPickerBottomPosition(-pickerHeight - 20);
            } else {
                // Default to above with scroll adjustment
                setPickerBottomPosition(40);
            }

            // Calculate horizontal position based on sent/received
            if (isSent) {
                // For sent messages (right side), align to right edge
                setPickerRightPosition(0);
                setPickerLeftPosition("auto");
            } else {
                // For received messages (left side), align to left edge
                setPickerLeftPosition(0);
                setPickerRightPosition("auto");
            }
            setEmojiPickerPositionCalculated(true);
        }
        if (showEmojiPicker === false) {
            setEmojiPickerPositionCalculated(false);
        }
    }, [showEmojiPicker, isSent]);

    useEffect(() => {
        if (message.reactions) {
            setReactions(message.reactions);
        }
    }, []);

    useEffect(() => {
        if (message.reactions) {
            setReactions(message.reactions);
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
                        message_sender: message.sender,
                        dm_partner_user_id:
                            message.sender.userId === myself.userId
                                ? thread.dmPartnerUser.userId
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
                            thread_id: 0,
                            message_id: message.threadId,
                            message_body: message.content,
                            message_sender: message.sender,
                            dm_partner_user_id:
                                message.sender.userId === myself.userId
                                    ? thread.dmPartnerUser.userId
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
                        tsSent: getLocalCurrentTimestamp(),
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
                        message_sender: message.sender,
                        dm_partner_user_id:
                            message.sender.userId === myself.userId
                                ? thread.dmPartnerUser.userId
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
                            thread_id: 0,
                            message_id: message.threadId,
                            message_body: message.content,
                            message_sender: message.sender,
                            dm_partner_user_id:
                                message.sender.userId === myself.userId
                                    ? thread.dmPartnerUser.userId
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
                <Box ref={bubbleRef} sx={{ position: "relative" }}>
                    {emojiPickerPositionCalculated === true && (
                        <EmojiPicker
                            pickerBottomPosition={pickerBottomPosition}
                            pickerLeftPosition={pickerLeftPosition}
                            pickerRightPosition={pickerRightPosition}
                            setSelectedEmoji={setSelectedEmoji}
                            setShowEmojiPicker={setShowEmojiPicker}
                            showEmojiPicker={showEmojiPicker}
                        />
                    )}
                    <Sheet
                        color={isSent ? "primary" : "neutral"}
                        variant={isSent ? "solid" : "soft"}
                        sx={[
                            {
                                p: 1,
                                borderRadius: "lg",
                            },
                            isSent
                                ? {
                                      borderTopRightRadius: 0,
                                      borderTopLeftRadius: "lg",
                                      backgroundColor: "neutral.plainColor",
                                  }
                                : {
                                      borderTopRightRadius: "lg",
                                      borderTopLeftRadius: 0,
                                      backgroundColor: "neutral.outlinedBorder",
                                  },
                            isFocused
                                ? {
                                      background: "#24c165d0",
                                  }
                                : {
                                      background: "",
                                  },
                        ]}
                        onMouseEnter={() => setShowUnderBarOption(true)}
                        onMouseLeave={() => setShowUnderBarOption(false)}
                    >
                        <Stack direction="column">
                            {showUnderBarOption === true && isSimpleBubble === true && (
                                <Stack direction="row" spacing={0}>
                                    <BubbleUserName
                                        chatType={thread.chatType}
                                        dtSent={dtSent}
                                        isSent={isSent}
                                        isSimpleBubble={isSimpleBubble}
                                        isThread={true}
                                        sender={message.sender}
                                        taskId={thread.taskId}
                                        taskStatus={null}
                                        tsSent={message.tsSent}
                                        tsUpdated={message.tsUpdated}
                                        userName={message.sender.userName}
                                    />

                                    <Box sx={{ textAlign: "right", pl: "10px" }}>
                                        {isScrolling !== true && (
                                            <EmojiReaction
                                                chatName={thread.chatName}
                                                chatType={thread.chatType}
                                                dmPartnerUser={thread.dmPartnerUser}
                                                isThread={true}
                                                message={message}
                                                myself={myself}
                                                numReplies={0}
                                                reactions={reactions}
                                                setReactions={setReactions}
                                                setShowEmojiPicker={setShowEmojiPicker}
                                                showUnderBarOption={showUnderBarOption}
                                                socket={socket}
                                                setUniqueReactionEmojiCount={
                                                    setUniqueReactionEmojiCount
                                                }
                                            />
                                        )}
                                    </Box>

                                    <BubbleFlagButton
                                        accessToken={accessToken}
                                        currentThreadChat={thread}
                                        flaggedMessages={useCM.flaggedMessages}
                                        message={message}
                                        myself={myself}
                                        setCurrentThreadChat={useCM.setCurrentThreadChat}
                                        setFlaggedMessages={useCM.setFlaggedMessages}
                                        threadId={thread.threadId}
                                    />

                                    {/* 
                                        TODO: How to edit the first message in the thread?
                                        When we edit it, we also need to update the parent message.
                                        */}
                                    {message.sender.userId === myself.userId && (
                                        <BubbleThreadEditButton
                                            currentMessageIndex={currentMessageIndex}
                                            message={message}
                                            setEditTargetMessage={setEditTargetMessage}
                                            setIsInEdit={setIsInEdit}
                                            setTargetMessageIndex={setTargetMessageIndex}
                                        />
                                    )}

                                    {message.messageId !== 1 &&
                                        message.sender.userId === myself.userId && (
                                            <BubbleDeleteButton
                                                accessToken={accessToken}
                                                currentThreadChat={thread}
                                                isThread={true}
                                                message={message}
                                                setCurrentThreadChat={useCM.setCurrentThreadChat}
                                                socket={socket}
                                            />
                                        )}
                                </Stack>
                            )}

                            {isSimpleBubble === false && (
                                <Stack direction="row" spacing={1.5}>
                                    {message.sender.isSystemUser !== true && (
                                        <Box sx={{ flex: 1 }}>
                                            <AvatarWithStatus
                                                useCM={useCM}
                                                isForBubble={true}
                                                isYou={isSent}
                                                myself={myself}
                                                setMyself={setMyself}
                                                socket={socket}
                                                thread={thread}
                                                useUISM={useUISM}
                                                avatarUser={
                                                    isSent
                                                        ? useTEM.teamMemberProfiles[myself.userId]
                                                        : useTEM.teamMemberProfiles[
                                                              message.sender.userId
                                                          ]
                                                }
                                            />
                                        </Box>
                                    )}
                                    <Box sx={{ flex: 20 }}>
                                        <Stack direction="row">
                                            <BubbleUserName
                                                chatType={thread.chatType}
                                                dtSent={dtSent}
                                                isSent={isSent}
                                                isSimpleBubble={isSimpleBubble}
                                                isThread={true}
                                                sender={message.sender}
                                                taskId={thread.taskId}
                                                taskStatus={null}
                                                tsSent={message.tsSent}
                                                tsUpdated={message.tsUpdated}
                                                userName={message.sender.userName}
                                            />

                                            {showUnderBarOption === true && (
                                                <>
                                                    <Box sx={{ textAlign: "right", pl: "10px" }}>
                                                        {isScrolling !== true && (
                                                            <EmojiReaction
                                                                chatName={thread.chatName}
                                                                chatType={thread.chatType}
                                                                isThread={true}
                                                                message={message}
                                                                myself={myself}
                                                                numReplies={0}
                                                                reactions={reactions}
                                                                setReactions={setReactions}
                                                                socket={socket}
                                                                dmPartnerUser={
                                                                    thread.dmPartnerUser
                                                                }
                                                                setShowEmojiPicker={
                                                                    setShowEmojiPicker
                                                                }
                                                                setUniqueReactionEmojiCount={
                                                                    setUniqueReactionEmojiCount
                                                                }
                                                                showUnderBarOption={
                                                                    showUnderBarOption
                                                                }
                                                            />
                                                        )}
                                                    </Box>

                                                    <BubbleFlagButton
                                                        accessToken={accessToken}
                                                        currentThreadChat={thread}
                                                        flaggedMessages={useCM.flaggedMessages}
                                                        message={message}
                                                        myself={myself}
                                                        setFlaggedMessages={
                                                            useCM.setFlaggedMessages
                                                        }
                                                        threadId={thread.threadId}
                                                        setCurrentThreadChat={
                                                            useCM.setCurrentThreadChat
                                                        }
                                                    />

                                                    {message.sender.userId === myself.userId && (
                                                        <BubbleThreadEditButton
                                                            message={message}
                                                            setIsInEdit={setIsInEdit}
                                                            currentMessageIndex={
                                                                currentMessageIndex
                                                            }
                                                            setEditTargetMessage={
                                                                setEditTargetMessage
                                                            }
                                                            setTargetMessageIndex={
                                                                setTargetMessageIndex
                                                            }
                                                        />
                                                    )}

                                                    {message.messageId !== 1 &&
                                                        message.sender.userId ===
                                                            myself.userId && (
                                                            <BubbleDeleteButton
                                                                accessToken={accessToken}
                                                                currentThreadChat={thread}
                                                                isThread={true}
                                                                message={message}
                                                                socket={socket}
                                                                setCurrentThreadChat={
                                                                    useCM.setCurrentThreadChat
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
                                    key={`${thread.chatId}-${thread.threadId}-${message.messageId}-${thread.chatType}-${message.tsUpdated}`}
                                    useCM={useCM}
                                    content={message.content}
                                    isSent={isSent}
                                    myself={myself}
                                    setMyself={setMyself}
                                    socket={socket}
                                    useTEM={useTEM}
                                    useUISM={useUISM}
                                />
                            )}
                        </Stack>

                        <BubbleUnderBar
                            chatName={thread.chatName}
                            chatType={thread.chatType}
                            dmPartnerUser={thread.dmPartnerUser}
                            isThread={true}
                            message={message}
                            myself={myself}
                            numReplies={0}
                            reactions={reactions}
                            setReactions={setReactions}
                            setShowEmojiPicker={setShowEmojiPicker}
                            setUniqueReactionEmojiCount={setUniqueReactionEmojiCount}
                            showUnderBarOption={showUnderBarOption}
                            socket={socket}
                        />
                    </Sheet>
                </Box>
            )}
        </Box>
    );
};
