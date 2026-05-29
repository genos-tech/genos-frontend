import axios from "axios";

import { authApi } from "../../../services/api";
import { isLegacyNumericId } from "../../../utils/legacyId";

/**
 * Hard-delete the requester's GMMembers row. Owners are rejected
 * server-side and the Leave button is hidden client-side when the
 * requester is the GM owner.
 */
export const leaveGM = async (
    accessToken: string | null,
    gmId: number,
    attendeeId: string,
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    // PUNCH LIST (v3 chatId migration): `/gm/leave/` binds `gm_id` to
    // an integer field. v3 channel-leave goes through `channelService`
    // membership ops.
    if (!isLegacyNumericId(gmId)) {
        console.warn("[leaveGM] skipped: v3 UUID gmId, leave not persisted");
        setErrorMessage?.("This chat hasn't migrated yet — please retry from the v3 view.");
        return false;
    }
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.("Authorization token is missing.");
            return false;
        }
        await api.post("/gm/leave/", {
            gm_id: gmId,
            attendee_id: attendeeId,
        });
        return true;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            const msg = (error.response?.data as { error?: string })?.error;
            setErrorMessage?.(msg || `Failed to leave group (${error.response?.status}).`);
        } else {
            setErrorMessage?.("Unexpected error while leaving the group.");
        }
        return false;
    }
};
