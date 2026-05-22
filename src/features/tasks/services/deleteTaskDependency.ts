import axios from "axios";

import { authApi } from "../../../services/api";

export const deleteTaskDependency = async (
    dependencyId: number,
    accessToken: string | null
): Promise<{ ok: boolean; error?: string }> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            return { ok: false, error: "Unauthorized." };
        }
        await api.delete(`/task/dependency/${dependencyId}/`);
        return { ok: true };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            const msg =
                (error.response?.data as { error?: string } | undefined)?.error ??
                "Failed to delete dependency.";
            return { ok: false, error: msg };
        }
        return { ok: false, error: "Unexpected error." };
    }
};
