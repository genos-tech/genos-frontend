/**
 * MIP-1659: every kind of notification opens the thing it is about.
 *
 * MIP-1657 found a toast whose intent named no route and so fell through `openIntent` to its last
 * resort, the chat page. The routing now lives in one pure function, `intentDestination`, and this
 * suite builds each kind of notification the way the app does (from the wire, through the same
 * builders) and checks where a click opens. Measured in a real browser before the fix: a task
 * comment and an @mention in one opened the PROJECT CHAT thread instead of the task, and a task-note
 * mention read "mentioned you in Chat".
 */
import { describe, expect, it, vi } from "vitest";

import { v3ActivityToLegacy } from "../features/chat/adapters/v3ActivityToLegacy";
import { intentDestination } from "../services/notifications/intentDestination";
import {
    buildActivityIntent,
    buildIntentFromMessage,
} from "../services/notifications/notificationRouter";
import { notifyReminderDue } from "../services/notifications/reminderNotice";
import type { NotificationIntent } from "../services/notifications/types";

const ME = "me-0000";
const myself = {
    userId: ME,
    userName: "Me",
    userEmail: "",
    teamId: "t1",
    teamName: "T",
    avatarImgPath: "",
    tsLastSeen: "",
    tsJoined: "",
} as never;
const useTEM = { teamMemberProfiles: {}, currentTeam: null } as never;
const PM_CHANNEL = "0d47f3e6-9a0f-4f35-a6b2-21b57a7761dd";
// A project member has the project's chat loaded; that is where a task comment's project comes from.
const withPm = {
    allChats: [{ chatType: 3, chatId: PM_CHANNEL, project: { projectId: 1064 } }],
} as never;
const noChats = { allChats: [] } as never;

const actor = { userId: "b-1111", userName: "Bob", userEmail: "" };

/** A channel-backed activity as the API sends it (`ActivitySerializer`). */
const channelActivity = (
    over: Record<string, unknown> = {},
    message: Record<string, unknown> = {}
) =>
    ({
        id: "act-1",
        activityType: 1,
        recipientUserId: ME,
        teamId: "t1",
        channelId: PM_CHANNEL,
        channelKind: 3,
        messageId: "m-1",
        surfaceType: null,
        actor,
        meta: {},
        isRead: false,
        tsCreated: "2026-11-16T09:00:00Z",
        message: {
            id: "m-1",
            channelId: PM_CHANNEL,
            channelKind: 3,
            isThreadReply: true,
            parentId: "root-1",
            seq: 3,
            taskId: 14301,
            displayId: "WR-13",
            bodyText: "Plain comment",
            metadata: { taskCommentId: 2 },
            sender: { ...actor, isSystemUser: false },
            ...message,
        },
        ...over,
    }) as never;

/** A channel-less surface activity (task body, notes) as the API sends it. */
const surfaceActivity = (surfaceType: number, meta: Record<string, unknown>) =>
    ({
        id: `act-s${surfaceType}`,
        activityType: 3,
        recipientUserId: ME,
        teamId: "t1",
        channelId: null,
        channelKind: null,
        messageId: null,
        surfaceType,
        actor,
        meta,
        isRead: false,
        tsCreated: "2026-11-16T09:00:00Z",
        message: null,
    }) as never;

const activityIntent = (wire: never, useCM = withPm) =>
    buildActivityIntent(v3ActivityToLegacy(wire, myself), myself, useTEM, useCM);

const dest = (intent: NotificationIntent | null) => {
    expect(intent).not.toBeNull();
    return intentDestination(intent!);
};

describe("task comments open the task at the comment, not the project chat", () => {
    it("a plain comment on my task", () => {
        const intent = activityIntent(channelActivity());
        expect(intent!.category).toBe("task_comments");
        expect(dest(intent)).toEqual({
            kind: "path",
            path: "/workspace/tasks/project/1064/task/14301/comment/2",
        });
    });

    it("an @mention in a comment", () => {
        const intent = activityIntent(channelActivity({ activityType: 3 }));
        expect(intent!.category).toBe("mention_task_comment");
        expect(dest(intent)).toEqual({
            kind: "path",
            path: "/workspace/tasks/project/1064/task/14301/comment/2",
        });
    });

    it("without a comment id, the task", () => {
        const intent = activityIntent(
            channelActivity({}, { metadata: { taskCommentId: "nope" } })
        );
        // A comment id that is not a positive integer is ignored: the task still opens.
        expect(dest(intent)).toEqual({
            kind: "path",
            path: "/workspace/tasks/project/1064/task/14301",
        });
    });

    it("when the project chat is not loaded (not a project member), it keeps opening the chat thread", () => {
        const intent = activityIntent(channelActivity(), noChats);
        expect(intent!.url).toBeUndefined();
        expect(dest(intent).kind).toBe("chat");
    });
});

describe("surface mentions", () => {
    it("a task description opens the task", () => {
        const intent = activityIntent(
            surfaceActivity(5, {
                taskId: 14301,
                projectId: 1064,
                projectName: "Website",
                firstLineContent: "x",
            })
        );
        expect(dest(intent)).toEqual({
            kind: "path",
            path: "/workspace/tasks/project/1064/task/14301",
        });
    });

    it.each([
        [6, 1, "a personal note"],
        [7, 2, "a task note"],
        [8, 3, "a chat note"],
    ])("surface %i opens the note (%s) and says 'Note', not 'Chat'", (surface, noteType) => {
        const intent = activityIntent(
            surfaceActivity(surface, {
                noteId: 525,
                taskId: 14301,
                projectId: 1064,
                chatType: 2,
                chatId: "c-9",
                firstLineContent: "x",
            })
        );
        expect(dest(intent)).toEqual({ kind: "note", noteType, noteId: 525 });
        expect(intent!.title).toContain("Note");
        expect(intent!.title).not.toContain("Chat");
    });
});

