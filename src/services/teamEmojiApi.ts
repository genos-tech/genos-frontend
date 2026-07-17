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
}

const handle = (e: unknown, label: string): null => {
    console.error(`[teamEmojiApi] ${label} failed:`, e);
    return null;
};

export const listTeamEmoji = async (accessToken: string, teamId: string): Promise<TeamEmoji[]> => {
    const api = authApi(accessToken);
    if (!api) return [];
    try {
        const res = await api.get(`/team-emoji/?team_id=${encodeURIComponent(teamId)}`);
        return (res.data?.teamEmoji ?? []) as TeamEmoji[];
    } catch (e) {
        handle(e, "list");
        return [];
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
