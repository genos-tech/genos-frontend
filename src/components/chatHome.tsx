import Box from '@mui/joy/Box';
import { useState, useEffect } from "react";
import Sheet from '@mui/joy/Sheet';
import { io, Socket } from "socket.io-client";
import ThreadPane from './thread/threadPane';
import TaskContent from './tasks/TaskContent';
import ChatsPane from './chatCommon/chatsPane';
import {
    AllChatProps,
    NewMessageProps,
    NewThreadMessageProps,
    UserProps,
    MessageProps,
    ChatProps,
    ThreadProps,
    ThreadMessageProps
} from "../types";
import FetchAllChatsWorker from "../workers/fetchAllChatsWorker.ts?worker";
import InsertDMChatWorker from "../workers/insertDMChatWorker.ts?worker";
import InsertGMChatWorker from "../workers/insertGMChatWorker.ts?worker";
import InsertDMMessageWorker from "../workers/insertDMMessageWorker.ts?worker";
import InsertDMThreadMessageWorker from "../workers/insertDMThreadMessageWorker.ts?worker";
import InsertGMMessageWorker from "../workers/insertGMMessageWorker.ts?worker";
import InsertGMThreadMessageWorker from "../workers/insertGMThreadMessageWorker.ts?worker";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import Sidebar from '../components/utils/sidebar';
import { useColorScheme } from '@mui/joy/styles';

import MessagesPane from './mainChat/mainMessagesPane';
import MessagesSubPane from './subChat/subMessagesPane';

import { useAuth } from "../components/admin/AuthContext";

const ws_url = import.meta.env.VITE_WS_BASE_URL;

const insertDMMessage = async (dmMessage: MessageProps): Promise<MessageProps[]> => {
    return new Promise((resolve, reject) => {
        const insertDMMessageWorker = new InsertDMMessageWorker();
        insertDMMessageWorker.postMessage({ dmMessage: dmMessage });
        insertDMMessageWorker.onmessage = (event) => {
            resolve(event.data);
            insertDMMessageWorker.terminate();
        };
        insertDMMessageWorker.onerror = (error) => {
            reject(error);
            insertDMMessageWorker.terminate();
        };
    });
};

const insertDMThreadMessage = async (dmThreadMessage: ThreadMessageProps): Promise<MessageProps[]> => {
    return new Promise((resolve, reject) => {
        const insertDMThreadMessageWorker = new InsertDMThreadMessageWorker();
        insertDMThreadMessageWorker.postMessage({ dmThreadMessage: dmThreadMessage });
        insertDMThreadMessageWorker.onmessage = (event) => {
            resolve(event.data);
            insertDMThreadMessageWorker.terminate();
        };
        insertDMThreadMessageWorker.onerror = (error) => {
            reject(error);
            insertDMThreadMessageWorker.terminate();
        };
    });
};

const insertGMMessage = async (gmMessage: MessageProps): Promise<MessageProps[]> => {
    return new Promise((resolve, reject) => {
        const insertGMMessageWorker = new InsertGMMessageWorker();
        insertGMMessageWorker.postMessage({ gmMessage: gmMessage });
        insertGMMessageWorker.onmessage = (event) => {
            resolve(event.data);
            insertGMMessageWorker.terminate();
        };
        insertGMMessageWorker.onerror = (error) => {
            reject(error);
            insertGMMessageWorker.terminate();
        };
    });
};

const insertGMThreadMessage = async (gmThreadMessage: ThreadMessageProps): Promise<MessageProps[]> => {
    return new Promise((resolve, reject) => {
        const insertGMThreadMessageWorker = new InsertGMThreadMessageWorker();
        insertGMThreadMessageWorker.postMessage({ gmThreadMessage: gmThreadMessage });
        insertGMThreadMessageWorker.onmessage = (event) => {
            resolve(event.data);
            insertGMThreadMessageWorker.terminate();
        };
        insertGMThreadMessageWorker.onerror = (error) => {
            reject(error);
            insertGMThreadMessageWorker.terminate();
        };
    });
};


