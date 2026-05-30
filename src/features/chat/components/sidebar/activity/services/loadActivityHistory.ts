import axios from "axios";

import { authApi } from "../../../../../../services/api";
import { UserProps } from "../../../../../../types/admin";
import { ActivityMessageProps } from "../../../../../../types/chat";

// Default lookback for the FULL-load path. Once a checkpoint exists,
// the server uses it as the lower bound instead — no day cap applies.
const periodDays: number = 30;

export interface ActivityDeltaItem extends ActivityMessageProps {
    isDeleted?: boolean;
}

export interface ActivityDeltaResponse {
    serverTime: string;
    activity: ActivityDeltaItem[];
    forceFull?: boolean;
}

export const loadActivityHistory = async (
    _myself: UserProps,
    _accessToken: string | null,
    _since: string | null
): Promise<ActivityDeltaResponse | undefined> => {
    // The legacy `/chat/activity/history/` endpoint was deleted in
    // Phase 3 of the legacy-chat retirement. The activity feed will
    // be re-introduced on the v3 schema in a follow-up; until then,
    // this loader returns an empty delta so the sidebar renders an
    // empty state rather than 404-spamming on every initial load.
    return {
        serverTime: new Date().toISOString(),
        activity: [],
        forceFull: false,
    };
};
// Imports retained for the public type surface; suppress unused-warning.
void axios;
void periodDays;
