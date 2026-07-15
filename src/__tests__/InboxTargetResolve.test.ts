/**
 * `resolveInboxTarget` — what a join request is FOR, and whether it's openable.
 *
 * The ids were already on the wire (`itemOptionals.project_id` / `gm_id`); a
 * team request's target is always the viewer's current team, since the inbox
 * GET is team-scoped. Nothing here touches the stored `itemBody`, so existing
 * request cards resolve too.
 *
 * The lookups are asymmetric and easy to get backwards: `gm_id` is a v3
 * Channel UUID (matches `chat.chatId`), while `project_id` is the LEGACY
 * integer — post-v3 `chatId` is the channel UUID, so a project must match on
 * `chat.project.projectId` instead. Matching a project on `chatId` is exactly
 * the bug that made the task-header project icon vanish.
 *
 * Unresolvable must return null: the caller renders plain text rather than a
 * chip that opens nothing.
 */
import { describe, expect, it } from "vitest";

import {
    inboxItemNamesAMissingChat,
    resolveInboxTarget,
} from "../features/inbox/utils/resolveInboxTarget";
import type { AllChatProps } from "../types/chat";
import type { InboxItemProps } from "../types/common";

const item = (itemType: number, itemOptionals: Record<string, unknown> | null): InboxItemProps =>
    ({ itemId: 1, itemBody: [], itemType, itemOptionals }) as unknown as InboxItemProps;

const PM_CHAT = {
    chatId: "pm-channel-uuid",
    chatType: 3,
    chatName: "PM name from chat",
    project: { projectId: 42 },
} as unknown as AllChatProps;

const GM_CHAT = {
    chatId: "gm-channel-uuid",
    chatType: 2,
    chatName: "GM name from chat",
} as unknown as AllChatProps;

const CHATS = [PM_CHAT, GM_CHAT];

describe("resolveInboxTarget", () => {
    it("resolves a team request to the current team", () => {
        expect(resolveInboxTarget(item(1, { team_name: "Genos" }), CHATS, "Fallback")).toEqual({
            kind: "team",
            name: "Genos",
        });
    });

    it("falls back to the current team name when the request stored none", () => {
        expect(resolveInboxTarget(item(1, {}), CHATS, "Current Team")).toEqual({
            kind: "team",
            name: "Current Team",
        });
    });

    it("resolves a project request via project.projectId, not chatId", () => {
        const res = resolveInboxTarget(
            item(2, { project_id: 42, project_name: "Apollo" }),
            CHATS,
            ""
        );
        expect(res).toMatchObject({ kind: "project", name: "Apollo" });
        expect(res && "pmChat" in res && res.pmChat.chatId).toBe("pm-channel-uuid");
    });

    it("resolves a GM request via the channel UUID", () => {
        const res = resolveInboxTarget(
            item(3, { gm_id: "gm-channel-uuid", gm_name: "Squad" }),
            CHATS,
            ""
        );
        expect(res).toMatchObject({ kind: "gm", name: "Squad" });
        expect(res && "gmChat" in res && res.gmChat.chatId).toBe("gm-channel-uuid");
    });

    it("returns null when the project isn't in the viewer's chats", () => {
        expect(resolveInboxTarget(item(2, { project_id: 999 }), CHATS, "")).toBeNull();
    });

    it("returns null when the GM isn't in the viewer's chats", () => {
        expect(resolveInboxTarget(item(3, { gm_id: "nope" }), CHATS, "")).toBeNull();
    });

    it("does not mistake a project id for a channel id", () => {
        // A PM row's chatId is a UUID; project_id is an integer. If the
        // lookup ever matched on chatId, this would resolve.
        expect(
            resolveInboxTarget(item(2, { project_id: "pm-channel-uuid" }), CHATS, "")
        ).toBeNull();
    });

    // Activity items (type 0) have no type to switch on — one item type
    // covers every receipt — so the kind is inferred from WHICH ids are
    // present. Only receipts whose target the reader can reach carry ids
    // (approved / added); rejections and "waiting for approval" store none.
    it("resolves an activity naming a project", () => {
        const res = resolveInboxTarget(
            item(0, { project_id: 42, project_name: "Apollo" }),
            CHATS,
            "Team"
        );
        expect(res).toMatchObject({ kind: "project", name: "Apollo" });
    });

    it("resolves an activity naming a GM", () => {
        const res = resolveInboxTarget(
            item(0, { gm_id: "gm-channel-uuid", gm_name: "Squad" }),
            CHATS,
            "Team"
        );
        expect(res).toMatchObject({ kind: "gm", name: "Squad" });
    });

    it("resolves an activity naming a team", () => {
        expect(resolveInboxTarget(item(0, { team_name: "Genos" }), CHATS, "Team")).toEqual({
            kind: "team",
            name: "Genos",
        });
    });

    it("does not mislabel an unresolvable project activity as the team", () => {
        // A project the reader can't see must render nothing — NOT fall
        // through to the current team, which would name the wrong object
        // entirely. This is why team is checked last.
        expect(resolveInboxTarget(item(0, { project_id: 999 }), CHATS, "Team")).toBeNull();
    });

    it("returns null for an activity with no optionals — rows predating the ids", () => {
        // Rejections and pre-#76 rows. They can never be retrofitted: the
        // data was never captured.
        expect(resolveInboxTarget(item(0, null), CHATS, "Team")).toBeNull();
        expect(resolveInboxTarget(item(0, {}), CHATS, "Team")).toBeNull();
    });

    it("returns null for a note-access request (it has its own open-note chip)", () => {
        expect(
            resolveInboxTarget(item(4, { note_id: 3, note_type: 1 }), CHATS, "Team")
        ).toBeNull();
    });

    it("survives missing optionals on a project/GM request", () => {
        expect(resolveInboxTarget(item(2, null), CHATS, "")).toBeNull();
        expect(resolveInboxTarget(item(3, null), CHATS, "")).toBeNull();
    });

    it("falls back to the chat's own name when the request stored no target name", () => {
        expect(resolveInboxTarget(item(2, { project_id: 42 }), CHATS, "")).toMatchObject({
            name: "PM name from chat",
        });
        expect(resolveInboxTarget(item(3, { gm_id: "gm-channel-uuid" }), CHATS, "")).toMatchObject(
            {
                name: "GM name from chat",
            }
        );
    });
});

