import * as React from "react";
import { Box, Stack, Sheet } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BubbleAttachmentSheet } from "./BubbleAttachmentSheet";
import { BubbleUserName } from "./BubbleUserName";
import { BubbleThreadEditButton } from "./BubbleThreadEditButton";
import { ThreadMessageProps, ThreadProps } from "../../../../types/chat";
import { AvatarWithStatus } from "../../../../components/utils/avatarWithStatus";
import { extractHHMM } from "../../../../utils/dateUtils";
import { BnChatPreview } from "../../../../components/blockNote/bnChatPreview";
import { UserProps } from "../../../../types/admin";
import { ChatProps } from "../../../../types/chat";

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
    const [isLiked, setIsLiked] = React.useState<boolean>(false);
    const dtSent = extractHHMM(message.tsSent);

    return (
        <Box
            sx={{
                maxWidth: "90%",
                minWidth: "auto",
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
                                        {message.sender.isSystemUser !== true && (
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
                    </Sheet>
                </Box>
            )}
        </Box>
    );
};
