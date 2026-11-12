/**
 * An active flag's host message is fetched by id when it is not loaded (MIP-1434).
 *
 * The Flagged list draws a row only for a flag whose message is in the service's cache. Most are,
 * but a thread reply is not until its thread opens, and a task comment's flag is exactly that: the
 * comment is read through the task API, so its mirror reply was never fetched here. Completed
 * flags were back-filled by id already; active ones are now too, once per message per session.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { channelService } from "../services/channel/channelService";
import { ChannelKind, type Channel, type Flag, type Message } from "../types/channel";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

const _origWarn = console.warn;
console.warn = vi.fn();
afterAll(() => {
    console.warn = _origWarn;
});

const svc = channelService as unknown as {
    _flags: Map<string, Flag>;
    _flagByMessageId: Map<string, Flag>;
    _flagHostTried: Set<string>;
    _messages: Map<string, Message[]>;
};

const flag = (messageId: string, over: Partial<Flag> = {}): Flag => ({
    id: `f-${messageId}`,
    messageId,
    tsCreated: "2026-01-01T00:00:00Z",
    ...over,
});

const channel = (): Channel => ({
    id: "c-1",
    kind: ChannelKind.PM,
    title: "Proj",
    profileImageUrl: "",
    projectId: 1,
    legacyChatId: null,
    ownerId: null,
    isPrivate: false,
    latestMessage: null,
    unreadCount: 0,
    tsCreated: "2026-01-01T00:00:00Z",
    tsUpdated: "2026-01-01T00:00:00Z",
});

const message = (id: string): Message =>
    ({
        id,
        channelId: "c-1",
        channelKind: ChannelKind.PM,
        sender: {
            userId: "u",
            userName: "U",
            userEmail: "",
            avatarImgPath: null,
            isSystemUser: false,
        },
        seq: 1,
        body: [],
        bodyText: "hi",
        parentId: null,
        threadRootId: null,
        isThreadReply: false,
        replyCount: 0,
        reactions: [],
        mentions: [],
        attachments: [],
        metadata: {},
        editedAt: null,
        deletedAt: null,
        tsSent: "2026-01-01T00:00:01Z",
        tsUpdated: "2026-01-01T00:00:01Z",
    }) as unknown as Message;

let fetchById: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    svc._flags.clear();
    svc._flagByMessageId.clear();
    svc._flagHostTried.clear();
    svc._messages.clear();
    channelService.setAccessToken("tok");
    fetchById = vi.spyOn(channelService, "fetchMessageById").mockResolvedValue(null);
});
afterEach(() => {
    vi.restoreAllMocks();
    channelService.setAccessToken(null);
});

describe("an active flag whose message is not loaded", () => {
    it("fetches the message by id", () => {
        channelService.handleFlagAdded(flag("m-1"));
        expect(fetchById).toHaveBeenCalledTimes(1);
        expect(fetchById).toHaveBeenCalledWith("m-1");
    });

    it("fetches it once per session, not on every flag event", () => {
        channelService.handleFlagAdded(flag("m-1"));
        channelService.handleFlagAdded(flag("m-1", { id: "server-id" }));
        channelService.handleFlagAdded(flag("m-1"));
        expect(fetchById).toHaveBeenCalledTimes(1);
    });

    it("fetches each message it is asked about", () => {
        channelService.handleFlagAdded(flag("m-1"));
        channelService.handleFlagAdded(flag("m-2"));
        expect(fetchById.mock.calls.map((c: unknown[]) => c[0])).toEqual(["m-1", "m-2"]);
    });
});

describe("it does not fetch what it has no need to", () => {
    it("a message that is already loaded", () => {
        channelService.handleChannelCreated(channel());
        channelService.handleMessageCreated(message("m-1"));
        channelService.handleFlagAdded(flag("m-1"));
        expect(fetchById).not.toHaveBeenCalled();
    });

    it("a completed flag (the past view back-fills those itself)", () => {
        channelService.handleFlagAdded(flag("m-1", { completedAt: "2026-01-02T00:00:00Z" }));
        expect(fetchById).not.toHaveBeenCalled();
    });

    it("anything before there is a token, and then asks when there is one", () => {
        channelService.setAccessToken(null);
        channelService.handleFlagAdded(flag("m-1"));
        expect(fetchById).not.toHaveBeenCalled();
        channelService.setAccessToken("tok");
        channelService.handleFlagAdded(flag("m-1", { id: "again" }));
        expect(fetchById).toHaveBeenCalledTimes(1);
    });

    it("a message it already found missing (a deleted one is not asked for again)", () => {
        fetchById.mockResolvedValue(null);
        channelService.handleFlagAdded(flag("gone"));
        channelService.handleFlagRemoved("gone");
        channelService.handleFlagAdded(flag("gone", { id: "x" }));
        expect(fetchById).toHaveBeenCalledTimes(1);
    });
});
