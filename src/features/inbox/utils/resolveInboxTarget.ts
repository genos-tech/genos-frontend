/**
 * Resolve what an inbox card is ABOUT, to something openable — or null.
 *
 * The routing ids ride in `itemOptionals` (`project_id`, `gm_id`), and a team
 * card's target is always the viewer's current team because the inbox GET is
 * team-scoped. So this reads what's already stored rather than touching the
 * card's `itemBody` — which means every EXISTING request card resolves, with
 * no migration.
 *
 * Requests (types 1-3) switch on `itemType`. ACTIVITY items (type 0) can't:
 * one item type covers every receipt, so their kind is inferred from which ids
 * are present — see `resolveActivityTarget`. Activities only started carrying
 * ids recently (api #76 + sockets #10), so older activity rows resolve to null
 * forever; the data was never captured and can't be backfilled.
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

type Optionals = InboxItemProps["itemOptionals"];

const findPmChat = (allChats: AllChatProps[], projectId: unknown) =>
    typeof projectId === "number"
        ? allChats.find((c) => c.chatType === 3 && c.project?.projectId === projectId)
        : undefined;

const findGmChat = (allChats: AllChatProps[], gmId: unknown) =>
    typeof gmId === "string" && gmId
        ? allChats.find((c) => c.chatType === 2 && c.chatId === gmId)
        : undefined;

/**
 * Activity items (`itemType` 0) have no type to switch on — one item type
 * covers "approved to join", "added you to", and every other receipt. So the
 * kind is inferred from WHICH ids are present, using the same keys the request
 * types store. That keeps one vocabulary across requests and activities
 * instead of inventing a parallel `target_kind` the request types don't have.
 *
 * Only the receipts whose target the reader can actually reach carry ids at
 * all (approved / added). Rejections and "waiting for approval" deliberately
 * store none — the reader isn't a member, so a link could only 404 — and land
 * here as null.
 *
 * Activity rows created before the ids were stored also land here as null:
 * they can never be retrofitted, because the data was never captured.
 */
const resolveActivityTarget = (
    opts: Optionals,
    allChats: AllChatProps[],
    currentTeamName: string
): ResolvedInboxTarget => {
    if (!opts) return null;

    const pmChat = findPmChat(allChats, opts.project_id);
    if (pmChat) {
        return { kind: "project", name: (opts.project_name as string) || pmChat.chatName, pmChat };
    }

    const gmChat = findGmChat(allChats, opts.gm_id);
    if (gmChat) {
        return { kind: "gm", name: (opts.gm_name as string) || gmChat.chatName, gmChat };
    }

    // Team last: it's the only kind with no id to match on, so checking it
    // first would swallow a project/GM activity that merely failed to resolve
    // and mislabel it as the current team.
    if (opts.team_name) {
        return { kind: "team", name: (opts.team_name as string) || currentTeamName };
    }

    return null;
};

export const resolveInboxTarget = (
    inboxItem: InboxItemProps,
    allChats: AllChatProps[],
    currentTeamName: string
): ResolvedInboxTarget => {
    const opts = inboxItem.itemOptionals;
    switch (inboxItem.itemType) {
        case 0:
            return resolveActivityTarget(opts, allChats, currentTeamName);
        case 1: {
            // No team id is stored, and none is needed: the inbox GET is
            // team-scoped, so a team request always targets the team in view.
            const name = (opts?.team_name as string) || currentTeamName;
            return name ? { kind: "team", name } : null;
        }
        case 2: {
            const pmChat = findPmChat(allChats, opts?.project_id);
            if (!pmChat) return null;
            return {
                kind: "project",
                name: (opts?.project_name as string) || pmChat.chatName,
                pmChat,
            };
        }
        case 3: {
            const gmChat = findGmChat(allChats, opts?.gm_id);
            if (!gmChat) return null;
            return { kind: "gm", name: (opts?.gm_name as string) || gmChat.chatName, gmChat };
        }
        // 4 = note access — it has its own open-note chip.
        default:
            return null;
    }
};
