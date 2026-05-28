import axios from "axios";

import { authApi } from "../../../services/api";

/**
 * PUT /api/v2/gm/profile/ — change GM name and/or owner_user. Server
 * enforces that only the current owner can call this; the frontend
 * gates the UI by the same rule.
 */
export const updateGMProfile = async (
    accessToken: string | null,
    gmId: number,
    updates: { gmName?: string; ownerUserId?: string },
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.("Authorization token is missing.");
            return false;
        }
        const body: Record<string, unknown> = { gm_id: gmId };
        if (updates.gmName !== undefined) body.group_name = updates.gmName;
        if (updates.ownerUserId !== undefined) body.owner_user_id = updates.ownerUserId;
        await api.put("/gm/profile/", body);
        return true;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            const msg = (error.response?.data as { error?: string })?.error;
            setErrorMessage?.(msg || `Failed to update group (${error.response?.status}).`);
        } else {
            setErrorMessage?.("Unexpected error while updating the group.");
        }
        return false;
    }
};
