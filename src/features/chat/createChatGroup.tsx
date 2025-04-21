import { Socket } from "socket.io-client";
import {
    AllChatProps,
    UserProps,
    ChatProps,
    MessageProps
} from '../../types/types';
import InsertGMChatWorker from "../../workers/insertGMChatWorker.ts?worker";
import InsertGMMessageWorker from "../../workers/insertGMMessageWorker.ts?worker";
import FetchSpecificGMMessagesWorker from "../../workers/fetchSpecificGMMessagesWorker.ts?worker";

const base_url = import.meta.env.VITE_API_BASE_URL;

type CreateCGResponse = {
    chatId: number,
    chatName: string,
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
                chatId: newGMChat.chatId,
                chatName: newGMChat.chatName,
                unread: false,
                isDm: false,
                dmPartnerUserId: null,
                latestMessage: newGMChat.latestMessage,
                latestMessageText: newGMChat.latestMessageText,
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
            moveToGMChat(newGMChat.chatId, newGMChat.chatName, setCurrentMainChat)
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
    chatId: number,
    chatName: string,
    setCurrentMainChat: (chat: ChatProps) => void
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const fetchSpecificGMMessagesWorker = new FetchSpecificGMMessagesWorker();
        fetchSpecificGMMessagesWorker.postMessage({
            chatId: chatId,
        });
        fetchSpecificGMMessagesWorker.onmessage = (event) => {
            const fetchedMessages: MessageProps[] = event.data;
            if (fetchedMessages !== undefined && fetchedMessages.length !== 0) {
                const newChat: ChatProps = {
                    chatId: chatId,
                    chatName: chatName,
                    isDm: false,
                    dmPartnerUserId: null,
                    unread: false,
                    messages: fetchedMessages,
                    latestMessage: fetchedMessages[fetchedMessages.length - 1],
                    latestMessageText: fetchedMessages[fetchedMessages.length - 1].contentText,
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
    accessToken: string,
): Promise<CreateCGResponse> {
    const userId = myself.userId;

    if (!base_url) {
        const errorMsg = "API base URL is not defined.";
        console.error(errorMsg);
        setCreateCGErrorMessage(errorMsg);
        setGroupName("");
        return { message: errorMsg, chatId: -1, chatName: "" };
    }

    try {
        const response = await fetch(`${base_url}/gm/create/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                group_email: `${chatName}@origin.tech`,
                group_name: chatName,
                owner_user: localStorage.getItem("userId"),
                owner_team: localStorage.getItem("teamId"),
            }),
        });

        const data: CreateCGResponse = await response.json();

        if (!response.ok) {
            const errorMsg = data.message;
            setCreateCGErrorMessage(errorMsg);
            setGroupName("");
            throw new Error(errorMsg);
        } else {
            socket.emit("join", {
                joiningCGId: data.chatId, // gm_id
                joiningCGName: data.chatName, // gm_name
                isDm: false,
                dmPartnerUserId: null,
            }, (ack: any) => {
                socket.emit("message", {
                    message: [{ type: "paragraph", content: [{ type: "text", text: "Created this group", styles: {} }] }, { type: "paragraph", content: [{ type: "text", text: "", styles: {} }] }],
                    destCGName: chatName,
                    destCGId: data.chatId,
                    isDm: false,
                    dmPartnerUserId: null,
                });
            });

            const newGMChat: AllChatProps = {
                chatId: data.chatId,
                chatName: chatName,
                isDm: false,
                dmPartnerUserId: null,
                unread: false,
                latestMessage: {
                    messageIdWithChatId: `${data.chatId}-1`,
                    chatId: data.chatId,
                    messageId: 1,
                    content: [{ type: "paragraph", content: [{ type: "text", text: "Created this group", styles: {} }] }, { type: "paragraph", content: [{ type: "text", text: "", styles: {} }] }],
                    contentText: "Created this group",
                    sender: myself,
                    tsSent: getCurrentTimestamp(),
                    numReplies: 0
                },
                latestMessageText: "Created this group",
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
        return { message: errorMsg, chatId: -1, chatName: "" };
    }

}

export default createChatGroup;
