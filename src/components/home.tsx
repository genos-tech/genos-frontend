import { useState, useEffect } from "react";
import Sheet from '@mui/joy/Sheet';
import { io, Socket } from "socket.io-client";
import SplitMessagesPane from './chatCommon/splitMessagesPane';
import ThreadPane from './thread/threadPane';
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
import InsertDMMessageWorker from "../workers/insertDMMessageWorker.ts?worker";
import InsertDMThreadMessageWorker from "../workers/insertDMThreadMessageWorker.ts?worker";
import InsertGMMessageWorker from "../workers/insertGMMessageWorker.ts?worker";
import InsertGMThreadMessageWorker from "../workers/insertGMThreadMessageWorker.ts?worker";

const ws_url = import.meta.env.VITE_WS_BASE_URL;
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
    auth: {
        token: localStorage.getItem("token")
    }
});

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

type HomeProps = {
    myself: UserProps;
    currentMainChat: ChatProps,
    setCurrentMainChat: (chat: ChatProps) => void;
};

export default function Home(props: HomeProps) {
    const { myself,
        currentMainChat,
        setCurrentMainChat,
    } = props;
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
    const [isRightSideVisible, setIsRightSideVisible] = useState(false);

    //////////////////////////////////////////////////////////////////////////////////
    // // IMPROVED VERSION
    // const worker = new CurrentMessageUpdateWorker();
    // const workerRef = useRef<Worker | null>(null);
    // useEffect(() => {
    //     workerRef.current = worker;
    //     workerRef.current.onmessage = (event) => {
    //         setCurrentMainChat((prev) => ({
    //             ...prev,
    //             messages: event.data, // Update messages from worker
    //         }));
    //     };
    //     return () => workerRef.current?.terminate();
    // }, []);

    // useEffect(() => {
    //     if (wsMessage !== undefined) {
    //         if (wsMessage.isDm === true) {
    //             if (wsMessage.isThread === true) {
    //                 // DM Thread
    //             } else {
    //                 // DM
    //                 workerRef.current?.postMessage({
    //                     messages: currentMainChat.messages, // Why not Sub, why Main??
    //                     newMessage: {
    //                         messageId: wsMessage.messageId,
    //                         content: wsMessage.content,
    //                         sender: wsMessage.sender,
    //                         tsSent: wsMessage.tsSent,
    //                     },
    //                 });
    //             }
    //         }
    //     }
    // }, [wsMessage]);
    //////////////////////////////////////////////////////////////////////////////////

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
            console.log("Connected to WebSocket");

            // Join to initial user room
            socket.emit("join", {
                joiningCGEmail: myself.userEmail,
                joiningCGName: myself.userName,
                isDm: true,
                userEmail: myself.userEmail
            });

        });

        var incomingChatEmail: string = ""

        socket.on("message", (message) => {
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
                            tsSent: newMessage.tsSent,
                        }
                        insertDMMessage(newDMMessage)
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
                            tsSent: newMessage.tsSent,
                        }
                        insertGMMessage(newGMMessage)
                    }
                }
            }
        });
        return () => {
            socket.off("message");
            socket.off("connect");
        };
    }, []);


    ////////////////////////////////////////////////////////////////////
    // useEffect(() => {
    //     console.log("allChats Updated:", allChats);
    // }, [allChats]);

    // useEffect(() => {
    //     console.log("initLoad Updated:", initLoad);
    // }, [initLoad]);

    // useEffect(() => {
    //     console.log("currentMainChat Updated:", currentMainChat);
    // }, [currentMainChat]);

    // useEffect(() => {
    //     console.log("isSubChatVisible Updated:", isSubChatVisible);
    // }, [isSubChatVisible]);

    // useEffect(() => {
    //     console.log("isRightSideVisible Updated:", isRightSideVisible);
    // }, [isRightSideVisible]);

    // useEffect(() => {
    //     console.log("currentThreadChat is updated:", currentThreadChat)
    // }, [currentThreadChat]);
    ////////////////////////////////////////////////////////////////////


    return (
        <Sheet
            sx={{
                height: { xs: 'calc(100dvh - var(--Header-height))', md: '100dvh' },
                display: 'flex',
            }}
        >
            {/* Left Side Pane */}
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

            {/* Main Pane */}
            <Sheet
                sx={{
                    position: { xs: 'fixed', sm: 'sticky' },
                    zIndex: 100,
                    top: 10,
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    height: '100vh', // Ensure Sheet takes full viewport height
                    minHeight: 0, // Prevents height issues in flex container
                }}
            >
                <SplitMessagesPane
                    chat={currentMainChat}
                    subChat={currentSubChat}
                    myself={myself}
                    socket={socket}
                    setIsSubChatVisible={setIsSubChatVisible}
                    isSubChatVisible={isSubChatVisible}
                    setCurrentMainChat={setCurrentMainChat}
                    setCurrentSubChat={setCurrentSubChat}
                    setCurrentThreadChat={setCurrentThreadChat}
                    setIsRightSideVisible={setIsRightSideVisible}
                />
            </Sheet>

            {/* Right Side Pane */}
            {isRightSideVisible && currentThreadChat !== undefined && (
                <Sheet
                    sx={{
                        display: { xs: 'none', md: 'flex' },
                        position: { md: 'fixed', lg: 'sticky' },
                        transform: {
                            md: 'translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1)))',
                            lg: 'none',
                        },
                        transition: 'width 0.4s',
                        zIndex: 100,
                        top: 10,
                        flex: 1,
                        minHeight: 0,
                        flexDirection: 'column-reverse',
                        borderLeft: 2,
                        borderLeftColor: 'LightGray'
                    }}
                >
                    <ThreadPane
                        thread={currentThreadChat}
                        myself={myself}
                        socket={socket}
                        setCurrentThreadChat={setCurrentThreadChat}
                        setIsRightSideVisible={setIsRightSideVisible}
                    />
                </Sheet>)}

        </Sheet>

    );
}