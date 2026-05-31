import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// notificationApi mocks the axios `authApi` factory (proven repo pattern).
// ---------------------------------------------------------------------------
vi.mock("../../services/api", () => ({
    authApi: vi.fn(),
}));

import { authApi } from "../../services/api";
import {
    getNotificationPreferences,
    toWire,
    updateNotificationPreferences,
} from "../../services/notifications/notificationApi";
import { NotificationManager } from "../../services/notifications/notificationManager";
import {
    buildActivityIntent,
    buildIntentFromMessage,
} from "../../services/notifications/notificationRouter";
import {
    DEFAULT_NOTIFICATION_PREFERENCE,
    NotificationIntent,
    NotificationPreference,
} from "../../services/notifications/types";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

// ===========================================================================
// notificationApi.ts
// ===========================================================================
describe("notificationApi", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const wire = {
        master_enabled: false,
        enable_chats: true,
        enable_thread_replies: false,
        enable_mentions: true,
        enable_task_comments: false,
        enable_inbox: true,
        muted_chats: [
            { chat_type: 1, chat_id: "abc", chat_name: "Alice" },
            { chat_type: 2, chat_id: "g-1" }, // no chat_name
        ],
        ts_updated_at: "2026-01-01T00:00:00Z",
    };

    describe("toWire", () => {
        it("maps only the provided fields (PATCH-style) and skips undefined ones", () => {
            const out = toWire({ masterEnabled: false, enableMentions: true });
            expect(out).toEqual({ master_enabled: false, enable_mentions: true });
            // Fields not in the patch must be absent entirely.
            expect("enable_chats" in out).toBe(false);
            expect("muted_chats" in out).toBe(false);
        });

        it("maps every camelCase field to its snake_case wire key", () => {
            const out = toWire({
                masterEnabled: true,
                enableChats: false,
                enableThreadReplies: true,
                enableMentions: false,
                enableTaskComments: true,
                enableInbox: false,
            });
            expect(out).toEqual({
                master_enabled: true,
                enable_chats: false,
                enable_thread_replies: true,
                enable_mentions: false,
                enable_task_comments: true,
                enable_inbox: false,
            });
        });

        it("serializes mutedChats, including/omitting chatName per entry", () => {
            const out = toWire({
                mutedChats: [
                    { chatType: 1, chatId: "x", chatName: "Bob" },
                    { chatType: 3, chatId: "y" },
                ],
            });
            expect(out.muted_chats).toEqual([
                { chat_type: 1, chat_id: "x", chat_name: "Bob" },
                { chat_type: 3, chat_id: "y" },
            ]);
        });

        it("serializes an empty mutedChats array as an empty wire array", () => {
            const out = toWire({ mutedChats: [] });
            expect(out.muted_chats).toEqual([]);
        });

        it("preserves explicit `false` values (does not treat them as undefined)", () => {
            const out = toWire({ masterEnabled: false });
            expect(out).toEqual({ master_enabled: false });
        });
    });

    describe("getNotificationPreferences", () => {
        it("returns DEFAULT prefs without calling HTTP when no token", async () => {
            asMock(authApi).mockReturnValue(null);
            const result = await getNotificationPreferences(null);
            expect(result).toEqual(DEFAULT_NOTIFICATION_PREFERENCE);
            expect(authApi).toHaveBeenCalledWith(null);
        });

        it("GETs the prefs endpoint and maps the wire shape via fromWire", async () => {
            const get = vi.fn().mockResolvedValue({ data: wire });
            asMock(authApi).mockReturnValue({ get });

            const result = await getNotificationPreferences("tok");

            expect(get).toHaveBeenCalledWith("/user/notification-preferences/");
            expect(result).toEqual({
                masterEnabled: false,
                enableChats: true,
                enableThreadReplies: false,
                enableMentions: true,
                enableTaskComments: false,
                enableInbox: true,
                mutedChats: [
                    { chatType: 1, chatId: "abc", chatName: "Alice" },
                    { chatType: 2, chatId: "g-1" },
                ],
            });
        });

        it("treats a missing muted_chats field as an empty array", async () => {
            const get = vi.fn().mockResolvedValue({
                data: { ...wire, muted_chats: undefined },
            });
            asMock(authApi).mockReturnValue({ get });

            const result = await getNotificationPreferences("tok");
            expect(result.mutedChats).toEqual([]);
        });

        it("falls back to DEFAULT prefs and warns when the request throws", async () => {
            const get = vi.fn().mockRejectedValue(new Error("boom"));
            asMock(authApi).mockReturnValue({ get });

            const result = await getNotificationPreferences("tok");
            expect(result).toEqual(DEFAULT_NOTIFICATION_PREFERENCE);
            expect(console.warn).toHaveBeenCalled();
        });
    });

    describe("updateNotificationPreferences", () => {
        it("returns null without calling HTTP when no token", async () => {
            asMock(authApi).mockReturnValue(null);
            const result = await updateNotificationPreferences("", { masterEnabled: true });
            expect(result).toBeNull();
        });

        it("PUTs the toWire-encoded patch and maps the response", async () => {
            const put = vi.fn().mockResolvedValue({ data: wire });
            asMock(authApi).mockReturnValue({ put });

            const result = await updateNotificationPreferences("tok", {
                masterEnabled: false,
                mutedChats: [{ chatType: 1, chatId: "abc", chatName: "Alice" }],
            });

            expect(put).toHaveBeenCalledWith("/user/notification-preferences/", {
                master_enabled: false,
                muted_chats: [{ chat_type: 1, chat_id: "abc", chat_name: "Alice" }],
            });
            expect(result?.masterEnabled).toBe(false);
            expect(result?.mutedChats).toEqual([
                { chatType: 1, chatId: "abc", chatName: "Alice" },
                { chatType: 2, chatId: "g-1" },
            ]);
        });

        it("returns null and warns when the PUT throws", async () => {
            const put = vi.fn().mockRejectedValue(new Error("nope"));
            asMock(authApi).mockReturnValue({ put });

            const result = await updateNotificationPreferences("tok", { enableInbox: false });
            expect(result).toBeNull();
            expect(console.warn).toHaveBeenCalled();
        });
    });
});

