/**
 * "Also send to <chat>" (MIP-2486): a thread reply that also shows in the main chat. One
 * message, flagged `alsoInChannel`: the main pane, the chat list, unread counts and links treat
 * it as part of the main timeline; the thread keeps it as a reply.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
    createCachedMessagesAdapter,
    v3MessagesToLegacy,
    v3ThreadMessagesToLegacy,
} from "../features/chat/adapters/v3ToLegacy";
import { RepliedToThreadLine } from "../features/chat/components/bubbles/RepliedToThreadLine";
import { resolveV3MessageUuid } from "../features/chat/utils/channelIdResolvers";
import { matchesConversation } from "../features/chat/utils/liveAnnouncement";
import { computeMessageItemMetas } from "../features/chat/utils/messageItemMetas";
import { ChannelService, channelService } from "../services/channel/channelService";
import { ChannelKind, type Channel, type Message, type ReadCursor } from "../types/channel";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));
vi.spyOn(console, "warn").mockImplementation(() => {});

const sender = {
    userId: "user-a",
    userName: "Alice",
    userEmail: "a@x",
    avatarImgPath: null,
    isSystemUser: false,
};

const channel = (over: Partial<Channel> = {}): Channel => ({
    id: "ch-1",
    kind: ChannelKind.GM,
    title: "Room",
    profileImageUrl: "",
    projectId: null,
    legacyChatId: null,
    ownerId: null,
    isPrivate: false,
    latestMessage: null,
    unreadCount: 0,
    tsCreated: "2026-01-01T00:00:00Z",
    tsUpdated: "2026-01-01T00:00:00Z",
    ...over,
});

const message = (id: string, seq: number, over: Partial<Message> = {}): Message => ({
    id,
    channelId: "ch-1",
    channelKind: ChannelKind.GM,
    sender,
    seq,
    body: [],
    bodyText: id,
    parentId: null,
    threadRootId: null,
    isThreadReply: false,
    replyCount: 0,
    reactions: [],
    mentions: [],
    attachments: [],
    metadata: {},
    taskId: null,
    displayId: null,
    taskStatus: null,
    editedAt: null,
    deletedAt: null,
    tsSent: `2026-01-01T00:00:${String(seq).padStart(2, "0")}Z`,
    tsUpdated: `2026-01-01T00:00:${String(seq).padStart(2, "0")}Z`,
    ...over,
});

const reply = (id: string, seq: number, over: Partial<Message> = {}) =>
    message(id, seq, { parentId: "root", threadRootId: "root", isThreadReply: true, ...over });

const root = message("root", 1, { bodyText: "Where do we ship?" });
const plain = reply("plain", 2);
const shared = reply("shared", 3, { alsoInChannel: true });
const adapt = { channelId: "ch-1", chatType: 2 };

describe("main chat rows", () => {
    it("shows a reply also sent to the chat, with the thread it came from", () => {
        const rows = v3MessagesToLegacy({ ...adapt, messages: [root, plain, shared] });
        expect(rows.map((r) => r.messageIdWithChatId)).toEqual(["root", "shared"]);
        expect(rows[0].alsoSentFrom).toBeUndefined();
        expect(rows[1].alsoSentFrom).toEqual({
            threadRootId: "root",
            rootSeq: 1,
            rootPreview: "Where do we ship?",
        });
    });

    it("keeps it when the thread's first message is not loaded", () => {
        const [row] = v3MessagesToLegacy({ ...adapt, messages: [shared] });
        expect(row.alsoSentFrom).toEqual({
            threadRootId: "root",
            rootSeq: null,
            rootPreview: null,
        });
    });

    it("follows an edit or delete of the thread's first message (cached adapter)", () => {
        const cached = createCachedMessagesAdapter();
        const first = cached({ ...adapt, messages: [root, shared] });
        expect(cached({ ...adapt, messages: [root, shared] })).toBe(first);
        const edited = { ...root, bodyText: "Edited" };
        expect(cached({ ...adapt, messages: [edited, shared] })[1].alsoSentFrom?.rootPreview).toBe(
            "Edited"
        );
        const gone = { ...root, deletedAt: "2026-01-02T00:00:00Z" };
        expect(
            cached({ ...adapt, messages: [gone, shared] })[0].alsoSentFrom?.rootPreview
        ).toBeNull();
    });

    it("stays a reply in its thread, marked as also sent", () => {
        const rows = v3ThreadMessagesToLegacy({
            ...adapt,
            messages: [root, plain, shared],
            threadRootUuid: "root",
        });
        expect(rows.map((r) => r.alsoInChannel ?? false)).toEqual([false, false, true]);
    });

    it("never groups under the message above, so it names its author", () => {
        const rows = v3MessagesToLegacy({ ...adapt, messages: [root, shared] });
        expect(computeMessageItemMetas(rows, false, 2)[1].isSimpleBubble).toBe(false);
        // Nor does the author's next message join it.
        const after = v3MessagesToLegacy({
            ...adapt,
            messages: [shared, message("next", 4)],
        });
        expect(computeMessageItemMetas(after, false, 2)[1].isSimpleBubble).toBe(false);
        // The thread pane groups it as any reply.
        const inThread = v3ThreadMessagesToLegacy({
            ...adapt,
            messages: [root, shared],
            threadRootUuid: "root",
        });
        expect(computeMessageItemMetas(inThread, true, 2)[1].isSimpleBubble).toBe(true);
    });

    it("is found by its message link and announced in both places", () => {
        channelService.handleChannelCreated(channel({ id: "ch-link" }));
        channelService.handleMessageCreated(reply("p", 5, { channelId: "ch-link" }));
        channelService.handleMessageCreated(
            reply("s", 6, { channelId: "ch-link", alsoInChannel: true })
        );
        expect(resolveV3MessageUuid("ch-link", 6, false)).toBe("s");
        expect(resolveV3MessageUuid("ch-link", 5, false)).toBeNull();
        expect(matchesConversation(shared, { chatId: "ch-1" })).toBe(true);
        expect(matchesConversation(plain, { chatId: "ch-1" })).toBe(false);
        expect(matchesConversation(shared, { chatId: "ch-1", threadId: "root" })).toBe(true);
    });

    it("opens the thread from its line without selecting the message", () => {
        const open = vi.fn();
        const select = vi.fn();
        render(
            <div onClick={select}>
                <RepliedToThreadLine preview="Where do we ship?" onOpen={open} />
            </div>
        );
        fireEvent.click(
            screen.getByRole("button", { name: "Replied to a thread: Where do we ship?" })
        );
        expect(open).toHaveBeenCalledTimes(1);
        expect(select).not.toHaveBeenCalled();
    });
});

describe("the store", () => {
    const service = () => {
        const svc = new ChannelService();
        svc.setCurrentUserId("user-me");
        svc.handleChannelCreated(channel());
        return svc;
    };
    const row = (svc: ChannelService) => svc.getSnapshot().channels.get("ch-1")!;

    it("counts it once as unread and as the chat's latest message", () => {
        const svc = service();
        svc.handleMessageCreated(plain);
        expect(row(svc).unreadCount).toBe(0);
        svc.handleMessageCreated(shared);
        expect(row(svc).unreadCount).toBe(1);
        expect(row(svc).latestMessage?.id).toBe("shared");
    });

    it("applies a row that a sync returns in both streams once", () => {
        const svc = service();
        svc.ingestMessages([shared, shared]);
        expect(row(svc).unreadCount).toBe(1);
    });

    it("counts it after the read mark", () => {
        const svc = service();
        svc.ingestMessages([root, plain, shared]);
        svc.handleReadAdvanced({
            channelId: "ch-1",
            threadRootId: null,
            lastReadMessageId: "root",
        } as ReadCursor);
        expect(row(svc).unreadCount).toBe(1);
        svc.handleReadAdvanced({
            channelId: "ch-1",
            threadRootId: null,
            lastReadMessageId: "shared",
        } as ReadCursor);
        expect(row(svc).unreadCount).toBe(0);
    });

    it("keeps it when either half of the chat is reloaded", async () => {
        const svc = service();
        svc.ingestMessages([root, plain, shared]);
        const ids = () =>
            (svc.getSnapshot().messagesByChannel.get("ch-1") ?? []).map((m) => m.id).sort();
        await svc._evictChannelMessages("ch-1", "threads");
        expect(ids()).toEqual(["root", "shared"]);
        await svc._evictChannelMessages("ch-1", "top-level");
        expect(ids()).toEqual(["shared"]);
    });

    it("sends the flag and draws the row in the chat before the server answers", () => {
        const svc = service();
        const emit = vi.fn();
        svc.setSocket({ connected: true, emit, timeout: () => ({ emit }) } as any);
        void svc
            .send("ch-1", [{}], { parentId: "root", alsoInChannel: true, echo: { sender } })
            .catch(() => {});
        void svc.send("ch-1", [{}], { parentId: "root" }).catch(() => {});
        void svc.send("ch-1", [{}], { alsoInChannel: true }).catch(() => {});
        expect(row(svc).latestMessage?.alsoInChannel).toBe(true);
        const sent = emit.mock.calls.map((c) => c[1].also_in_channel);
        expect(sent).toEqual([true, undefined, undefined]);
    });
});
