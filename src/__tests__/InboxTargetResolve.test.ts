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

import { resolveInboxTarget } from "../features/inbox/utils/resolveInboxTarget";
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

    it("returns null for activity items — they store no optionals", () => {
        expect(resolveInboxTarget(item(0, null), CHATS, "Team")).toBeNull();
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