const insertDMChat = async (
    chatId: number,
    chatName: string,
    dmPartnerUserId: string | null,
    newDMMessage: MessageProps,
    setAllChats: (chat: AllChatProps[]
    ) => void): Promise<string> => {

    return new Promise((resolve, reject) => {
        const insertDMChatWorker = new InsertDMChatWorker();
        const dmChat: AllChatProps = {
            chatId: chatId,
            chatName: chatName,
            isDm: true,
            dmPartnerUserId: dmPartnerUserId,
            unread: true,
            latestMessage: newDMMessage,
            TSLastMessage: newDMMessage.tsSent,
        }
        insertDMChatWorker.postMessage({ dmChat: dmChat });
        insertDMChatWorker.onmessage = (event) => {
            resolve(event.data);
            insertDMChatWorker.terminate();

            const fetchAllChatsWorker = new FetchAllChatsWorker();
            fetchAllChatsWorker.postMessage({});
            fetchAllChatsWorker.onmessage = (event) => {
                const allChats: AllChatProps[] = event.data
                if (allChats !== undefined) {
                    setAllChats(allChats)
                }
            };
            return () => {
                fetchAllChatsWorker.terminate();
            };
        };
        insertDMChatWorker.onerror = (error) => {
            reject(error);
            insertDMChatWorker.terminate();
        };
    });
};

const insertGMChat = async (
    chatId: number,
    chatName: string,
    newGMMessage: MessageProps,
    setAllChats: (chat: AllChatProps[]
    ) => void): Promise<string> => {

    return new Promise((resolve, reject) => {
        const insertGMChatWorker = new InsertGMChatWorker();
        const gmChat: AllChatProps = {
            chatId: chatId,
            chatName: chatName,
            isDm: false,
            dmPartnerUserId: null,
            unread: true,
            latestMessage: newGMMessage,
            TSLastMessage: newGMMessage.tsSent,
        }
        insertGMChatWorker.postMessage({ gmChat: gmChat });
        insertGMChatWorker.onmessage = (event) => {
            resolve(event.data);
            insertGMChatWorker.terminate();

            const fetchAllChatsWorker = new FetchAllChatsWorker();
            fetchAllChatsWorker.postMessage({});
            fetchAllChatsWorker.onmessage = (event) => {
                const allChats: AllChatProps[] = event.data
                if (allChats !== undefined) {
                    setAllChats(allChats)
                }
            };
            return () => {
                fetchAllChatsWorker.terminate();
            };
        };
        insertGMChatWorker.onerror = (error) => {
            reject(error);
            insertGMChatWorker.terminate();
        };
    });
};


type HomeProps = {
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    currentMainChat: ChatProps,
    setCurrentMainChat: (chat: ChatProps) => void;
};