/**
 * "This card says I'm in something my chat list doesn't have."
 *
 * Nothing pushes a new PM channel to a user who was just added: the add lands
 * via `POST /project/join/` and the `_sync_pm_channel_member` Django signal,
 * which emits to no socket, and `allChats` otherwise only reloads on boot and
 * on wake. So an added user's chat list is stale for the whole session — the
 * project chat never appears in their sidebar, and the card's chip has no row
 * to resolve. The card is the notification the chat list never got.
 */
describe("inboxItemNamesAMissingChat", () => {
    it("fires for an activity naming a project we do not have", () => {
        expect(inboxItemNamesAMissingChat(item(0, { project_id: 999 }), CHATS)).toBe(true);
    });

    it("fires for an activity naming a GM we do not have", () => {
        expect(inboxItemNamesAMissingChat(item(0, { gm_id: "unknown-uuid" }), CHATS)).toBe(true);
    });

    it("does NOT fire when we already hold the chat — no pointless refetch", () => {
        expect(inboxItemNamesAMissingChat(item(0, { project_id: 42 }), CHATS)).toBe(false);
        expect(inboxItemNamesAMissingChat(item(0, { gm_id: "gm-channel-uuid" }), CHATS)).toBe(
            false
        );
    });

    it("does NOT fire for a request — it goes to the owner, who has the chat", () => {
        expect(inboxItemNamesAMissingChat(item(2, { project_id: 999 }), CHATS)).toBe(false);
        expect(inboxItemNamesAMissingChat(item(3, { gm_id: "unknown-uuid" }), CHATS)).toBe(false);
    });

    it("does NOT fire for an activity carrying no ids", () => {
        // Rejections, and rows predating the ids. Nothing to look up.
        expect(inboxItemNamesAMissingChat(item(0, null), CHATS)).toBe(false);
        expect(inboxItemNamesAMissingChat(item(0, {}), CHATS)).toBe(false);
    });

    it("does NOT fire for a team activity — you can't see a team inbox you're not in", () => {
        expect(inboxItemNamesAMissingChat(item(0, { team_name: "Genos" }), CHATS)).toBe(false);
    });

    it("agrees with resolveInboxTarget: refresh exactly when the chip can't resolve", () => {
        // The two must never disagree, or we'd either refetch forever or
        // leave a chip permanently dead. Same matching rules, by construction.
        const missing = item(0, { project_id: 999 });
        expect(resolveInboxTarget(missing, CHATS, "Team")).toBeNull();
        expect(inboxItemNamesAMissingChat(missing, CHATS)).toBe(true);

        const present = item(0, { project_id: 42 });
        expect(resolveInboxTarget(present, CHATS, "Team")).not.toBeNull();
        expect(inboxItemNamesAMissingChat(present, CHATS)).toBe(false);
    });
});
