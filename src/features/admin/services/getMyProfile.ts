import { authApi } from "../../../services/api";

/** The subset of `GET /api/v2/user/me/` (UserInfoView → UserSerializer) the
 *  self-echo reconciler reads back as authority. Snake_case = server wire. */
interface MyProfileWire {
    is_offline_forced?: boolean;
    custom_status?: string | null;
}

/** The mapped self-profile — the authoritative current values for the fields
 *  a user can change on any of their devices. */
export interface MyProfile {
    isOfflineForced: boolean;
    customStatus: string;
}

/**
 * Fetch the authenticated user's own authoritative profile. Used by
 * `useSelfEchoReconcile` to resolve a cross-device divergence: the presence
 * heartbeat only carries a possibly-stale echo, so the true current value is
 * read here (the server is the single source of truth). Returns `null` on any
 * failure — the caller then leaves local state untouched rather than guessing.
 */
export const getMyProfile = async (
    accessToken: string | null | undefined
): Promise<MyProfile | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.get<MyProfileWire>("/user/me/");
        return {
            isOfflineForced: res.data.is_offline_forced === true,
            customStatus: res.data.custom_status ?? "",
        };
    } catch (err) {
        console.warn("[presence] getMyProfile failed", err);
        return null;
    }
};