export default function Home(props: HomeProps) {
    const { mode } = useColorScheme();
    const { myself,
        setMyself,
        currentMainChat,
        setCurrentMainChat,
    } = props;

    const { accessToken } = useAuth();

    const socket: Socket = io(ws_url, {
        reconnection: true,          // Enable reconnection
        reconnectionAttempts: 5,     // Try to reconnect 5 times
        reconnectionDelay: 1000,     // Wait 1 second before reconnecting
        reconnectionDelayMax: 5000,  // Max delay between reconnection attempts
        timeout: 10000,               // Timeout for the connection attempt
        withCredentials: true,
        query: {
            teamId: localStorage.getItem("teamId"),
            userId: localStorage.getItem("userId"),
            userName: localStorage.getItem("userName"),
            userEmail: localStorage.getItem("userEmail"),
        },
        extraHeaders: {
            Authorization: accessToken || ""
        },
    });

    const [allChats, setAllChats] = useState<AllChatProps[]>([]);
    const [currentSubChat, setCurrentSubChat] = useState<ChatProps>();
    const [currentThreadChat, setCurrentThreadChat] = useState<ThreadProps>();
    const [isSubChatVisible, setIsSubChatVisible] = useState(false);
    const [isThreadVisible, setIsThreadVisible] = useState(false);
    const [isTaskContentVisible, setIsTaskContentVisible] = useState(false);

    const [currentMainChatId, setCurrentMainChatId] = useState<number>(-1);
    const [currentSubChatId, setCurrentSubChatId] = useState<number>(-1);
    const [currentThreadChatId, setCurrentThreadChatId] = useState<number>(-1);

    // Load initial Chats with latest one message
    useEffect(() => {

        const fetchAllChatsWorker = new FetchAllChatsWorker();
        fetchAllChatsWorker.postMessage({});
        fetchAllChatsWorker.onmessage = (event) => {
            const allChats: AllChatProps[] = event.data
            if (allChats !== undefined) {
                setAllChats(allChats)
            }
        };
        return () => {
            fetchAllChatsWorker.terminate();
        };
    }, []);

    // Web Socket handler
    useEffect(() => {
        socket.on("connect", () => {
            // // Join to initial user room
            // socket.emit("join", {
            //     joiningCGId: -1,
            //     joiningCGName: myself.userName,
            //     isDm: true,
            //     dmPartnerUserId: myself.userId,
            // });
        });

        socket.on("auth_error", (data) => {
            console.error("Authentication Error:", data.message);
            // alert(`Error: ${data.message}`);
        });

        socket.on("message", (message) => {
            console.log("message:", message)
            if (message.chatId !== null) {
                if (message.isDm === true) {
                    if (message.isThread === true) {
                        const newMessage: NewThreadMessageProps = message;
                        var fromMe: boolean = false
                        var toMe: boolean = false

                        if (newMessage.dmPartnerUserId === myself.userId) {
                            if (newMessage.dmPartnerUserId === newMessage.sender.userId) {
                                console.log("Personal DM thread")
                                fromMe = true
                                toMe = true
                            } else {
                                console.log("DM thread from my friend")
                                toMe = true
                            }
                        } else {
                            if (newMessage.sender.userId === myself.userId) {
                                console.log("DM thread from myself")
                                fromMe = true
                                toMe = true
                            } else {
                                console.log("DM thread not for me")
                            }
                        }

                        if (fromMe === false && toMe === true) {
                            const newDMThreadMessage: ThreadMessageProps = {
                                messageIdWithChatIdAndThreadId: `${newMessage.chatId}-${newMessage.threadId}-${newMessage.messageId}`,
                                chatId: newMessage.chatId,
                                threadId: newMessage.threadId,
                                messageId: newMessage.messageId,
                                content: newMessage.content,
                                sender: newMessage.sender,
                                tsSent: newMessage.tsSent,
                            }
                            insertDMThreadMessage(newDMThreadMessage)

                            // Update current visible thread pane
                            if (currentThreadChat !== undefined
                                && newMessage.chatId === currentThreadChat.chatId
                                && newDMThreadMessage.threadId === currentThreadChat.threadId) {
                                const updatedThreadChat: ThreadProps = {
                                    chatId: currentThreadChat.chatId,
                                    chatName: currentThreadChat.chatName,
                                    threadId: newDMThreadMessage.threadId,
                                    isDm: newMessage.isDm,
                                    dmPartnerUserId: newMessage.dmPartnerUserId,
                                    unread: false,
                                    messages: [...currentThreadChat.messages, newDMThreadMessage],
                                    TSLastMessage: newDMThreadMessage.tsSent,
                                };
                                setCurrentThreadChat(updatedThreadChat);
                            }

                        }
                    } else {
                        const newMessage: NewMessageProps = message;
                        var fromMe: boolean = false
                        var toMe: boolean = false

                        if (newMessage.dmPartnerUserId === myself.userId) {
                            if (newMessage.dmPartnerUserId === newMessage.sender.userId) {
                                console.log("Personal DM")
                                fromMe = true
                                toMe = true
                            } else {
                                console.log("DM from my friend")
                                toMe = true
                            }
                        } else {
                            if (newMessage.sender.userId === myself.userId) {
                                console.log("DM from myself")
                                fromMe = true
                                toMe = true
                            } else {
                                console.log("DM not for me")
                            }
                        }

                        if (fromMe === false && toMe === true) {
                            const newDMMessage: MessageProps = {
                                messageIdWithChatId: `${newMessage.chatId}-${newMessage.messageId}`,
                                chatId: newMessage.chatId,
                                messageId: newMessage.messageId,
                                content: newMessage.content,
                                sender: newMessage.sender,
                                numReplies: newMessage.numReplies,
                                tsSent: newMessage.tsSent,
                            }
                            insertDMMessage(newDMMessage)

                            insertDMChat(
                                newMessage.chatId,
                                newMessage.sender.userName,
                                newMessage.dmPartnerUserId,
                                newDMMessage,
                                setAllChats)

                            if (newMessage.chatId === currentMainChat.chatId) {
                                const updatedChat: ChatProps = {
                                    chatId: newMessage.chatId,
                                    chatName: newMessage.sender.userName,
                                    isDm: newMessage.isDm,
                                    dmPartnerUserId: newMessage.dmPartnerUserId,
                                    unread: false,
                                    messages: [...currentMainChat.messages, newMessage],
                                    latestMessage: newMessage,
                                    TSLastMessage: newMessage.tsSent,
                                };
                                setCurrentMainChat(updatedChat);
                            } else if (newMessage.chatId === currentSubChat?.chatId) {
                                const updatedChat: ChatProps = {
                                    chatId: newMessage.chatId,
                                    chatName: newMessage.sender.userName,
                                    isDm: newMessage.isDm,
                                    dmPartnerUserId: newMessage.dmPartnerUserId,
                                    unread: false,
                                    messages: [...currentMainChat.messages, newMessage],
                                    latestMessage: newMessage,
                                    TSLastMessage: newMessage.tsSent,
                                };
                                setCurrentSubChat(updatedChat);
                            } else {
                                console.log("Unexpected DM (newMessage.chatId):", newMessage.chatId)
                                console.log("Unexpected DM (currentMainChat.chatId):", currentMainChat.chatId)
                                console.log("Unexpected DM (currentSubChat.chatId):", currentSubChat?.chatId)
                            }
                        }
                        else if (fromMe === true && toMe === true) {
                            // Only updating indexedDB for chat, not updating messaging pane
                            const newDMMessage: MessageProps = {
                                messageIdWithChatId: `${newMessage.chatId}-${newMessage.messageId}`,
                                chatId: newMessage.chatId,
                                messageId: newMessage.messageId,
                                content: newMessage.content,
                                sender: newMessage.sender,
                                numReplies: newMessage.numReplies,
                                tsSent: newMessage.tsSent,
                            }
                            insertDMChat(
                                newMessage.chatId,
                                newMessage.sender.userName,
                                newMessage.dmPartnerUserId,
                                newDMMessage,
                                setAllChats)
                        }
                    }
                } else {
                    if (message.isThread === true) {
                        const newMessage: NewThreadMessageProps = message;
                        var fromMe: boolean = false

                        if (newMessage.sender.userId === myself.userId) {
                            console.log("GM thread from myself")
                            fromMe = true
                        } else {
                            console.log("GM thread from someone")
                        }

                        if (fromMe === false) {
                            const newGMThreadMessage: ThreadMessageProps = {
                                messageIdWithChatIdAndThreadId: `${newMessage.chatId}-${newMessage.threadId}-${newMessage.messageId}`,
                                chatId: newMessage.chatId,
                                threadId: newMessage.threadId,
                                messageId: newMessage.messageId,
                                content: newMessage.content,
                                sender: newMessage.sender,
                                tsSent: newMessage.tsSent,
                            }
                            insertGMThreadMessage(newGMThreadMessage);

                            // Update current visible thread pane
                            if (currentThreadChat !== undefined
                                && newMessage.chatId === currentThreadChat.chatId
                                && newGMThreadMessage.threadId === currentThreadChat.threadId) {
                                const updatedThreadChat: ThreadProps = {
                                    chatId: currentThreadChat.chatId,
                                    chatName: currentThreadChat.chatName,
                                    threadId: newGMThreadMessage.threadId,
                                    isDm: newMessage.isDm,
                                    dmPartnerUserId: newMessage.dmPartnerUserId,
                                    unread: false,
                                    messages: [...currentThreadChat.messages, newGMThreadMessage],
                                    TSLastMessage: newGMThreadMessage.tsSent,
                                };
                                setCurrentThreadChat(updatedThreadChat);
                            }
                        }

                    } else {
                        const newMessage: NewMessageProps = message;
                        var fromMe: boolean = false

                        if (newMessage.sender.userId === myself.userId) {
                            console.log("GM from myself")
                            fromMe = true
                        } else {
                            console.log("GM from someone")
                        }

                        if (fromMe === false) {
                            const newGMMessage: MessageProps = {
                                messageIdWithChatId: `${newMessage.chatId}-${newMessage.messageId}`,
                                chatId: newMessage.chatId,
                                messageId: newMessage.messageId,
                                content: newMessage.content,
                                sender: newMessage.sender,
                                numReplies: newMessage.numReplies,
                                tsSent: newMessage.tsSent,
                            }
                            insertGMMessage(newGMMessage)

                            if (allChats.length > 0) {
                                insertGMChat(newMessage.chatId, newMessage.chatName, newGMMessage, setAllChats)
                            }

                            if (newMessage.chatId === currentMainChat.chatId) {
                                const updatedChat: ChatProps = {
                                    chatId: newMessage.chatId,
                                    chatName: newMessage.chatName,
                                    isDm: newMessage.isDm,
                                    dmPartnerUserId: newMessage.dmPartnerUserId,
                                    unread: false,
                                    messages: [...currentMainChat.messages, newMessage],
                                    latestMessage: newMessage,
                                    TSLastMessage: newMessage.tsSent,
                                };
                                setCurrentMainChat(updatedChat);
                            } else if (newMessage.chatId === currentSubChat?.chatId) {
                                const updatedChat: ChatProps = {
                                    chatId: newMessage.chatId,
                                    chatName: newMessage.chatName,
                                    isDm: newMessage.isDm,
                                    dmPartnerUserId: newMessage.dmPartnerUserId,
                                    unread: false,
                                    messages: [...currentMainChat.messages, newMessage],
                                    latestMessage: newMessage,
                                    TSLastMessage: newMessage.tsSent,
                                };
                                setCurrentSubChat(updatedChat);
                            } else {
                                console.log("Unexpected GM (newMessage.chatId):", newMessage.chatId)
                                console.log("Unexpected GM (currentMainChat.chatId):", currentMainChat.chatId)
                                console.log("Unexpected GM (currentSubChat.chatId):", currentSubChat?.chatId)
                            }
                        }
                        else if (fromMe) {
                            // Only updating indexedDB for chat, not updating messaging pane
                            const newGMMessage: MessageProps = {
                                messageIdWithChatId: `${newMessage.chatId}-${newMessage.messageId}`,
                                chatId: newMessage.chatId,
                                messageId: newMessage.messageId,
                                content: newMessage.content,
                                sender: newMessage.sender,
                                numReplies: newMessage.numReplies,
                                tsSent: newMessage.tsSent,
                            }
                            insertGMChat(newMessage.chatId, newMessage.chatName, newGMMessage, setAllChats)
                        }
                    }
                }
            }
        });
        return () => {
            socket.off("message");
            socket.off("connect");
        };
    }, [accessToken, allChats, currentMainChat, currentSubChat, currentThreadChat]);

    useEffect(() => {
        if (currentMainChatId !== currentMainChat.chatId) {
            setCurrentMainChatId(currentMainChat.chatId)
        }
    }, [currentMainChat]);

    useEffect(() => {
        if (currentSubChat !== undefined && currentSubChatId !== currentSubChat.chatId) {
            setCurrentSubChatId(currentSubChat.chatId)
        }
    }, [currentSubChat]);

    useEffect(() => {
        if (currentThreadChatId !== -1) {
            setCurrentThreadChatId(currentThreadChatId)
        }
    }, [currentThreadChat]);



    ////////////////////////////////////////////////////////////////////
    // useEffect(() => {
    //     console.log("currentMainChat Updated:", currentMainChat);
    // }, [currentMainChat]);

    // useEffect(() => {
    //     console.log("initLoad Updated:", initLoad);
    // }, [initLoad]);

    // useEffect(() => {
    //     console.log("isSubChatVisible Updated:", isSubChatVisible);
    // }, [isSubChatVisible]);

    // useEffect(() => {
    //     console.log("isThreadVisible Updated:", isThreadVisible);
    // }, [isThreadVisible]);

    // useEffect(() => {
    //     console.log("currentThreadChat is updated:", currentThreadChat)
    // }, [currentThreadChat]);
    ////////////////////////////////////////////////////////////////////


    /////////////////// NEED FOR MAIN/SUB Chat Pane height ////////////////////
    const [mainChatPanelSize, setMainChatPanelSize] = useState(50);
    const [subChatPanelSize, setSubChatPanelSize] = useState(50);
    const useWindowSize = () => {
        const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

        useEffect(() => {
            const handleResize = () => {
                setSize({ width: window.innerWidth, height: window.innerHeight });
            };

            window.addEventListener("resize", handleResize);

            // Cleanup event listener on unmount
            return () => window.removeEventListener("resize", handleResize);
        }, []);

        return size;
    };
    const { width, height } = useWindowSize();
    ////////////////////////////////////////////////////////////////////////////

    return (
        <Box sx={{ display: 'flex', minHeight: '100dvh', width: '100vw' }}>

            <Sidebar myself={myself} setMyself={setMyself} />

            <PanelGroup autoSaveId="conditional" direction="horizontal">
                <Panel id={'1'} order={1} minSize={10} maxSize={30}>
                    <Box
                        sx={{
                            height: '100%',
                            width: '100%',
                            backgroundColor: 'grey',
                            borderRight: mode === 'dark'
                                ? '2px black groove'
                                : '2px white groove',
                        }}
                    >
                        <Sheet
                            sx={{
                                position: { xs: 'fixed', sm: 'sticky' },
                                transform: {
                                    xs: 'translateX(calc(100% * (var(--MessagesPane-slideIn, 0) - 1)))',
                                    sm: 'none',
                                },
                                transition: 'transform 0.4s, width 0.4s',
                                zIndex: 100,
                                top: 10,
                            }}
                        >
                            <ChatsPane
                                myself={myself}
                                allChats={allChats}
                                setAllChats={setAllChats}
                                setCurrentMainChat={setCurrentMainChat}
                                setCurrentSubChat={setCurrentSubChat}
                                currentMainChat={currentMainChat}
                                currentSubChat={currentSubChat ? currentSubChat : currentMainChat}
                                socket={socket}
                                isSubChatVisible={isSubChatVisible}
                                setIsSubChatVisible={setIsSubChatVisible}
                            />
                        </Sheet>
                    </Box>
                </Panel>

                {/* Resizable Handle with MUI sx Styling */}
                <PanelResizeHandle
                    style={{
                        backgroundColor: "grey",
                        transition: "all 0.3s ease-in-out",
                        cursor: "col-resize",
                    }}
                    className="chat-resize-handle"
                />

                {isTaskContentVisible && currentThreadChat !== undefined && (<>

                    <Panel id={'2'} order={2} minSize={25} maxSize={70}>
                        <Box
                            sx={{
                                height: '100%',
                                backgroundColor: 'black',
                                borderLeft: mode === 'dark'
                                    ? '2px black groove'
                                    : '2px white groove',
                            }}
                        >
                            <ThreadPane
                                thread={currentThreadChat}
                                myself={myself}
                                socket={socket}
                                setCurrentThreadChat={setCurrentThreadChat}
                                setIsThreadVisible={setIsThreadVisible}
                                currentThreadChatId={currentThreadChatId}
                                setIsTaskContentVisible={setIsTaskContentVisible}
                            />
                        </Box>
                    </Panel>

                    <PanelResizeHandle
                        style={{
                            backgroundColor: "grey",
                            transition: "all 0.3s ease-in-out",
                            cursor: "col-resize",
                        }}
                        className="chat-resize-handle"
                    />

                    <Panel id={'3'} order={3} minSize={25} maxSize={70}>
                        <Box
                            sx={{
                                px: { xs: 1, md: 2 },
                                pt: {
                                    xs: 'calc(12px + var(--Header-height))',
                                    sm: 'calc(12px + var(--Header-height))',
                                    md: 2,
                                },
                                pb: { xs: 2, sm: 2, md: 3 },
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                minWidth: 0,
                                height: '100dvh',
                                gap: 1,
                                ml: '1px',
                                boxShadow: '0 0 0 1px grey'
                            }}
                        >
                            <TaskContent setIsTaskContentVisible={setIsTaskContentVisible} />
                        </Box>
                    </Panel>
                </>)}


                {(!isTaskContentVisible || currentThreadChat === undefined) && (<>
                    <Panel id={'4'} order={4} minSize={25} maxSize={90}>
                        <PanelGroup autoSaveId="conditional" direction="vertical">
                            {isSubChatVisible && (
                                <>
                                    <Panel
                                        id={'5'}
                                        order={5}
                                        minSize={30}
                                        maxSize={80}
                                        onResize={setSubChatPanelSize}
                                    >
                                        <MessagesSubPane
                                            currentWindowHeight={height}
                                            paneSizePCT={subChatPanelSize}
                                            myself={myself}
                                            chat={currentMainChat}
                                            subChat={currentSubChat ? currentSubChat : currentMainChat}
                                            socket={socket}
                                            setCurrentMainChat={setCurrentMainChat}
                                            setCurrentSubChat={setCurrentSubChat}
                                            setCurrentThreadChat={setCurrentThreadChat}
                                            setIsSubChatVisible={setIsSubChatVisible}
                                            setIsThreadVisible={setIsThreadVisible}
                                            currentSubChatId={currentSubChatId} />
                                    </Panel>

                                    <PanelResizeHandle
                                        style={{
                                            backgroundColor: "grey",
                                            transition: "all 0.3s ease-in-out",
                                            cursor: "col-resize",
                                        }}
                                        className="chat-resize-handle-ver" />
                                </>
                            )}
                            <Panel
                                id={'6'}
                                order={6}
                                minSize={30}
                                maxSize={80}
                                onResize={setMainChatPanelSize}
                            >
                                <MessagesPane
                                    currentWindowHeight={height}
                                    paneSizePCT={mainChatPanelSize}
                                    chat={currentMainChat}
                                    subChat={currentSubChat ? currentSubChat : currentMainChat}
                                    myself={myself}
                                    socket={socket}
                                    setCurrentMainChat={setCurrentMainChat}
                                    setCurrentSubChat={setCurrentSubChat}
                                    setCurrentThreadChat={setCurrentThreadChat}
                                    setIsThreadVisible={setIsThreadVisible}
                                    isSubChatVisible={isSubChatVisible}
                                    setIsSubChatVisible={setIsSubChatVisible}
                                    currentMainChatId={currentMainChatId}
                                />
                            </Panel>
                        </PanelGroup>
                    </Panel>

                    {isThreadVisible && currentThreadChat !== undefined && (
                        <>
                            <PanelResizeHandle
                                style={{
                                    backgroundColor: "grey",
                                    transition: "all 0.3s ease-in-out",
                                    cursor: "col-resize",
                                }}
                                className="chat-resize-handle"
                            />

                            <Panel id={'7'} order={7} minSize={25} maxSize={70}>
                                <Box
                                    sx={{
                                        height: '100%',
                                        backgroundColor: 'black',
                                        borderLeft: mode === 'dark'
                                            ? '2px black groove'
                                            : '2px white groove',
                                    }}
                                >
                                    <ThreadPane
                                        thread={currentThreadChat}
                                        myself={myself}
                                        socket={socket}
                                        setCurrentThreadChat={setCurrentThreadChat}
                                        setIsThreadVisible={setIsThreadVisible}
                                        currentThreadChatId={currentThreadChatId}
                                        setIsTaskContentVisible={setIsTaskContentVisible}
                                    />
                                </Box>
                            </Panel>
                        </>
                    )}
                </>)}

            </PanelGroup>


            {/* Hover Animation with CSS */}
            <style>
                {`
                .chat-resize-handle {
                    transition: all 0.3s ease-in-out;
                }
                .chat-resize-handle:hover {
                    background-color: lightgray !important;
                    width: 8px !important;
                }
                `}
            </style>
        </Box>
    );
}