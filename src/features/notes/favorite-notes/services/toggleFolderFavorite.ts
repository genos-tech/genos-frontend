import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";

// Star / unstar a note folder (MIP-747). Resolves to the folder's new
// favorite state, or null when the request failed (the caller keeps the
// old state).
export const setFolderFavorite = async (
    myself: UserProps,
    folderId: number,
    favorite: boolean,
    accessToken: string | null
): Promise<boolean | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        if (favorite) {
            await api.post("/note/favorite/folder/", {
                team_id: myself.teamId,
                user_id: myself.userId,
                folder_id: folderId,
            });
            return true;
        }
        await api.delete("/note/favorite/folder/", {
            params: { team_id: myself.teamId, user_id: myself.userId, folder_id: folderId },
        });
        return false;
    } catch (error) {
        console.error("Folder favorite failed:", error);
        return null;
    }
};
