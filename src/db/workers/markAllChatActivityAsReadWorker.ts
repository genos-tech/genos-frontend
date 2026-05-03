import axios from "axios";

import { authApi } from "../../services/api";
import { UserProps } from "../../types/admin";
import { ActivityMessageProps } from "../../types/chat";
import { ActivityService } from "../services/activity.service";

self.onmessage = async (event) => {
    const accessToken: string = event.data.accessToken;
    const myself: UserProps = event.data.myself;
    const chatType: number = event.data.chatType;
    const chatId: number = event.data.chatId;
    const activityMessages: ActivityMessageProps[] = event.data.activityMessages;

    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("Unauthorized. Auth token is not found.");
            self.postMessage({ error: "Unauthorized. Auth token is not found." });
            self.close();
            return;
        }

        await api.put("/chat/activity/read/all/", {
            team_id: myself.teamId,
            user_id: myself.userId,
            chat_type: chatType,
            chat_id: chatId,
        });

        // Build the next array, flipping every still-unread entry that belongs
        // to this chat. We deliberately don't filter by `isThread` — the
        // backend clears thread + inline activities together, so the local
        // mirror must match.
        const affected: ActivityMessageProps[] = [];
        const updatedMessages: ActivityMessageProps[] = activityMessages.map((a) => {
            if (a.chatType === chatType && a.chatId === chatId && a.isRead === false) {
                const next = { ...a, isRead: true };
                affected.push(next);
                return next;
            }
            return a;
        });

        if (affected.length > 0) {
            const activityService = new ActivityService();
            await activityService.batchInsertActivityMessages(affected);
        }

        self.postMessage(updatedMessages);
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
        self.postMessage({ error: String(error) });
    }

    self.close();
};

export {};
