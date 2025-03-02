import React from "react";
import { Box, IconButton } from "@mui/joy";
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import CallIcon from '@mui/icons-material/Call';
import Tooltip from '@mui/joy/Tooltip';
import SendIcon from '@mui/icons-material/Send';
import Stack from '@mui/joy/Stack';
import { Socket } from "socket.io-client";
import { UserProps, ChatProps, AllChatProps } from '../../types'
import InsertDMChatWorker from "../../workers/insertDMChatWorker.ts?worker";
import InsertDMMessageWorker from "../../workers/insertDMMessageWorker.ts?worker";
import InsertGMChatWorker from "../../workers/insertGMChatWorker.ts?worker";
import InsertGMMessageWorker from "../../workers/insertGMMessageWorker.ts?worker";

function getCurrentTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}


const insertDMChatAndMessage = async (newDMChat: AllChatProps): Promise<string> => {
    return new Promise((resolve, reject) => {
        const insertDMMessageWorker = new InsertDMMessageWorker();
        insertDMMessageWorker.postMessage({ dmMessage: newDMChat.latestMessage });
        insertDMMessageWorker.onmessage = (event) => {
            resolve(event.data);
            insertDMMessageWorker.terminate();
        };
        insertDMMessageWorker.onerror = (error) => {
            reject(error);
            insertDMMessageWorker.terminate();
        };

        const insertDMChatWorker = new InsertDMChatWorker();
        insertDMChatWorker.postMessage({ dmChat: newDMChat });
        insertDMChatWorker.onmessage = (event) => {
            resolve(event.data);
            insertDMChatWorker.terminate();
        };
        insertDMChatWorker.onerror = (error) => {
            reject(error);
            insertDMChatWorker.terminate();
        };
    });
};

const insertGMChatAndMessage = async (newGMChat: AllChatProps): Promise<string> => {
    return new Promise((resolve, reject) => {
        const insertGMMessageWorker = new InsertGMMessageWorker();
        insertGMMessageWorker.postMessage({ gmMessage: newGMChat.latestMessage });
        insertGMMessageWorker.onmessage = (event) => {
            resolve(event.data);
            insertGMMessageWorker.terminate();
        };
        insertGMMessageWorker.onerror = (error) => {
            reject(error);
            insertGMMessageWorker.terminate();
        };

        const insertGMChatWorker = new InsertGMChatWorker();
        insertGMChatWorker.postMessage({ gmChat: newGMChat });
        insertGMChatWorker.onmessage = (event) => {
            resolve(event.data);
            insertGMChatWorker.terminate();
        };
        insertGMChatWorker.onerror = (error) => {
            reject(error);
            insertGMChatWorker.terminate();
        };
    });
};

type MDFooterProps = {
    myself: UserProps;
    socket: Socket;
    chat: ChatProps;
    messageContent: string;
    setCurrentMainChat: (chat: ChatProps) => void;
    setContent: (text: string) => void;
};

export default function MDFooter(props: MDFooterProps) {
    const { myself, socket, chat, messageContent, setCurrentMainChat, setContent } = props
    return (
        <Box
            sx={{
                backgroundColor: "#393939",
                display: "flex",
                justifyContent: "flex-end",
                pr: '10px',
                borderBottomLeftRadius: "5px",
                borderBottomRightRadius: "5px",
            }}
        >
            <Stack direction="row" justifyContent="space-between" alignItems="center" width="100%">
                <Box sx={{ pl: '10px' }}>
                    <Tooltip title="Mention" size='sm'>
                        <IconButton component='a' size="sm" variant="plain">
                            <AlternateEmailIcon sx={{ color: '#c1c1c1', fontSize: '20px' }} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Call" size='sm'>
                        <IconButton component='a' size="sm" variant="plain">
                            <CallIcon sx={{ color: '#c1c1c1', fontSize: '20px' }} />
                        </IconButton>
                    </Tooltip>
                </Box>
                <Box>
                    <IconButton component='a' variant="plain" onClick={
                        () => {

                            if (messageContent.trim()) {
                                socket.emit("message", {
                                    message: messageContent,
                                    destCGName: chat.chatName,
                                    destCGEmail: chat.chatEmail,
                                    isDm: chat.isDm,
                                }, (ack: any) => {

                                    const updatedChat: ChatProps = {
                                        chatName: chat.chatName,
                                        chatEmail: chat.chatEmail,
                                        isDm: chat.isDm,
                                        unread: false,
                                        messages: [...chat.messages, {
                                            messageIdWithChatEmail: `${chat.chatEmail}-${String(Number(chat.latestMessage?.messageId) + 1)}`,
                                            messageId: String(Number(chat.latestMessage?.messageId) + 1),
                                            chatEmail: chat.chatEmail,
                                            content: messageContent,
                                            sender: myself,
                                            tsSent: getCurrentTimestamp(),
                                            numReplies: 0,
                                        }],
                                        latestMessage: {
                                            messageIdWithChatEmail: `${chat.chatEmail}-${String(Number(chat.latestMessage?.messageId) + 1)}`,
                                            messageId: String(Number(chat.latestMessage?.messageId) + 1),
                                            chatEmail: chat.chatEmail,
                                            content: messageContent,
                                            sender: myself,
                                            tsSent: getCurrentTimestamp(),
                                            numReplies: 0,
                                        },
                                        TSLastMessage: getCurrentTimestamp(),
                                    };
                                    setCurrentMainChat(updatedChat);

                                    const newChat: AllChatProps = {
                                        chatName: chat.chatName,
                                        chatEmail: chat.chatEmail,
                                        isDm: chat.isDm,
                                        unread: false,
                                        latestMessage: {
                                            messageIdWithChatEmail: `${chat.chatEmail}-${String(Number(chat.latestMessage?.messageId) + 1)}`,
                                            messageId: String(Number(chat.latestMessage?.messageId) + 1),
                                            chatEmail: chat.chatEmail,
                                            content: messageContent,
                                            sender: myself,
                                            tsSent: getCurrentTimestamp(),
                                            numReplies: 0,
                                        },
                                        TSLastMessage: getCurrentTimestamp(),
                                    };

                                    if (chat.isDm) {
                                        insertDMChatAndMessage(newChat);
                                    } else {
                                        insertGMChatAndMessage(newChat);
                                    }

                                    setContent("")
                                });
                            }



                        }
                    }>
                        <SendIcon sx={{ color: '#00aeff' }} />
                        &nbsp; Send
                    </IconButton>
                </Box>
            </Stack >
        </Box >

    );
};
