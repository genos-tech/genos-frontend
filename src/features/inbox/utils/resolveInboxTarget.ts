/**
 * Resolve what a join request is FOR, to something openable — or null.
 *
 * The routing ids are already on the wire in `itemOptionals` (`project_id`,
 * `gm_id`), and a team request's target is always the viewer's current team
 * because the inbox GET is team-scoped. So this reads what's already stored
 * rather than touching the request's `itemBody` — which also means every
 * EXISTING request card resolves, with no migration.
 *
 * The two id lookups are asymmetric and easy to get backwards:
 *
 *   - `gm_id` is a v3 **Channel UUID** → matches `chat.chatId`.
 *   - `project_id` is the **legacy integer**. Post-v3 `chat.chatId` is the
 *     channel UUID, so a project must match on the id the adapter carries in
 *     `chat.project.projectId`. Matching a project on `chatId` is exactly the
 *     bug that made the task-header project icon disappear.
 *
 * Returns null when the target can't be resolved, so the caller can render
 * plain text instead of a chip that opens nothing.
 */
import type { AllChatProps } from "../../../types/chat";
import type { InboxItemProps } from "../../../types/common";

export type ResolvedInboxTarget =
    | { kind: "team"; name: string }
    | { kind: "project"; name: string; pmChat: AllChatProps }
    | { kind: "gm"; name: string; gmChat: AllChatProps }
    | null;

export const resolveInboxTarget = (
    inboxItem: InboxItemProps,
    allChats: AllChatProps[],
    currentTeamName: string
): ResolvedInboxTarget => {
    const opts = inboxItem.itemOptionals;
    switch (inboxItem.itemType) {
        case 1: {
            // No team id is stored, and none is needed: the inbox GET is
            // team-scoped, so a team request always targets the team in view.
            const name = (opts?.team_name as string) || currentTeamName;
            return name ? { kind: "team", name } : null;
        }
        case 2: {
            const projectId = opts?.project_id;
            if (typeof projectId !== "number") return null;
            const pmChat = allChats.find(
                (c) => c.chatType === 3 && c.project?.projectId === projectId
            );
            if (!pmChat) return null;
            return {
                kind: "project",
                name: (opts?.project_name as string) || pmChat.chatName,
                pmChat,
            };
        }
        case 3: {
            const gmId = opts?.gm_id;
            if (typeof gmId !== "string" || !gmId) return null;
            const gmChat = allChats.find((c) => c.chatType === 2 && c.chatId === gmId);
            if (!gmChat) return null;
            return { kind: "gm", name: (opts?.gm_name as string) || gmChat.chatName, gmChat };
        }
        // 0 = activity (stores no optionals), 4 = note access (has its own
        // open-note chip).
        default:
            return null;
    }
};
