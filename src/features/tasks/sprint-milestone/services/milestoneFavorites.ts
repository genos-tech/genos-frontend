import axios from "axios";

import { authApi } from "../../../../services/api";
import { MilestoneFavoritesResponse } from "../types";

// Milestone favorites (MIP-1053): private to the caller. Each resolves to
// `undefined` / `false` on failure (logged), like the milestone folder
// services, so a caller can tell "failed" from "empty".

const logError = (label: string, error: unknown) => {
    if (axios.isAxiosError(error)) {
        console.error(label, error.response?.status, error.response?.data);
    } else {
        console.error(label, error);
    }
};

export const loadMilestoneFavorites = async (
    accessToken: string | null
): Promise<MilestoneFavoritesResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) return;
        const res = await api.get("/milestone/favorite/list/");
        return res.data;
    } catch (error) {
        logError("loadMilestoneFavorites error:", error);
    }
};

/** Star (`true`) or unstar (`false`). Resolves to whether the server now has it
 *  starred, or `null` when the call failed. Unstarring one that is already gone
 *  is a 404, which counts as done. */
export const setMilestoneFavorite = async (
    milestoneId: number,
    favorited: boolean,
    accessToken: string | null
): Promise<boolean | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        if (favorited) {
            await api.post("/milestone/favorite/", { milestone_id: milestoneId });
            return true;
        }
        await api.delete("/milestone/favorite/", { params: { milestone_id: milestoneId } });
        return false;
    } catch (error) {
        if (!favorited && axios.isAxiosError(error) && error.response?.status === 404) {
            return false;
        }
        logError("setMilestoneFavorite error:", error);
        return null;
    }
};

/** Tell the server the user opened a milestone, so a favorite moves up the list. */
export const markMilestoneOpened = async (
    milestoneId: number,
    accessToken: string | null
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) return false;
        const res = await api.post("/milestone/favorite/opened/", { milestone_id: milestoneId });
        return !!res.data?.isFavorited;
    } catch (error) {
        logError("markMilestoneOpened error:", error);
        return false;
    }
};
