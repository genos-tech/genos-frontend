import { authApi } from "./api";

// Wire-shape mirroring `_serialize_emoji` in the Django view. `url` is
// absolute (the API applies the X-Forwarded-Proto https fixup) and gets
// baked verbatim into BlockNote bodies at insert time.
export interface TeamEmoji {
    emojiId: number;
    name: string;
    url: string;
    createdBy: string | null;
    tsCreatedAt: string | null;
    // True for the server-seeded global defaults (seed_default_emoji).
    // They work everywhere (picker, `:` suggestions, reactions) but the
    // Settings management panel hides them — defaults aren't
    // user-managed custom emoji. Optional so a frontend deployed ahead
    // of the API just behaves as before.
    isDefault?: boolean;
}

const handle = (e: unknown, label: string): null => {
    console.error(`[teamEmojiApi] ${label} failed:`, e);
    return null;
};

/** The team's catalog, or `null` when the request FAILED: `[]` is the server's
 *  answer "no emoji", and the two must not look alike (MIP-1305). */
export const listTeamEmoji = async (
    accessToken: string,
    teamId: string
): Promise<TeamEmoji[] | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.get(`/team-emoji/?team_id=${encodeURIComponent(teamId)}`, {
            suppressErrorToast: true,
        });
        return (res.data?.teamEmoji ?? []) as TeamEmoji[];
    } catch (e) {
        return handle(e, "list");
    }
};

export const createTeamEmoji = async (
    accessToken: string,
    payload: { teamId: string; name: string; file: File }
): Promise<TeamEmoji | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    const form = new FormData();
    form.append("team_id", payload.teamId);
    form.append("name", payload.name);
    form.append("file", payload.file);
    try {
        const res = await api.post(`/team-emoji/`, form, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return res.data as TeamEmoji;
    } catch (e) {
        return handle(e, "create");
    }
};

export const deleteTeamEmoji = async (accessToken: string, emojiId: number): Promise<boolean> => {
    const api = authApi(accessToken);
    if (!api) return false;
    try {
        await api.delete(`/team-emoji/?emoji_id=${emojiId}`);
        return true;
    } catch (e) {
        handle(e, "delete");
        return false;
    }
};

/**
 * The same DELETE for a page that is going away (the Undo window had not ended
 * when the tab closed): axios is abandoned with the page, a `fetch` with
 * `keepalive` is not. Fire and forget.
 */
export const deleteTeamEmojiOnExit = (accessToken: string, emojiId: number): void => {
    if (!accessToken || typeof fetch !== "function") return;
    try {
        void fetch(`${import.meta.env.VITE_API_BASE_URL}/team-emoji/?emoji_id=${emojiId}`, {
            method: "DELETE",
            keepalive: true,
            headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => undefined);
    } catch {
        // Never let this break a page transition.
    }
};