// ===========================================================================
// notificationManager.ts
// ===========================================================================
describe("NotificationManager", () => {
    const intent = (overrides: Partial<NotificationIntent> = {}): NotificationIntent => ({
        id: "chat:2:42:m1",
        category: "chats",
        title: "Hello",
        body: "world",
        senderId: "other-user",
        source: { chatType: 2, chatId: "42" },
        ...overrides,
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    describe("preferences: hydrate / get / patch callbacks", () => {
        it("starts with the DEFAULT preference blob", () => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            expect(mgr.getPreferences()).toEqual(DEFAULT_NOTIFICATION_PREFERENCE);
        });

        it("hydratePreferences replaces prefs, clones mutedChats, and notifies listeners but NOT the change cb", () => {
            const onPreferencesChange = vi.fn();
            const mgr = new NotificationManager({ currentUserId: "me", onPreferencesChange });
            const listener = vi.fn();
            mgr.subscribePreferences(listener);

            const muted = [{ chatType: 1, chatId: "x" }];
            const next: NotificationPreference = {
                ...DEFAULT_NOTIFICATION_PREFERENCE,
                masterEnabled: false,
                mutedChats: muted,
            };
            mgr.hydratePreferences(next);

            expect(mgr.getPreferences().masterEnabled).toBe(false);
            // mutedChats must be a clone, not the same array reference.
            expect(mgr.getPreferences().mutedChats).not.toBe(muted);
            expect(mgr.getPreferences().mutedChats).toEqual(muted);
            expect(listener).toHaveBeenCalledTimes(1);
            expect(onPreferencesChange).not.toHaveBeenCalled();
        });

        it("setMasterEnabled commits the patch and fires both listener and change cb", () => {
            const onPreferencesChange = vi.fn();
            const mgr = new NotificationManager({ currentUserId: "me", onPreferencesChange });
            const listener = vi.fn();
            mgr.subscribePreferences(listener);

            mgr.setMasterEnabled(false);

            expect(mgr.getPreferences().masterEnabled).toBe(false);
            expect(listener).toHaveBeenCalledTimes(1);
            expect(onPreferencesChange).toHaveBeenCalledWith({ masterEnabled: false });
        });

        it("unsubscribe stops further preference notifications", () => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            const listener = vi.fn();
            const unsub = mgr.subscribePreferences(listener);
            unsub();
            mgr.setMasterEnabled(false);
            expect(listener).not.toHaveBeenCalled();
        });

        it("setOnPreferencesChange wires the callback after construction", () => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            const cb = vi.fn();
            mgr.setOnPreferencesChange(cb);
            mgr.setMasterEnabled(false);
            expect(cb).toHaveBeenCalledWith({ masterEnabled: false });
        });
    });

    describe("category toggles", () => {
        const cases: Array<[Parameters<NotificationManager["setCategoryEnabled"]>[0], string]> = [
            ["chats", "enableChats"],
            ["thread_replies", "enableThreadReplies"],
            ["mentions", "enableMentions"],
            ["task_comments", "enableTaskComments"],
            ["inbox", "enableInbox"],
        ];

        it.each(cases)("setCategoryEnabled(%s) patches %s", (category, key) => {
            const onPreferencesChange = vi.fn();
            const mgr = new NotificationManager({ currentUserId: "me", onPreferencesChange });
            mgr.setCategoryEnabled(category, false);
            expect(onPreferencesChange).toHaveBeenCalledWith({ [key]: false });
            expect(mgr.isCategoryEnabled(category)).toBe(false);
        });

        it.each(cases)("isCategoryEnabled(%s) reflects defaults (true)", (category) => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            expect(mgr.isCategoryEnabled(category)).toBe(true);
        });
    });

    describe("mute / unmute", () => {
        it("mute adds a ref (with name) and is idempotent", () => {
            const onPreferencesChange = vi.fn();
            const mgr = new NotificationManager({ currentUserId: "me", onPreferencesChange });

            mgr.mute(2, "g-1", "Group One");
            expect(mgr.isMuted(2, "g-1")).toBe(true);
            expect(mgr.getPreferences().mutedChats).toEqual([
                { chatType: 2, chatId: "g-1", chatName: "Group One" },
            ]);
            expect(onPreferencesChange).toHaveBeenCalledTimes(1);

            // Muting again is a no-op (no second patch).
            mgr.mute(2, "g-1", "Group One");
            expect(onPreferencesChange).toHaveBeenCalledTimes(1);
        });

        it("mute without a name stores a ref omitting chatName", () => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            mgr.mute(1, "dm-9");
            expect(mgr.getPreferences().mutedChats).toEqual([{ chatType: 1, chatId: "dm-9" }]);
        });

        it("unmute removes the matching ref; unmuting an absent chat is a no-op", () => {
            const onPreferencesChange = vi.fn();
            const mgr = new NotificationManager({ currentUserId: "me", onPreferencesChange });
            mgr.mute(2, "g-1");
            onPreferencesChange.mockClear();

            mgr.unmute(2, "g-1");
            expect(mgr.isMuted(2, "g-1")).toBe(false);
            expect(onPreferencesChange).toHaveBeenCalledTimes(1);

            // Already-unmuted -> no further patch.
            mgr.unmute(2, "g-1");
            expect(onPreferencesChange).toHaveBeenCalledTimes(1);
        });

        it("isMuted distinguishes by both chatType and chatId", () => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            mgr.mute(2, "shared-id");
            expect(mgr.isMuted(2, "shared-id")).toBe(true);
            expect(mgr.isMuted(1, "shared-id")).toBe(false);
            expect(mgr.isMuted(2, "other")).toBe(false);
        });
    });

    describe("notify() gating (foreground / visible tab)", () => {
        it("ignores self-originated intents (senderId === currentUserId)", () => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            expect(mgr.notify(intent({ senderId: "me" }))).toBe("ignored-self");
        });

        it("does NOT treat as self when senderId is missing", () => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            // No senderId -> falls through; foreground+no active surface => toast.
            const toast = vi.fn();
            mgr.subscribeToasts(toast);
            expect(mgr.notify(intent({ senderId: undefined }))).toBe("toast");
        });

        it("ignores when master switch is off", () => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            mgr.setMasterEnabled(false);
            expect(mgr.notify(intent())).toBe("ignored-disabled");
        });

        it("ignores when the intent's category is disabled", () => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            mgr.setCategoryEnabled("chats", false);
            expect(mgr.notify(intent({ category: "chats" }))).toBe("ignored-disabled");
        });

        it("ignores intents for a muted chat", () => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            mgr.mute(2, "42");
            expect(mgr.notify(intent({ source: { chatType: 2, chatId: "42" } }))).toBe(
                "ignored-muted"
            );
        });

        it("does NOT apply mute when source lacks chatType/chatId (e.g. inbox)", () => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            const toast = vi.fn();
            mgr.subscribeToasts(toast);
            // Inbox intents have no source -> mute branch is skipped.
            expect(mgr.notify(intent({ category: "inbox", source: undefined }))).toBe("toast");
            expect(toast).toHaveBeenCalledTimes(1);
        });

        it("dedupes a repeated id inside the dedupe window", () => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            const toast = vi.fn();
            mgr.subscribeToasts(toast);
            expect(mgr.notify(intent({ id: "dup-1" }))).toBe("toast");
            expect(mgr.notify(intent({ id: "dup-1" }))).toBe("ignored-duplicate");
            expect(toast).toHaveBeenCalledTimes(1);
        });

        it("allows the same id again once the dedupe window has elapsed", () => {
            vi.useFakeTimers();
            vi.setSystemTime(0);
            const mgr = new NotificationManager({ currentUserId: "me", dedupeWindowMs: 1000 });
            const toast = vi.fn();
            mgr.subscribeToasts(toast);

            expect(mgr.notify(intent({ id: "dup-2" }))).toBe("toast");
            // Advance beyond the window so pruneSeen drops the id.
            vi.setSystemTime(2000);
            expect(mgr.notify(intent({ id: "dup-2" }))).toBe("toast");
            expect(toast).toHaveBeenCalledTimes(2);
        });

        it("emits a toast in the foreground when no active surface matches", () => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            const toast = vi.fn();
            mgr.subscribeToasts(toast);
            const i = intent();
            expect(mgr.notify(i)).toBe("toast");
            expect(toast).toHaveBeenCalledWith(i);
        });

        it("suppresses a toast when the matching chat surface is active and tab is visible", () => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            mgr.setActiveSurface({ chatType: 2, chatId: "42" });
            expect(mgr.notify(intent({ source: { chatType: 2, chatId: "42" } }))).toBe(
                "ignored-active-surface"
            );
        });

        it("does NOT suppress when active chat surface differs", () => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            const toast = vi.fn();
            mgr.subscribeToasts(toast);
            mgr.setActiveSurface({ chatType: 2, chatId: "99" });
            expect(mgr.notify(intent({ source: { chatType: 2, chatId: "42" } }))).toBe("toast");
        });

        it("active chat surface does not suppress a thread intent (source has threadId)", () => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            const toast = vi.fn();
            mgr.subscribeToasts(toast);
            mgr.setActiveSurface({ chatType: 2, chatId: "42" });
            const i = intent({
                category: "thread_replies",
                source: { chatType: 2, chatId: "42", threadId: 7 },
            });
            expect(mgr.notify(i)).toBe("toast");
        });

        it("active thread surface suppresses the matching thread intent", () => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            mgr.setActiveSurface({ chatType: 2, chatId: "42", threadId: 7 });
            const i = intent({
                category: "thread_replies",
                source: { chatType: 2, chatId: "42", threadId: 7 },
            });
            expect(mgr.notify(i)).toBe("ignored-active-surface");
        });

        it("active task preview suppresses only task_comments intents on the same task", () => {
            const mgr = new NotificationManager({ currentUserId: "me" });
            mgr.setActiveSurface({ taskId: 55 });

            const comment = intent({
                id: "activity:task_comments:1",
                category: "task_comments",
                source: { chatType: 4, chatId: "c1", taskId: 55 },
            });
            expect(mgr.notify(comment)).toBe("ignored-active-surface");

            // A mention tied to the same task is NOT suppressed.
            const mention = intent({
                id: "activity:mentions:2",
                category: "mentions",
                source: { chatType: 3, chatId: "c2", taskId: 55 },
            });
            const toast = vi.fn();
            mgr.subscribeToasts(toast);
            expect(mgr.notify(mention)).toBe("toast");
        });
    });

    describe("notify() browser dispatch (hidden tab)", () => {
        const stubHiddenSecure = () => {
            Object.defineProperty(document, "visibilityState", {
                configurable: true,
                get: () => "hidden",
            });
            Object.defineProperty(window, "isSecureContext", {
                configurable: true,
                value: true,
            });
        };

        afterEach(() => {
            // visibilityState/isSecureContext are redefined per-test; remove
            // the overrides so other suites see jsdom defaults again.
            delete (document as unknown as Record<string, unknown>).visibilityState;
            delete (window as unknown as Record<string, unknown>).isSecureContext;
        });

        it("ignores when the Notification API is unsupported (insecure context)", () => {
            // Hidden but NOT secure -> isNotificationsApiSupported() === false.
            Object.defineProperty(document, "visibilityState", {
                configurable: true,
                get: () => "hidden",
            });
            const NotificationStub = vi.fn();
            (NotificationStub as unknown as { permission: string }).permission = "granted";
            vi.stubGlobal("Notification", NotificationStub);

            const mgr = new NotificationManager({ currentUserId: "me" });
            expect(mgr.notify(intent())).toBe("ignored-permission");
            expect(NotificationStub).not.toHaveBeenCalled();
        });

        it("ignores when permission is not granted", () => {
            stubHiddenSecure();
            const NotificationStub = vi.fn();
            (NotificationStub as unknown as { permission: string }).permission = "denied";
            vi.stubGlobal("Notification", NotificationStub);

            const mgr = new NotificationManager({ currentUserId: "me" });
            expect(mgr.notify(intent())).toBe("ignored-permission");
            expect(NotificationStub).not.toHaveBeenCalled();
        });

        it("constructs a browser Notification with title/body/icon/tag when granted", () => {
            vi.useFakeTimers();
            stubHiddenSecure();
            const instances: Array<{ onclick: (() => void) | null; close: () => void }> = [];
            const NotificationStub = vi.fn().mockImplementation(function (
                this: { onclick: null; close: () => void },
                _title: string
            ) {
                this.onclick = null;
                this.close = vi.fn();
                instances.push(this);
            });
            (NotificationStub as unknown as { permission: string }).permission = "granted";
            vi.stubGlobal("Notification", NotificationStub);

            const mgr = new NotificationManager({ currentUserId: "me" });
            const i = intent({ title: "T", body: "B", icon: "https://x/i.png", id: "tag-1" });
            const result = mgr.notify(i);

            expect(result).toBe("browser");
            expect(NotificationStub).toHaveBeenCalledWith("T", {
                body: "B",
                icon: "https://x/i.png",
                tag: "tag-1",
            });
            // Auto-close timer fires after 8s.
            const inst = instances[0];
            expect(inst.close).not.toHaveBeenCalled();
            vi.advanceTimersByTime(8000);
            expect(inst.close).toHaveBeenCalledTimes(1);
        });

        it("onclick focuses the window, forwards the intent via onOpenIntent, and closes", () => {
            stubHiddenSecure();
            const focusSpy = vi.spyOn(window, "focus").mockImplementation(() => {});
            const close = vi.fn();
            const NotificationStub = vi.fn().mockImplementation(function (this: {
                onclick: null;
                close: () => void;
            }) {
                this.onclick = null;
                this.close = close;
            });
            (NotificationStub as unknown as { permission: string }).permission = "granted";
            vi.stubGlobal("Notification", NotificationStub);

            const onOpenIntent = vi.fn();
            const mgr = new NotificationManager({ currentUserId: "me", onOpenIntent });
            const i = intent();
            mgr.notify(i);

            const created = NotificationStub.mock.instances[0] as { onclick: () => void };
            created.onclick();

            expect(focusSpy).toHaveBeenCalled();
            expect(onOpenIntent).toHaveBeenCalledWith(i);
            expect(close).toHaveBeenCalled();
        });

        it("returns ignored-permission and warns if the Notification constructor throws", () => {
            stubHiddenSecure();
            vi.spyOn(console, "warn").mockImplementation(() => {});
            const NotificationStub = vi.fn().mockImplementation(() => {
                throw new Error("blocked");
            });
            (NotificationStub as unknown as { permission: string }).permission = "granted";
            vi.stubGlobal("Notification", NotificationStub);

            const mgr = new NotificationManager({ currentUserId: "me" });
            expect(mgr.notify(intent())).toBe("ignored-permission");
            expect(console.warn).toHaveBeenCalled();
        });

        it("active-surface check is skipped when the tab is hidden (still dispatches browser)", () => {
            stubHiddenSecure();
            const NotificationStub = vi.fn().mockImplementation(function (this: {
                onclick: null;
                close: () => void;
            }) {
                this.onclick = null;
                this.close = vi.fn();
            });
            (NotificationStub as unknown as { permission: string }).permission = "granted";
            vi.stubGlobal("Notification", NotificationStub);

            const mgr = new NotificationManager({ currentUserId: "me" });
            // Active surface matches, but because the tab is hidden the
            // active-surface suppression is bypassed.
            mgr.setActiveSurface({ chatType: 2, chatId: "42" });
            expect(mgr.notify(intent({ source: { chatType: 2, chatId: "42" } }))).toBe("browser");
        });
    });

    it("setCurrentUserId updates the self-skip target", () => {
        const mgr = new NotificationManager({ currentUserId: "me" });
        mgr.setCurrentUserId("someone-else");
        // "me" is no longer self -> not ignored-self; foreground toast.
        const toast = vi.fn();
        mgr.subscribeToasts(toast);
        expect(mgr.notify(intent({ senderId: "me" }))).toBe("toast");
    });
});

