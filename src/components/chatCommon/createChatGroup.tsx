import { Socket } from "socket.io-client";
import {
    AllChatProps,
    UserProps,
    ChatProps,
    MessageProps
} from '../../types';
import InsertGMChatWorker from "../../workers/insertGMChatWorker.ts?worker";
import InsertGMMessageWorker from "../../workers/insertGMMessageWorker.ts?worker";
import FetchSpecificGMMessagesWorker from "../../workers/fetchSpecificGMMessagesWorker.ts?worker";

const base_url = import.meta.env.VITE_API_BASE_URL;

type CreateCGResponse = {
    chatName: string,
    chatEmail: string,
    message: string,
};

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

const insertGMChatAndMessage = async (
    newGMChat: AllChatProps,
    allChats: AllChatProps[],
    setAllChats: (chat: AllChatProps[]) => void,
    setCurrentMainChat: (chat: ChatProps) => void,
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const insertGMMessageWorker = new InsertGMMessageWorker();
        insertGMMessageWorker.postMessage({ gmMessage: newGMChat.latestMessage });
        insertGMMessageWorker.onmessage = (event) => {
            resolve(event.data);
            insertGMMessageWorker.terminate();

            // Add the new GM to AllChat
            setAllChats([...allChats, {
                chatName: newGMChat.chatName,
                chatEmail: newGMChat.chatEmail,
                unread: false,
                isDm: false,
                latestMessage: newGMChat.latestMessage,
                TSLastMessage: getCurrentTimestamp()
            }]);
        };
        insertGMMessageWorker.onerror = (error) => {
            reject(error);
            insertGMMessageWorker.terminate();
        };

        // Insert the new message to indexedDb
        const insertGMChatWorker = new InsertGMChatWorker();
        insertGMChatWorker.postMessage({ gmChat: newGMChat });
        insertGMChatWorker.onmessage = (event) => {
            moveToGMChat(newGMChat.chatEmail, newGMChat.chatName, setCurrentMainChat)
            resolve(event.data);
            insertGMChatWorker.terminate();
        };
        insertGMChatWorker.onerror = (error) => {
            reject(error);
            insertGMChatWorker.terminate();
        };
    });
};

const moveToGMChat = async (
    chatEmail: string,
    chatName: string,
    setCurrentMainChat: (chat: ChatProps) => void
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const fetchSpecificGMMessagesWorker = new FetchSpecificGMMessagesWorker();
        fetchSpecificGMMessagesWorker.postMessage({
            chatEmail: chatEmail,
        });
        fetchSpecificGMMessagesWorker.onmessage = (event) => {
            const fetchedMessages: MessageProps[] = event.data;
            console.log("fetchedMessages:", fetchedMessages)
            if (fetchedMessages !== undefined && fetchedMessages.length !== 0) {
                const newChat: ChatProps = {
                    chatName: chatName,
                    chatEmail: chatEmail,
                    isDm: false,
                    unread: false,
                    messages: fetchedMessages,
                    latestMessage: fetchedMessages[fetchedMessages.length - 1],
                    TSLastMessage: fetchedMessages[fetchedMessages.length - 1].tsSent,
                };
                setCurrentMainChat(newChat)
            } else {
                console.error("Failed to fetch thread GM fetchedMessages:", fetchedMessages)
            }
            resolve(event.data);
            fetchSpecificGMMessagesWorker.terminate();
        };
        fetchSpecificGMMessagesWorker.onerror = (error) => {
            reject(error);
            fetchSpecificGMMessagesWorker.terminate();
        };
    });
};

async function createChatGroup(
    myself: UserProps,
    chatName: string,
    allChats: AllChatProps[],
    socket: Socket,
    setCreateCGErrorMessage: (msg: string) => void,
    setOpen: (e: boolean) => void,
    setGroupName: (e: string) => void,
    setAllChats: (chat: AllChatProps[]) => void,
    setCurrentMainChat: (chat: ChatProps) => void,
): Promise<CreateCGResponse> {

    const userEmail = myself.userEmail;
    const userName = myself.userName;

    if (!base_url) {
        const errorMsg = "API base URL is not defined.";
        console.error(errorMsg);
        setCreateCGErrorMessage(errorMsg);
        setGroupName("");
        return { message: errorMsg, chatName: "", chatEmail: "" };
    }

    try {
        const response = await fetch(`${base_url}/chatGroup/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ userEmail, chatName }),
        });

        const data: CreateCGResponse = await response.json();

        if (!response.ok) {
            const errorMsg = data.message || "Chat group creation failed";
            setCreateCGErrorMessage(errorMsg);
            setGroupName("");
            throw new Error(errorMsg);
        } else {
            socket.emit("join", {
                joiningCGEmail: data.chatEmail,
                joiningCGName: data.chatName,
                isDm: false,
                userEmail: userEmail
            }, (ack: any) => {
                socket.emit("message", {
                    message: `${userName} created`,
                    destCGName: chatName,
                    destCGEmail: data.chatEmail,
                    isDm: false,
                });
            });

            const newGMChat: AllChatProps = {
                chatName: chatName,
                chatEmail: data.chatEmail,
                isDm: false,
                unread: false,
                latestMessage: {
                    messageIdWithChatEmail: `${data.chatEmail}-1`,
                    messageId: '1',
                    chatEmail: data.chatEmail,
                    content: `${userName} created`,
                    sender: myself,
                    tsSent: getCurrentTimestamp(),
                },
                TSLastMessage: getCurrentTimestamp(),
            }
            insertGMChatAndMessage(newGMChat, allChats, setAllChats, setCurrentMainChat)

            setOpen(false);
            setCreateCGErrorMessage("");
            setGroupName("");
            return data;
        }
    } catch (error) {
        const errorMsg =
            error instanceof Error
                ? error.message
                : "An unknown error occurred during chat group creation.";

        console.error(errorMsg);
        setCreateCGErrorMessage(errorMsg);
        setGroupName("");
        return { message: errorMsg, chatName: "", chatEmail: "" };
    }

}

export default createChatGroup;
