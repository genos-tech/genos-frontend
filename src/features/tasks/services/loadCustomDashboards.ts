import { authApi } from "../../../services/api";

/**
 * "Custom dashboards by AI" tab (MIP-2356): the typed client for `GET /api/v2/schedules/dashboards/`.
 *
 * `own` are the member's own dashboard schedules, each with the HTML note it keeps up to date (null
 * until its first run, or when the note is gone). `shared` are dashboards of other members that the
 * note ACL lets this member read: only the note, its title and the owner's display name are sent,
 * never the schedule behind it. A note the member cannot open is not in either list.
 */

export type DashboardNote = {
    noteId: number;
    /** Always "personal" today: the HTML note viewer's `noteType` for it is 1. */
    noteType: string;
    title: string;
    /** The page sits in a team folder the member can open, so Notes shows it under Team Notes
     *  (MIP-2408). Absent from an API without it, which reads as false. */
    inTeamFolder?: boolean;
};

export type OwnDashboard = {
    scheduleId: string;
    name: string;
    enabled: boolean;
    lastRun: string | null;
    lastStatus: string;
    pausedReason?: string;
    note: DashboardNote | null;
    /** A run holds the schedule right now (MIP-2457). */
    running?: boolean;
};

export type SharedDashboard = DashboardNote & { ownerName: string };

export type CustomDashboards = { own: OwnDashboard[]; shared: SharedDashboard[] };

export type CustomDashboardsResult =
    | { status: "ready"; data: CustomDashboards }
    /** 404: an API without the endpoint yet, or a team the member is not in. */
    | { status: "unavailable" }
    | { status: "error" };

export const loadCustomDashboards = async (
    accessToken: string | null,
    teamId: string,
    signal?: AbortSignal
): Promise<CustomDashboardsResult> => {
    const api = authApi(accessToken);
    if (!api || !teamId) return { status: "error" };
    try {
        const res = await api.get<Partial<CustomDashboards>>("/schedules/dashboards/", {
            params: { team_id: teamId },
            signal,
            suppressErrorToast: true,
        });
        return {
            status: "ready",
            data: { own: res.data.own ?? [], shared: res.data.shared ?? [] },
        };
    } catch (error) {
        const code = (error as { response?: { status?: number } })?.response?.status;
        return { status: code === 404 ? "unavailable" : "error" };
    }
};
