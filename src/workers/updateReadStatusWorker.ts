import axios from "axios";

import { authApi } from "../services/api";
import { UserProps } from "../types/admin";

self.onmessage = async (event) => {
    const accessToken: string = event.data.accessToken;
    const myself: UserProps = event.data.myself;
    const chatType: number = event.data.chatType;
    const chatId: number = event.data.chatId;
    const isThread: boolean = event.data.isThread;
    const threadId: number = event.data.threadId;
    const lastReadMessageId: number = event.data.lastReadMessageId;

    try {
        const api = authApi(accessToken);
        if (api) {
            await api.put("/chat/read/", {
                user: myself.userId,
                chat_type: chatType,
                chat_id: chatId,
                is_thread: isThread,
                thread_id: threadId,
                last_read_message_id: lastReadMessageId,
            });
        } else {
            console.error("Unauthorized. Auth toke is not found.");
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 400) {
                console.error("HTTP 400 error:", error.response?.data);
            } else if (error.response?.status === 401) {
                console.error("HTTP 401 error:", error.response?.data);
            } else {
                console.error("API error:", error.response?.status, error.response?.data);
            }
        } else {
            console.error("Unexpected error:", error);
        }
    }

    self.postMessage("done");
};

export {};
