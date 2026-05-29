import axios from "axios";

import { authApi } from "../../../services/api";
import { isLegacyNumericId } from "../../../utils/legacyId";

export const sendMDMMessage = async (
    accessToken: string | null,
    mdmId: number,
    senderId: string,
    messageBody: any[],
    setErrorMessage?: (value: string) => void,
    isInit?: boolean
) => {
    // PUNCH LIST (v3 chatId migration): `/mdm/message/` binds `mdm_id`
    // to an integer field. v3 MDM sends go through `channelService.send`.
    if (!isLegacyNumericId(mdmId)) {
        console.warn("[sendMDMMessage] skipped: v3 UUID chatId, message not sent");
        setErrorMessage?.("This chat hasn't migrated yet — please retry from the v3 view.");
        return;
    }
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/mdm/message/", {
                mdm_id: mdmId,
                sender_id: senderId,
                message_body: messageBody,
                is_init: isInit || false,
            });
            return res.data;
        } else {
            console.error("Unauthorized. Auth token is not found.");
            if (setErrorMessage) {
                setErrorMessage("Unauthorized. Auth token is not found.");
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
