import { channelService } from "../../../services/channel/channelService";
import { v3ApiBaseURL } from "../../../services/v3Api";
import { MemberRole } from "../../../utils/memberRoles";

/**
 * Set a GM member's permission role (editor / viewer).
 *
 * Goes over v3 REST rather than the socket rail that `channelService`
 * uses for its other member writes: there is no `channel.member.role`
 * socket handler in genos-sockets, and adding one would make this a
 * three-repo change for a low-frequency admin action. This mirrors how
 * the GM profile-image upload already talks to a v3 REST endpoint
 * directly.
 *
 * The consequence is the same one that upload documents: no broadcast,
 * so OTHER members see the new role on their next `listChannels` /
 * `syncChannel` poll rather than instantly. We `syncChannel` here so the
 * acting user's own snapshot (and therefore the modal's roster) updates
 * immediately.
 */
export const setGMMemberRole = async (
    channelId: string,
    userId: string,
    memberRole: MemberRole,
    accessToken: string | null
): Promise<boolean> => {
    try {
        const res = await fetch(
            `${v3ApiBaseURL()}/api/v3/channels/${channelId}/members/${userId}/`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ member_role: memberRole }),
            }
        );
        if (!res.ok) {
            console.error("[setGMMemberRole] failed:", res.status, await res.text());
            return false;
        }
        // Refresh `snapshot.membersByChannel` so the modal — which
        // derives its roster from the snapshot — re-renders with the
        // new role instead of waiting for the next poll.
        await channelService.syncChannel(channelId);
        return true;
    } catch (error: unknown) {
        console.error("[setGMMemberRole] failed:", error);
        return false;
    }
};
