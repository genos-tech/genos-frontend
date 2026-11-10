import { channelService } from "./channelService";

/** What genos-sockets sends to the removed person's own room (MIP-1371). */
export type MembershipRemovedNotice = {
    scope: "team" | "project" | "channel";
    teamId: string;
    projectIds: number[];
    channels: { kind: number; id: string }[];
};

/**
 * An owner or editor removed this person from a team, project or chat.
 *
 * By the time this arrives the server has already taken their open sockets out of the rooms,
 * so nothing more is delivered. What is left is the app's own state:
 *
 *  - removed from the team they are working in: the whole workspace is gone, so forget the
 *    saved team and load the app again, which picks another team (or the onboarding when
 *    there is none). Anything less would leave a screen of data they can no longer fetch.
 *  - anything else: the chat list is re-read from the server (`listChannels` evicts what the
 *    server no longer lists), and `genos:membership-removed` is dispatched for screens that
 *    keep their own lists. The project list refreshes on the team change feed, which the
 *    removal bumps.
 */
export const handleMembershipRemoved = (notice: MembershipRemovedNotice): void => {
    if (!notice || typeof notice !== "object") return;
    if (notice.scope === "team" && notice.teamId === localStorage.getItem("teamId")) {
        localStorage.removeItem("teamId");
        window.location.assign("/workspace");
        return;
    }
    void channelService.listChannels().catch(() => {
        /* the next sync reconciles it */
    });
    window.dispatchEvent(new CustomEvent("genos:membership-removed", { detail: notice }));
};