describe("chat messages and threads open the chat", () => {
    const sender = { userId: "b-1111", userName: "Bob" };
    it.each([
        ["a DM", { chatType: 1, receiver: { userId: ME } }],
        ["a group message", { chatType: 2 }],
        ["a project chat message", { chatType: 3 }],
        ["a group DM", { chatType: 4 }],
    ])("%s", (_name, over) => {
        const intent = buildIntentFromMessage(
            {
                wsType: "chat",
                isThread: false,
                isEdited: false,
                isDeleted: false,
                isReactionUpdated: false,
                chatId: 42,
                messageId: 7,
                sender,
                contentText: "hi",
                ...over,
            } as never,
            myself,
            useTEM,
            noChats
        );
        expect(dest(intent)).toMatchObject({
            kind: "chat",
            chatType: over.chatType,
            chatId: "42",
        });
    });

    it("a thread reply opens its thread", () => {
        const intent = buildIntentFromMessage(
            {
                wsType: "chat",
                isThread: true,
                isEdited: false,
                isDeleted: false,
                isReactionUpdated: false,
                chatType: 2,
                chatId: 42,
                threadId: 99,
                messageId: 8,
                sender,
                contentText: "re",
            } as never,
            myself,
            useTEM,
            noChats
        );
        expect(dest(intent)).toEqual({ kind: "chat", chatType: 2, chatId: "42", threadId: 99 });
    });

    it("an @mention in a chat opens that chat", () => {
        const intent = activityIntent(
            channelActivity(
                { activityType: 3, channelKind: 2, channelId: "g-1" },
                {
                    channelId: "g-1",
                    channelKind: 2,
                    isThreadReply: false,
                    taskId: null,
                    metadata: {},
                }
            )
        );
        expect(dest(intent)).toMatchObject({ kind: "chat", chatType: 2, chatId: "g-1" });
    });
});

describe("inbox items open themselves, on their own tab", () => {
    const inbox = (itemType: number) =>
        buildIntentFromMessage(
            {
                wsType: "inbox",
                alreadyExist: false,
                data: { itemId: 31, itemType, itemBody: [], isRead: false },
            } as never,
            myself,
            useTEM,
            noChats
        );
    it.each([1, 2, 3, 4, 5, 7, 8])("request type %i opens Requests", (itemType) => {
        expect(dest(inbox(itemType))).toEqual({
            kind: "path",
            path: "/workspace/inbox/requests/31",
        });
    });
    it.each([0, 6, 9, 10])("activity type %i opens Activities", (itemType) => {
        expect(dest(inbox(itemType))).toEqual({
            kind: "path",
            path: "/workspace/inbox/activities/31",
        });
    });
});

describe("reminders open their subject in place", () => {
    const manager = () => {
        const seen: NotificationIntent[] = [];
        return { seen, notify: (i: NotificationIntent) => (seen.push(i), "toast") } as never;
    };
    const item = (href: string | undefined) =>
        ({
            itemId: 5,
            itemType: 9,
            isRead: false,
            itemBody: [],
            tsSent: "",
            itemOptionals: {
                kind: "todo_reminder",
                reminder_id: "77",
                preview: "Renew",
                ...(href ? { href } : {}),
            },
        }) as never;

    it("an in-app href is a path, with no full page load", () => {
        const m = manager();
        notifyReminderDue(m, item("/workspace/todo/2026-08-16/item/42"));
        const intent = (m as unknown as { seen: NotificationIntent[] }).seen[0];
        expect(intent.onOpen).toBeUndefined();
        expect(dest(intent)).toEqual({ kind: "path", path: "/workspace/todo/2026-08-16/item/42" });
    });

    it("anything else is not followed in place", () => {
        const m = manager();
        notifyReminderDue(m, item("https://elsewhere.example/x"));
        const intent = (m as unknown as { seen: NotificationIntent[] }).seen[0];
        expect(intent.url).toBeUndefined();
        expect(dest(intent).kind).toBe("callback");
    });

    it("no href opens the inbox, where the reminder lives", () => {
        const m = manager();
        notifyReminderDue(m, item(undefined));
        expect(dest((m as unknown as { seen: NotificationIntent[] }).seen[0])).toEqual({
            kind: "path",
            path: "/workspace/inbox",
        });
    });
});

describe("the order", () => {
    const base: NotificationIntent = { id: "x", category: "chats", title: "t", body: "" };
    it("callback, then url, then note, then task, then chat, then the last resort", () => {
        const open = vi.fn();
        expect(dest({ ...base, onOpen: open, url: "/a" }).kind).toBe("callback");
        expect(dest({ ...base, url: "/a", source: { surfaceType: 6, noteId: 1 } })).toEqual({
            kind: "path",
            path: "/a",
        });
        expect(
            dest({ ...base, source: { surfaceType: 7, noteId: 1, taskId: 2, projectId: 3 } }).kind
        ).toBe("note");
        expect(
            dest({ ...base, source: { taskId: 2, projectId: 3, chatType: 3, chatId: "c" } })
        ).toEqual({ kind: "path", path: "/workspace/tasks/project/3/task/2" });
        expect(dest({ ...base, source: { chatType: 1, chatId: "c" } }).kind).toBe("chat");
        expect(dest({ ...base, source: { surfaceType: 99 } })).toEqual({
            kind: "fallback",
            path: "/workspace/chat",
        });
    });
    it("a url that is not an in-app path is never followed", () => {
        for (const url of ["https://x.example", "//x.example", "javascript:alert(1)"]) {
            expect(dest({ ...base, url, source: { chatType: 1, chatId: "c" } }).kind).toBe("chat");
        }
    });
});
