/**
 * Lands a live `activity.created` socket event into the activity IDB
 * store + lets the sidebar re-derive its row count on the next pop.
 *
 * The legacy `addActivityMessage` worker handler still does the
 * write; this adapter just converts the v3 wire shape to the legacy
 * `ActivityMessageProps` shape it expects.
 *
 * `myself` is pulled out of localStorage rather than passed through
 * `channelService` because this fires from the socket router (no React
 * context) and the activity row's `receiver` field has always been the
 * signed-in user — there's no cross-tenant ambiguity to resolve.
 */

import type { UserProps } from "../../../types/admin";
import { v3ActivityToLegacy } from "../adapters/v3ActivityToLegacy";
import { addActivityMessage } from "../components/sidebar/activity/services/addActivityMessage";

const EMPTY_USER: UserProps = {
    userId: "",
    userName: "",
    userEmail: "",
    teamId: "",
    teamName: "",
    avatarImgPath: "",
    tsLastSeen: "",
    tsJoined: "",
    isSystemUser: false,
};

function getMyself(): UserProps {
    return {
        ...EMPTY_USER,
        userId: localStorage.getItem("userId") || "",
        userName: localStorage.getItem("userName") || "",
        userEmail: localStorage.getItem("userEmail") || "",
        teamId: localStorage.getItem("teamId") || "",
        teamName: localStorage.getItem("teamName") || "",
        avatarImgPath: localStorage.getItem("avatarImgPath") || "",
    };
}

/** Event name dispatched on `window` after a v3 activity has landed
 *  in IDB. `useChatManagement` listens for this and calls
 *  `funcSetActivityMessages()` so the sidebar React state re-derives
 *  without waiting for the next mount / chat switch. The legacy WS
 *  handler used a direct `useCM.funcSetActivityMessages()` call from
 *  inside the handler — we can't do that from the socketRouter
 *  (no React context), hence the global event bus.
 */
export const V3_ACTIVITY_CREATED_EVENT = "v3:activity:created";

export async function handleV3Activity(payload: unknown): Promise<void> {
    try {
        const legacy = v3ActivityToLegacy(
            payload as Parameters<typeof v3ActivityToLegacy>[0],
            getMyself()
        );
        // eslint-disable-next-line no-console
        console.log("[handleV3Activity] adapted legacy row", legacy);
        await addActivityMessage(legacy);
        // eslint-disable-next-line no-console
        console.log("[handleV3Activity] IDB write done, dispatching window event");
        window.dispatchEvent(new CustomEvent(V3_ACTIVITY_CREATED_EVENT));
    } catch (e) {
        console.error("[handleV3Activity] failed", e);
    }
}
