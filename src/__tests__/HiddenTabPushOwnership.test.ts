/**
 * Who notifies when the tab is hidden.
 *
 * The rule: for categories the server pushes, the service worker owns the
 * card and the page must stay quiet, or the user sees two. This only
 * became safe once hiding a tab clears presence immediately — before
 * that, the server suppressed push for up to 90s and the page's own
 * notification was the only thing covering the gap.
 *
 * Both directions are failures, and both are silent in review:
 *   - a category here the server does NOT push -> nobody notifies
 *   - a pushed category missing here           -> two cards
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NotificationCategory } from "../services/notifications/categories";
import { NotificationManager } from "../services/notifications/notificationManager";

const hide = () =>
    vi
        .spyOn(document, "visibilityState", "get")
        .mockReturnValue("hidden" as DocumentVisibilityState);

function dispatch(category: NotificationCategory, id: string) {
    const manager = new NotificationManager({ currentUserId: "me" });
    // Stand in for "this browser can receive Web Push", which is what
    // makes the page defer.
    manager.setPushActive(true);
    return manager.notify({
        id,
        category,
        title: "t",
        body: "b",
    } as Parameters<NotificationManager["notify"]>[0]);
}

describe("hidden-tab notification ownership", () => {
    let hidden: ReturnType<typeof hide>;

    beforeEach(() => {
        hidden?.mockRestore();
        hidden = hide();
    });

    it("yields to Web Push for a plain chat message", () => {
        // `chats` was the gap: the server pushes it, the page also raised
        // a card, so a backgrounded-but-not-yet-suspended tab double-notified.
        expect(dispatch("chats", "chat:1:c1:m1")).toBe("ignored-push-owned");
    });

    it.each<NotificationCategory>([
        "mention_chat",
        "mention_thread",
        "mention_task_body",
        "mention_task_comment",
        "mention_note_my",
        "mention_note_task",
        "mention_note_chat",
        "thread_replies",
        "task_comments",
        "inbox",
    ])("yields to Web Push for %s", (category) => {
        expect(dispatch(category, `${category}:x`)).toBe("ignored-push-owned");
    });

    it("still raises its own card for agent_run_done", () => {
        // Deliberately NOT push-owned: the server adds a duration floor
        // the page can't see, so deferring could mean nobody notifies.
        // De-duplicated by a shared tag instead.
        expect(dispatch("agent_run_done", "agent_run_done:spotlight:1")).not.toBe(
            "ignored-push-owned"
        );
    });
});
