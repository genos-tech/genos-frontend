import axios from "axios";

import { addActivityMessage } from "../../features/chat/services/addActivityMessage";
import { authApi } from "../../services/api";
import { UserProps } from "../../types/admin";
import { ActivityMessageProps } from "../../types/chat";

self.onmessage = async (event) => {
    const accessToken: string = event.data.accessToken;
    const myself: UserProps = event.data.myself;
    const activityId: string = event.data.activityId;
    const isRead: boolean = event.data.isRead;
    const activityMessages: ActivityMessageProps[] = event.data.activityMessages;

    try {
        const api = authApi(accessToken);
        if (api) {
            await api.put("/chat/activity/read/", {
                team_id: myself.teamId,
                user_id: myself.userId,
                activity_id: activityId,
                is_read: isRead,
            });
            // Update to set isRead = true
            const updatedMessages = [...activityMessages]; // make a shallow copy
            const index = updatedMessages.findIndex((item) => item.activityId === activityId);
            if (index !== -1) {
                const readActivityMessage = {
                    ...updatedMessages[index],
                    isRead: true,
                };
                updatedMessages[index] = readActivityMessage;

                // Update the activity message in the indexedDB
                await addActivityMessage(readActivityMessage);
            }
            self.postMessage(updatedMessages);
        } else {
            console.error("Unauthorized. Auth toke is not found.");
            self.postMessage({ error: "Unauthorized. Auth toke is not found." });
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
        self.postMessage({ error: String(error) });
    }

    self.close(); // Terminates itself
};

export {};