// ===========================================================================
// notificationRouter.ts
// ===========================================================================
describe("notificationRouter", () => {
    const myself = {
        userId: "me",
        userName: "Me",
        userEmail: "me@test",
        avatarImgPath: "",
        teamId: "t1",
        teamName: "T",
        tsLastSeen: "",
        tsJoined: "",
    } as unknown as Parameters<typeof buildActivityIntent>[1];

    // Minimal stubs — the router only reads `teamMemberProfiles`,
    // `currentTeam`, and `allChats`.
    const useTEM = {
        teamMemberProfiles: {
            other: { avatarImgPath: "avatars/other.png" },
        },
        currentTeam: { teamImgPath: "teams/t1.png" },
    } as unknown as Parameters<typeof buildActivityIntent>[2];

    const useCM = {
        allChats: [],
    } as unknown as Parameters<typeof buildActivityIntent>[3];

    const sender = {
        userId: "other",
        userName: "Bob",
        userEmail: "bob@test",
        avatarImgPath: "avatars/other.png",
    };

    describe("buildIntentFromMessage dispatch + guards", () => {
        it("returns null for null/undefined message", () => {
            expect(buildIntentFromMessage(null, myself, useTEM, useCM)).toBeNull();
            expect(buildIntentFromMessage(undefined, myself, useTEM, useCM)).toBeNull();
        });

        it("returns null when wsType is missing", () => {
            expect(buildIntentFromMessage({}, myself, useTEM, useCM)).toBeNull();
        });

        it("returns null when myself has no userId", () => {
            const noUser = { userId: "" } as typeof myself;
            expect(
                buildIntentFromMessage({ wsType: "chat" }, noUser, useTEM, useCM)
            ).toBeNull();
        });

        it("returns null for an unknown wsType", () => {
            expect(
                buildIntentFromMessage({ wsType: "presence" }, myself, useTEM, useCM)
            ).toBeNull();
        });
    });

    describe("chat intents (wsType: chat, non-thread)", () => {
        const baseChat = {
            wsType: "chat",
            isThread: false,
            isEdited: false,
            isDeleted: false,
            isReactionUpdated: false,
            chatType: 2,
            chatId: 42,
            chatName: "Cool Group",
            messageId: 7,
            sender,
            contentText: "hi there",
        };

        it("builds a chats intent for an incoming room message", () => {
            const result = buildIntentFromMessage(baseChat, myself, useTEM, useCM);
            expect(result).not.toBeNull();
            expect(result!.category).toBe("chats");
            expect(result!.id).toBe("chat:2:42:7");
            expect(result!.senderId).toBe("other");
            expect(result!.body).toBe("hi there");
            expect(result!.source).toEqual({
                chatId: "42",
                chatType: 2,
                projectId: undefined,
                taskId: undefined,
            });
            // GM title with a name -> "Bob • #Cool Group"
            expect(result!.title).toBe("Bob • #Cool Group");
        });

        it("uses just the sender name as the title for a DM (chatType 1)", () => {
            const dm = {
                ...baseChat,
                chatType: 1,
                chatId: 5,
                receiver: { userId: "me" },
            };
            const result = buildIntentFromMessage(dm, myself, useTEM, useCM);
            expect(result).not.toBeNull();
            expect(result!.title).toBe("Bob");
            expect(result!.source!.chatType).toBe(1);
        });

        it("uses the project label as the title for a PM (chatType 3)", () => {
            const pm = { ...baseChat, chatType: 3, chatName: "Acme" };
            const result = buildIntentFromMessage(pm, myself, useTEM, useCM);
            expect(result!.title).toBe("Project • Acme");
        });

        it("falls back to 'Someone' when the sender has no userName", () => {
            const anon = { ...baseChat, sender: { ...sender, userName: "" } };
            const result = buildIntentFromMessage(anon, myself, useTEM, useCM);
            expect(result!.title).toBe("Someone • #Cool Group");
        });

        it("returns null for edited / deleted / reaction-update messages", () => {
            expect(
                buildIntentFromMessage({ ...baseChat, isEdited: true }, myself, useTEM, useCM)
            ).toBeNull();
            expect(
                buildIntentFromMessage({ ...baseChat, isDeleted: true }, myself, useTEM, useCM)
            ).toBeNull();
            expect(
                buildIntentFromMessage(
                    { ...baseChat, isReactionUpdated: true },
                    myself,
                    useTEM,
                    useCM
                )
            ).toBeNull();
        });

        it("returns null when the sender is me", () => {
            const mine = { ...baseChat, sender: { ...sender, userId: "me" } };
            expect(buildIntentFromMessage(mine, myself, useTEM, useCM)).toBeNull();
        });

        it("returns null when the bot (systemUserId) is the sender", () => {
            const bot = {
                ...baseChat,
                systemUserId: "bot",
                sender: { ...sender, userId: "bot" },
            };
            expect(buildIntentFromMessage(bot, myself, useTEM, useCM)).toBeNull();
        });

        it("suppresses the chats intent when I am a mentioned recipient", () => {
            const mentionsMe = { ...baseChat, mentionedUserIds: ["me", "x"] };
            expect(buildIntentFromMessage(mentionsMe, myself, useTEM, useCM)).toBeNull();
        });

        it("returns null for a DM not addressed to me", () => {
            const dmOther = {
                ...baseChat,
                chatType: 1,
                receiver: { userId: "not-me" },
            };
            expect(buildIntentFromMessage(dmOther, myself, useTEM, useCM)).toBeNull();
        });

        it("returns null for an unhandled chat type (e.g. 0)", () => {
            const weird = { ...baseChat, chatType: 0 };
            expect(buildIntentFromMessage(weird, myself, useTEM, useCM)).toBeNull();
        });

        it("resolves the icon from allChats profileImagePath for a GM (absolute URL)", () => {
            const cmWithChat = {
                allChats: [
                    {
                        chatType: 2,
                        chatId: "42",
                        profileImagePath: "https://cdn/g42.png",
                    },
                ],
            } as unknown as typeof useCM;
            const result = buildIntentFromMessage(baseChat, myself, useTEM, cmWithChat);
            // buildAvatarSrc passes through absolute URLs.
            expect(result!.icon).toBe("https://cdn/g42.png");
        });
    });

    describe("thread intents (wsType: chat, isThread true)", () => {
        const baseThread = {
            wsType: "chat",
            isThread: true,
            isEdited: false,
            isDeleted: false,
            isReactionUpdated: false,
            chatType: 2,
            chatId: 42,
            chatName: "Cool Group",
            threadId: 9,
            messageId: 11,
            sender,
            contentText: "a reply",
        };

        it("builds a thread_replies intent with a threadId-bearing source", () => {
            const result = buildIntentFromMessage(baseThread, myself, useTEM, useCM);
            expect(result).not.toBeNull();
            expect(result!.category).toBe("thread_replies");
            expect(result!.id).toBe("thread:2:42:9:11");
            expect(result!.source!.threadId).toBe(9);
            expect(result!.title).toBe("Bob replied in #Cool Group");
        });

        it("returns null for edited thread replies", () => {
            expect(
                buildIntentFromMessage({ ...baseThread, isEdited: true }, myself, useTEM, useCM)
            ).toBeNull();
        });

        it("suppresses when I am mentioned in the thread reply", () => {
            const m = { ...baseThread, mentionedUserIds: ["me"] };
            expect(buildIntentFromMessage(m, myself, useTEM, useCM)).toBeNull();
        });

        it("returns null when the bot posted the thread reply", () => {
            const bot = {
                ...baseThread,
                systemUserId: "bot",
                sender: { ...sender, userId: "bot" },
            };
            expect(buildIntentFromMessage(bot, myself, useTEM, useCM)).toBeNull();
        });
    });

    describe("activity intents (wsType: activity)", () => {
        const baseActivity = {
            wsType: "activity",
            activityId: "act-1",
            activityType: 1,
            chatType: 2,
            chatId: 42,
            chatName: "Cool Group",
            isThread: false,
            senderId: "other",
            senderName: "Bob",
            firstLineContent: "ping",
            mentionedUserIds: [],
        };

        it("returns null for reaction activities (activityType 2)", () => {
            const reaction = { ...baseActivity, activityType: 2 };
            expect(buildIntentFromMessage(reaction, myself, useTEM, useCM)).toBeNull();
        });

        it("returns null when sender is me or senderId missing", () => {
            expect(
                buildIntentFromMessage(
                    { ...baseActivity, senderId: "me" },
                    myself,
                    useTEM,
                    useCM
                )
            ).toBeNull();
            expect(
                buildActivityIntent(
                    { ...baseActivity, senderId: undefined } as never,
                    myself,
                    useTEM,
                    useCM
                )
            ).toBeNull();
        });

        it("builds a mentions intent when I'm mentioned (non-bot sender)", () => {
            const m = { ...baseActivity, mentionedUserIds: ["me"] };
            const result = buildIntentFromMessage(m, myself, useTEM, useCM);
            expect(result).not.toBeNull();
            expect(result!.category).toBe("mentions");
            expect(result!.id).toBe("activity:mentions:act-1");
            expect(result!.title).toBe("Bob mentioned you in #Cool Group");
        });

        it("uses the project label when projectName is present", () => {
            const m = {
                ...baseActivity,
                mentionedUserIds: ["me"],
                projectName: "Acme",
                projectId: 3,
            };
            const result = buildActivityIntent(m as never, myself, useTEM, useCM);
            expect(result!.title).toBe("Bob mentioned you in Project • Acme");
        });

        it("builds a task_comments intent for chatType 4 activity when not mentioned", () => {
            const tc = { ...baseActivity, chatType: 4 };
            const result = buildIntentFromMessage(tc, myself, useTEM, useCM);
            expect(result).not.toBeNull();
            expect(result!.category).toBe("task_comments");
            expect(result!.title).toBe("Bob commented on a task");
        });

        it("returns null when neither mentioned nor a chatType-4 activity", () => {
            // chatType 2, not mentioned -> no category.
            const result = buildIntentFromMessage(baseActivity, myself, useTEM, useCM);
            expect(result).toBeNull();
        });

        it("treats chatType 3 as a bot sender and uses the bot mention title", () => {
            const pm = {
                ...baseActivity,
                chatType: 3,
                projectName: "Acme",
                mentionedUserIds: ["me"],
            };
            const result = buildActivityIntent(pm as never, myself, useTEM, useCM);
            // senderIsBot -> mentionTitleByBot ("Mentioned you in {subjectLabel}")
            expect(result!.title).toBe("Mentioned you in Project • Acme");
        });

        it("suppresses a bot-authored PM thread activity (chatType 3 + isThread)", () => {
            const pmThread = {
                ...baseActivity,
                chatType: 3,
                isThread: true,
                mentionedUserIds: ["me"],
            };
            expect(buildActivityIntent(pmThread as never, myself, useTEM, useCM)).toBeNull();
        });

        it("recovers the PM project icon from allChats by chatId for chatType 3", () => {
            const cm = {
                allChats: [
                    { chatType: 3, chatId: "42", profileImagePath: "https://cdn/proj.png" },
                ],
            } as unknown as typeof useCM;
            const pm = { ...baseActivity, chatType: 3, mentionedUserIds: ["me"] };
            const result = buildActivityIntent(pm as never, myself, useTEM, cm);
            expect(result!.icon).toBe("https://cdn/proj.png");
        });

        it("normalizes a numeric chatId to string in the source", () => {
            const m = { ...baseActivity, mentionedUserIds: ["me"], chatId: 42 };
            const result = buildActivityIntent(m as never, myself, useTEM, useCM);
            expect(result!.source!.chatId).toBe("42");
        });
    });

    describe("inbox intents (wsType: inbox)", () => {
        const inboxItem = {
            itemId: 99,
            itemType: 1,
            itemBody: [{ content: "Please approve" }],
            isRead: false,
            requestStatus: "pending",
            tsSent: "",
        };

        it("returns null when the item already exists", () => {
            const msg = { wsType: "inbox", data: inboxItem, alreadyExist: true };
            expect(buildIntentFromMessage(msg, myself, useTEM, useCM)).toBeNull();
        });

        it("builds an inbox intent with the type-specific title and extracted body", () => {
            const msg = { wsType: "inbox", data: inboxItem, alreadyExist: false };
            const result = buildIntentFromMessage(msg, myself, useTEM, useCM);
            expect(result).not.toBeNull();
            expect(result!.category).toBe("inbox");
            expect(result!.id).toBe("inbox:99");
            expect(result!.title).toBe("Join team request");
            expect(result!.body).toBe("Please approve");
            // No source on inbox intents (bypasses per-chat mute).
            expect(result!.source).toBeUndefined();
        });

        it("extracts nested inline-content text from a BlockNote body", () => {
            const item = {
                ...inboxItem,
                itemBody: [{ content: [{ text: "Hello " }, { text: "world" }] }],
            };
            const msg = { wsType: "inbox", data: item, alreadyExist: false };
            const result = buildIntentFromMessage(msg, myself, useTEM, useCM);
            expect(result!.body).toBe("Hello world");
        });

        it("falls back to the inbox-fallback string when body is empty/non-array", () => {
            const item = { ...inboxItem, itemBody: "not-an-array", itemType: 0 };
            const msg = { wsType: "inbox", data: item, alreadyExist: false };
            const result = buildIntentFromMessage(msg, myself, useTEM, useCM);
            expect(result!.body).toBe("New inbox item");
            expect(result!.title).toBe("New activity");
        });

        it("uses the inbox-fallback title for an unknown itemType", () => {
            const item = { ...inboxItem, itemType: 42 };
            const msg = { wsType: "inbox", data: item, alreadyExist: false };
            const result = buildIntentFromMessage(msg, myself, useTEM, useCM);
            expect(result!.title).toBe("New inbox item");
        });
    });

    describe("truncate behavior (via body)", () => {
        const baseChat = {
            wsType: "chat",
            isThread: false,
            isEdited: false,
            isDeleted: false,
            isReactionUpdated: false,
            chatType: 2,
            chatId: 1,
            chatName: "G",
            messageId: 1,
            sender,
        };

        it("collapses whitespace and trims", () => {
            const result = buildIntentFromMessage(
                { ...baseChat, contentText: "  multiple   spaces\n\ttabs  " },
                myself,
                useTEM,
                useCM
            );
            expect(result!.body).toBe("multiple spaces tabs");
        });

        it("truncates long content to 140 chars with an ellipsis", () => {
            const long = "x".repeat(200);
            const result = buildIntentFromMessage(
                { ...baseChat, contentText: long },
                myself,
                useTEM,
                useCM
            );
            expect(result!.body.length).toBe(140);
            expect(result!.body.endsWith("…")).toBe(true);
        });

        it("yields an empty body when contentText is missing", () => {
            const result = buildIntentFromMessage(baseChat, myself, useTEM, useCM);
            expect(result!.body).toBe("");
        });
    });
});
