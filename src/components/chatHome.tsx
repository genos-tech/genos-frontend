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
    chatName: string,
    newDMMessage: MessageProps,
    setAllChats: (chat: AllChatProps[]
    ) => void): Promise<string> => {

    return new Promise((resolve, reject) => {
        const insertDMChatWorker = new InsertDMChatWorker();
        const dmChat: AllChatProps = {
            chatName: chatName,
            chatEmail: newDMMessage.chatEmail,
            isDm: true,
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
    chatName: string,
    newGMMessage: MessageProps,
    setAllChats: (chat: AllChatProps[]
    ) => void): Promise<string> => {

    return new Promise((resolve, reject) => {
        const insertGMChatWorker = new InsertGMChatWorker();
        const gmChat: AllChatProps = {
            chatName: chatName,
            chatEmail: newGMMessage.chatEmail,
            isDm: false,
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
    currentMainChat: ChatProps,
    setCurrentMainChat: (chat: ChatProps) => void;
};

export default function Home(props: HomeProps) {
    const { mode } = useColorScheme();
    const { myself,
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
            userEmail: localStorage.getItem("userEmail"),
            userName: localStorage.getItem("userName"),
        },
        extraHeaders: {
            Authorization: accessToken || ""
        },
    });

    const initialSelectedChat: ChatProps = {
        chatName: myself.userName,
        chatEmail: myself.userEmail,
        isDm: Boolean(true),
        unread: true,
        messages: [],
        TSLastMessage: "2025-02-11 13:54:33",
    };
    const [allChats, setAllChats] = useState<AllChatProps[]>([]);
    const [currentSubChat, setCurrentSubChat] = useState<ChatProps>(initialSelectedChat);
    const [currentThreadChat, setCurrentThreadChat] = useState<ThreadProps>();
    const [isSubChatVisible, setIsSubChatVisible] = useState(false);
    const [isThreadVisible, setIsThreadVisible] = useState(false);
    const [isTaskContentVisible, setIsTaskContentVisible] = useState(false);

    const [currentMainChatEmail, setCurrentMainChatEmail] = useState<string>("");
    const [currentSubChatEmail, setCurrentSubChatEmail] = useState<string>("");
    const [currentThreadChatEmail, setCurrentThreadChatEmail] = useState<string>("");

    // Load initial Chats with latest one message
    useEffect(() => {
        console.log("Fetch my all chats")
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
            console.log("Connected to WebSocket");

            // Join to initial user room
            socket.emit("join", {
                joiningCGEmail: myself.userEmail,
                joiningCGName: myself.userName,
                isDm: true,
                userEmail: myself.userEmail
            });
        });

        socket.on("auth_error", (data) => {
            console.error("Authentication Error:", data.message);
            // alert(`Error: ${data.message}`);
        });

        var incomingChatEmail: string = ""

        socket.on("message", (message) => {
            console.log("message:", message)
            if (message.isDm === true) {
                if (message.isThread === true) {
                    const newMessage: NewThreadMessageProps = message;
                    var fromMyself: boolean = false

                    if (newMessage.chatEmail === myself.userEmail) {
                        if (newMessage.chatEmail === newMessage.sender.userEmail) {
                            console.log("DM thread for personal")
                            incomingChatEmail = myself.userEmail;
                            fromMyself = true
                        } else {
                            console.log("DM thread from my friend")
                            incomingChatEmail = newMessage.sender.userEmail;
                        }
                    } else {
                        if (newMessage.sender.userEmail === myself.userEmail) {
                            console.log("DM thread from myself")
                            incomingChatEmail = newMessage.chatEmail;
                            fromMyself = true
                        } else {
                            console.log("DM thread not for me")
                            incomingChatEmail = "";
                        }
                    }

                    if (incomingChatEmail !== "" && newMessage.messageId !== "-1" && !fromMyself) {
                        const newDMThreadMessage: ThreadMessageProps = {
                            messageIdWithChatEmailAndThreadId: `${incomingChatEmail}-${newMessage.threadId}-${newMessage.messageId}`,
                            threadId: newMessage.threadId,
                            messageId: newMessage.messageId,
                            chatEmail: incomingChatEmail,
                            content: newMessage.content,
                            sender: newMessage.sender,
                            tsSent: newMessage.tsSent,
                        }
                        insertDMThreadMessage(newDMThreadMessage)

                        // Update current visible thread pane
                        if (currentThreadChat !== undefined
                            && incomingChatEmail === currentThreadChat.chatEmail
                            && newDMThreadMessage.threadId === currentThreadChat.threadId) {
                            const updatedThreadChat: ThreadProps = {
                                chatName: currentThreadChat.chatName,
                                chatEmail: currentThreadChat.chatEmail,
                                threadId: newDMThreadMessage.threadId,
                                isDm: newMessage.isDm,
                                unread: false,
                                messages: [...currentThreadChat.messages, newDMThreadMessage],
                                TSLastMessage: newDMThreadMessage.tsSent,
                            };
                            setCurrentThreadChat(updatedThreadChat);
                        }

                    }
                } else {
                    const newMessage: NewMessageProps = message;
                    var fromMyself: boolean = false

                    if (newMessage.chatEmail === myself.userEmail) {
                        if (newMessage.chatEmail === newMessage.sender.userEmail) {
                            console.log("DM for personal")
                            incomingChatEmail = myself.userEmail;
                            fromMyself = true
                        } else {
                            console.log("DM from my friend")
                            incomingChatEmail = newMessage.sender.userEmail;
                        }
                    } else {
                        if (newMessage.sender.userEmail === myself.userEmail) {
                            console.log("DM from myself")
                            incomingChatEmail = newMessage.chatEmail;
                            fromMyself = true
                        } else {
                            console.log("DM not for me")
                            incomingChatEmail = "";
                        }
                    }

                    if (incomingChatEmail !== "" && !fromMyself) {
                        const newDMMessage: MessageProps = {
                            messageIdWithChatEmail: `${incomingChatEmail}-${newMessage.messageId}`,
                            messageId: newMessage.messageId,
                            chatEmail: incomingChatEmail,
                            content: newMessage.content,
                            sender: newMessage.sender,
                            numReplies: newMessage.numReplies,
                            tsSent: newMessage.tsSent,
                        }
                        insertDMMessage(newDMMessage)

                        if (allChats.length > 0) {
                            insertDMChat(newMessage.sender.userName, newDMMessage, setAllChats)
                        }

                        if (incomingChatEmail === currentMainChat.chatEmail) {
                            const updatedChat: ChatProps = {
                                chatName: newMessage.sender.userName,
                                chatEmail: newMessage.sender.userEmail,
                                isDm: newMessage.isDm,
                                unread: false,
                                messages: [...currentMainChat.messages, newMessage],
                                latestMessage: newMessage,
                                TSLastMessage: newMessage.tsSent,
                            };
                            setCurrentMainChat(updatedChat);
                        } else if (incomingChatEmail === currentSubChat.chatEmail) {
                            const updatedChat: ChatProps = {
                                chatName: newMessage.sender.userName,
                                chatEmail: newMessage.sender.userEmail,
                                isDm: newMessage.isDm,
                                unread: false,
                                messages: [...currentMainChat.messages, newMessage],
                                latestMessage: newMessage,
                                TSLastMessage: newMessage.tsSent,
                            };
                            setCurrentSubChat(updatedChat);
                        }
                    }
                }
            } else {
                if (message.isThread === true) {
                    const newMessage: NewThreadMessageProps = message;
                    var fromMyself: boolean = false

                    if (newMessage.sender.userEmail === myself.userEmail) {
                        console.log("GM thread from myself")
                        incomingChatEmail = newMessage.chatEmail;
                        fromMyself = true
                    } else {
                        console.log("GM thread from someone")
                        incomingChatEmail = newMessage.chatEmail;
                    }

                    if (incomingChatEmail !== "" && newMessage.messageId !== "-1" && !fromMyself) {
                        const newGMThreadMessage: ThreadMessageProps = {
                            messageIdWithChatEmailAndThreadId: `${incomingChatEmail}-${newMessage.threadId}-${newMessage.messageId}`,
                            threadId: newMessage.threadId,
                            messageId: newMessage.messageId,
                            chatEmail: incomingChatEmail,
                            content: newMessage.content,
                            sender: newMessage.sender,
                            tsSent: newMessage.tsSent,
                        }
                        insertGMThreadMessage(newGMThreadMessage);

                        // Update current visible thread pane
                        if (currentThreadChat !== undefined
                            && incomingChatEmail === currentThreadChat.chatEmail
                            && newGMThreadMessage.threadId === currentThreadChat.threadId) {
                            const updatedThreadChat: ThreadProps = {
                                chatName: currentThreadChat.chatName,
                                chatEmail: currentThreadChat.chatEmail,
                                threadId: newGMThreadMessage.threadId,
                                isDm: newMessage.isDm,
                                unread: false,
                                messages: [...currentThreadChat.messages, newGMThreadMessage],
                                TSLastMessage: newGMThreadMessage.tsSent,
                            };
                            setCurrentThreadChat(updatedThreadChat);
                        }
                    }

                } else {
                    const newMessage: NewMessageProps = message;
                    var fromMyself: boolean = false

                    if (newMessage.sender.userEmail === myself.userEmail) {
                        console.log("GM from myself")
                        incomingChatEmail = newMessage.chatEmail;
                        fromMyself = true
                    } else {
                        console.log("GM from someone")
                        incomingChatEmail = newMessage.chatEmail;
                    }

                    if (incomingChatEmail !== "" && !fromMyself) {
                        const newGMMessage: MessageProps = {
                            messageIdWithChatEmail: `${newMessage.chatEmail}-${newMessage.messageId}`,
                            messageId: newMessage.messageId,
                            chatEmail: newMessage.chatEmail,
                            content: newMessage.content,
                            sender: newMessage.sender,
                            numReplies: newMessage.numReplies,
                            tsSent: newMessage.tsSent,
                        }
                        insertGMMessage(newGMMessage)

                        if (allChats.length > 0) {
                            insertGMChat(newMessage.chatName, newGMMessage, setAllChats)
                        }

                        if (incomingChatEmail === currentMainChat.chatEmail) {
                            const updatedChat: ChatProps = {
                                chatName: newMessage.chatName,
                                chatEmail: newMessage.chatEmail,
                                isDm: newMessage.isDm,
                                unread: false,
                                messages: [...currentMainChat.messages, newMessage],
                                latestMessage: newMessage,
                                TSLastMessage: newMessage.tsSent,
                            };
                            setCurrentMainChat(updatedChat);
                        } else if (incomingChatEmail === currentSubChat.chatEmail) {
                            const updatedChat: ChatProps = {
                                chatName: newMessage.chatName,
                                chatEmail: newMessage.chatEmail,
                                isDm: newMessage.isDm,
                                unread: false,
                                messages: [...currentMainChat.messages, newMessage],
                                latestMessage: newMessage,
                                TSLastMessage: newMessage.tsSent,
                            };
                            setCurrentSubChat(updatedChat);
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
        if (currentMainChatEmail !== currentMainChat.chatEmail) {
            setCurrentMainChatEmail(currentMainChat.chatEmail)
        }
    }, [currentMainChat]);

    useEffect(() => {
        if (currentSubChatEmail !== currentSubChat.chatEmail) {
            setCurrentSubChatEmail(currentSubChat.chatEmail)
        }
    }, [currentSubChat]);

    useEffect(() => {
        if (currentThreadChatEmail !== "") {
            setCurrentThreadChatEmail(currentThreadChatEmail)
        }
    }, [currentThreadChat]);



    ////////////////////////////////////////////////////////////////////
    // useEffect(() => {
    //     console.log("allChats Updated:", allChats);
    // }, [allChats]);

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

            <Sidebar />

            <PanelGroup autoSaveId="conditional" direction="horizontal">
                <Panel id={'1'} order={1} defaultSize={20} minSize={10} maxSize={30}>
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
                                currentSubChat={currentSubChat}
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
                                currentThreadChatEmail={currentThreadChatEmail}
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
                    <Panel id={'4'} order={4} defaultSize={80} minSize={25} maxSize={90}>
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
                                            subChat={currentSubChat}
                                            socket={socket}
                                            setCurrentMainChat={setCurrentMainChat}
                                            setCurrentSubChat={setCurrentSubChat}
                                            setCurrentThreadChat={setCurrentThreadChat}
                                            setIsSubChatVisible={setIsSubChatVisible}
                                            setIsThreadVisible={setIsThreadVisible}
                                            currentSubChatEmail={currentSubChatEmail} />
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
                                    subChat={currentSubChat}
                                    myself={myself}
                                    socket={socket}
                                    setCurrentMainChat={setCurrentMainChat}
                                    setCurrentSubChat={setCurrentSubChat}
                                    setCurrentThreadChat={setCurrentThreadChat}
                                    setIsThreadVisible={setIsThreadVisible}
                                    isSubChatVisible={isSubChatVisible}
                                    setIsSubChatVisible={setIsSubChatVisible}
                                    currentMainChatEmail={currentMainChatEmail}
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

                            <Panel id={'7'} order={7} defaultSize={40} minSize={25} maxSize={70}>
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
                                        currentThreadChatEmail={currentThreadChatEmail}
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