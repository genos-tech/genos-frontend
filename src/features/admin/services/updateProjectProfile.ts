import axios from "axios";

import { fmt, getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";

/**
 * PUT /api/v2/project/ — change project name and/or owner. The existing
 * endpoint also handles `code`; this helper covers the owner-only
 * fields. Server re-checks ownership; the frontend gates the UI by the
 * same rule.
 */
export const updateProjectProfile = async (
    accessToken: string | null,
    projectId: number,
    updates: { projectName?: string; ownerId?: string },
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    const messages = getMessages();
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.(messages.admin.auth.errors.tokenMissing);
            return false;
        }
        const body: Record<string, unknown> = { project_id: projectId };
        if (updates.projectName !== undefined) body.project_name = updates.projectName;
        if (updates.ownerId !== undefined) body.owner_id = updates.ownerId;
        await api.put("/project/", body);
        return true;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            const msg = (error.response?.data as { error?: string })?.error;
            setErrorMessage?.(
                msg ||
                    fmt(messages.admin.serviceErrors.requestFailedStatus, {
                        status: error.response?.status ?? "unknown",
                    })
            );
        } else {
            setErrorMessage?.(messages.admin.serviceErrors.unexpected);
        }
        return false;
    }
};
