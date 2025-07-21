import axios from "axios";

import { authApi } from "../../../services/api";

export const sendDMMessage = async (
    accessToken: string | null,
    dmId: number,
    senderId: string,
    receiverId: string,
    messageBody: any[],
    setErrorMessage?: (value: string) => void,
    isInit?: boolean
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/dm/message/", {
                dm_id: dmId,
                sender_id: senderId,
                receiver_id: receiverId,
                message_body: messageBody,
                is_init: true ? isInit : false,
            });
            return res.data;
        } else {
            console.error("Unauthorized. Auth toke is not found.");
            if (setErrorMessage) {
                setErrorMessage("Unauthorized. Auth toke is not found.");
            }
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 400) {
                console.error("HTTP 400 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage("Message Id already exists.");
                }
            } else if (error.response?.status === 401) {
                console.error("HTTP 401 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage("Unauthorized. Please log in again.");
                }
            } else {
                console.error("API error:", error.response?.status, error.response?.data);
            }
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
