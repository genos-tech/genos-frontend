/**
 * Mention-surface tests.
 *
 * Covers:
 *   - `MessageBody` rendering for plain text, mention chips, self-mention
 *     highlighting, and `mentionGroup` chips.
 *   - `useMentionDraft` trigger detection, suggestion filtering, chip
 *     insertion, and `buildBody` conversion of `@Name` tokens into
 *     BlockNote-style mention inline content.
 *   - `MessagesPaneV3` integration: picker appears on `@`, picking a
 *     candidate inserts a chip, send call carries the right body, and
 *     the row shows a `@you` indicator when the message mentions the
 *     viewer.
 */

import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MessageBody } from "../features/channel/components/MessageBody";
import { MessagesPaneV3 } from "../features/channel/components/MessagesPaneV3";
import {
    candidatesFromMessages,
    useMentionDraft,
} from "../features/channel/hooks/useMentionDraft";
import { channelService } from "../services/channel/channelService";
import { ChannelKind, type Channel, type Message } from "../types/channel";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

const _origWarn = console.warn;
console.warn = vi.fn();
afterAll(() => {
    console.warn = _origWarn;
});

function fakeChannel(id: string, overrides: Partial<Channel> = {}): Channel {
    return {
        id,
        kind: ChannelKind.GM,
        title: `Channel ${id}`,
        profileImageUrl: "",
        projectId: null,
        ownerId: null,
        isPrivate: false,
        latestMessage: null,
        unreadCount: 0,
        tsCreated: "2026-01-01T00:00:00Z",
        tsUpdated: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

function fakeMessage(
    id: string,
    channelId: string,
    sender: { userId: string; userName: string },
    overrides: Partial<Message> = {}
): Message {
    return {
        id,
        channelId,
        channelKind: ChannelKind.GM,
        sender: {
            userId: sender.userId,
            userName: sender.userName,
            userEmail: `${sender.userName.toLowerCase()}@x`,
            avatarImgPath: null,
            isSystemUser: false,
        },
        seq: 1,
        body: [],
        bodyText: "",
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
        ...overrides,
    };
}

async function resetService() {
    const snap = channelService.getSnapshot();
    for (const id of Array.from(snap.channels.keys())) {
        channelService.setCurrentUserId("test-self");
        channelService.handleChannelMemberRemoved({
            channelId: id,
            channelKind: ChannelKind.GM,
            userId: "test-self",
        });
    }
    await channelService.hydrateFromIDB();
}

describe("MessageBody", () => {
    it("falls back to bodyText when body is empty", () => {
        render(<MessageBody body={[]} bodyText="hello world" currentUserId={null} />);
        expect(screen.getByText("hello world")).toBeInTheDocument();
    });

    it("renders mention chips from BlockNote inline content", () => {
        const body = [
            {
                type: "paragraph",
                content: [
                    { type: "text", text: "hey " },
                    { type: "mention", props: { userId: "u-alice", userName: "Alice" } },
                    { type: "text", text: " ping" },
                ],
            },
        ];
        render(<MessageBody body={body} bodyText="hey @Alice ping" currentUserId="u-me" />);
        const chip = screen.getByTestId("message-body-mention-u-alice");
        expect(chip).toHaveTextContent("@Alice");
        expect(chip.dataset.self).toBe("false");
    });

    it("marks the chip as self when the mention points at the viewer", () => {
        const body = [
            {
                type: "paragraph",
                content: [{ type: "mention", props: { userId: "u-me", userName: "Me" } }],
            },
        ];
        render(<MessageBody body={body} bodyText="@Me" currentUserId="u-me" />);
        const chip = screen.getByTestId("message-body-mention-u-me");
        expect(chip.dataset.self).toBe("true");
    });

    it("renders mentionGroup chips", () => {
        const body = [
            {
                type: "paragraph",
                content: [
                    {
                        type: "mentionGroup",
                        props: { groupId: "7", groupName: "Engineering", memberCount: "12" },
                    },
                ],
            },
        ];
        render(<MessageBody body={body} bodyText="@Engineering" currentUserId="u-me" />);
        expect(screen.getByTestId("message-body-mention-group-7")).toHaveTextContent(
            "@Engineering"
        );
    });
});

describe("useMentionDraft", () => {
    const candidates = [
        { userId: "u-alice", userName: "Alice" },
        { userId: "u-bob", userName: "Bob" },
        { userId: "u-aliceb", userName: "AliceB" },
    ];

    it("activates the picker when the caret follows a bare @", () => {
        const { result } = renderHook(() => useMentionDraft(candidates));
        act(() => {
            result.current.setDraft("hello @A");
            result.current.setCaret(8);
        });
        expect(result.current.pickerOpen).toBe(true);
        expect(result.current.activeQuery).toBe("A");
        expect(result.current.suggestions.map((s) => s.userId)).toEqual(["u-alice", "u-aliceb"]);
    });

    it("does NOT activate the picker for an email-shaped @", () => {
        const { result } = renderHook(() => useMentionDraft(candidates));
        act(() => {
            result.current.setDraft("ping me@host");
            result.current.setCaret(12);
        });
        expect(result.current.pickerOpen).toBe(false);
        expect(result.current.activeQuery).toBeNull();
    });

    it("selectCandidate inserts `@Name ` at the trigger and locks the ref", () => {
        const { result } = renderHook(() => useMentionDraft(candidates));
        act(() => {
            result.current.setDraft("hi @Al");
            result.current.setCaret(6);
        });
        act(() => {
            result.current.selectCandidate({ userId: "u-alice", userName: "Alice" });
        });
        expect(result.current.draft).toBe("hi @Alice ");
        // After insertion the trigger collapses (space follows @Alice).
        expect(result.current.pickerOpen).toBe(false);
    });

    it("buildBody converts plain draft to a single text node", () => {
        const { result } = renderHook(() => useMentionDraft(candidates));
        act(() => {
            result.current.setDraft("no mentions here");
        });
        expect(result.current.buildBody()).toEqual([
            {
                type: "paragraph",
                content: [{ type: "text", text: "no mentions here" }],
            },
        ]);
    });

    it("buildBody emits mention inline content for picked refs", () => {
        const { result } = renderHook(() => useMentionDraft(candidates));
        act(() => {
            result.current.setDraft("hi @Al");
            result.current.setCaret(6);
        });
        act(() => {
            result.current.selectCandidate({ userId: "u-alice", userName: "Alice" });
        });
        act(() => {
            result.current.setDraft(`${result.current.draft}thanks`);
        });
        expect(result.current.buildBody()).toEqual([
            {
                type: "paragraph",
                content: [
                    { type: "text", text: "hi " },
                    {
                        type: "mention",
                        props: { userId: "u-alice", userName: "Alice" },
                    },
                    { type: "text", text: " thanks" },
                ],
            },
        ]);
    });

    it("buildBody prefers the longer userName when picks overlap", () => {
        const { result } = renderHook(() => useMentionDraft(candidates));
        // Pick BOTH Alice and AliceB so they're both in the refs list.
        act(() => {
            result.current.setDraft("@Al");
            result.current.setCaret(3);
        });
        act(() => {
            result.current.selectCandidate({ userId: "u-alice", userName: "Alice" });
        });
        act(() => {
            // Type another @ trigger after the first chip and pick AliceB.
            result.current.setDraft("@Alice @AliceB");
            result.current.setCaret(14);
        });
        act(() => {
            result.current.selectCandidate({ userId: "u-aliceb", userName: "AliceB" });
        });
        // Now the picked list has BOTH Alice and AliceB. Set a draft
        // that only mentions AliceB — the builder must not greedily
        // match the prefix `@Alice` (which would split the chip in
        // two and emit the wrong userId).
        act(() => {
            result.current.setDraft("ping @AliceB please");
        });
        const body = result.current.buildBody() as Array<{
            type: string;
            content: Array<{ type: string; props?: Record<string, unknown> }>;
        }>;
        const mentions = body[0].content.filter((n) => n.type === "mention");
        expect(mentions).toHaveLength(1);
        expect(mentions[0].props?.userId).toBe("u-aliceb");
    });

    it("reset clears draft + picked refs", () => {
        const { result } = renderHook(() => useMentionDraft(candidates));
        act(() => {
            result.current.setDraft("@A");
            result.current.setCaret(2);
        });
        act(() => {
            result.current.selectCandidate({ userId: "u-alice", userName: "Alice" });
        });
        act(() => {
            result.current.reset();
        });
        expect(result.current.draft).toBe("");
        expect(result.current.buildBody()).toEqual([]);
    });
});

describe("candidatesFromMessages", () => {
    it("dedupes by userId, excludes the viewer + system users, reverses to recent-first", () => {
        const msgs: Message[] = [
            fakeMessage("m1", "c1", { userId: "u-alice", userName: "Alice" }),
            fakeMessage("m2", "c1", { userId: "u-bob", userName: "Bob" }),
            fakeMessage("m3", "c1", { userId: "u-alice", userName: "Alice" }),
            fakeMessage("m4", "c1", { userId: "u-me", userName: "Me" }),
            {
                ...fakeMessage("m5", "c1", { userId: "u-sys", userName: "System" }),
                sender: {
                    userId: "u-sys",
                    userName: "System",
                    userEmail: "sys@x",
                    avatarImgPath: null,
                    isSystemUser: true,
                },
            },
        ];
        const got = candidatesFromMessages(msgs, "u-me");
        // Walks backwards through msgs (asc-sorted, so newest last).
        // Alice m3 lands first (most recent non-self), then Bob m2.
        // Alice m1 is dropped as a duplicate.
        expect(got.map((c) => c.userId)).toEqual(["u-alice", "u-bob"]);
    });
});

describe("MessagesPaneV3 mention integration", () => {
    beforeEach(async () => {
        await resetService();
        localStorage.setItem("userId", "u-me");
    });

    it("opens the picker when the user types @ and shows a candidate", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(
            fakeMessage("m-1", "c-1", { userId: "u-alice", userName: "Alice" }, { bodyText: "hi" })
        );
        render(<MessagesPaneV3 channelId="c-1" />);

        const input = screen.getByTestId("messages-pane-v3-input") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "@A" } });
        // Drive the selectionStart so the hook treats the caret as
        // sitting after the `A`.
        input.setSelectionRange(2, 2);
        fireEvent.keyUp(input);

        expect(screen.getByTestId("messages-pane-v3-mention-picker")).toBeInTheDocument();
        expect(screen.getByTestId("messages-pane-v3-mention-option-u-alice")).toHaveTextContent(
            "@Alice"
        );
    });

    it("picking a candidate inserts the chip and lets send carry the right body", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(
            fakeMessage("m-1", "c-1", { userId: "u-alice", userName: "Alice" })
        );
        const spy = vi.spyOn(channelService, "send").mockResolvedValue(undefined);

        render(<MessagesPaneV3 channelId="c-1" />);
        const input = screen.getByTestId("messages-pane-v3-input") as HTMLInputElement;

        fireEvent.change(input, { target: { value: "@A" } });
        input.setSelectionRange(2, 2);
        fireEvent.keyUp(input);

        const option = screen.getByTestId("messages-pane-v3-mention-option-u-alice");
        fireEvent.mouseDown(option);

        // After the chip insert, the draft has `@Alice ` and the caret
        // sits at the end. Simulate the user typing ` thanks` on top.
        fireEvent.change(input, { target: { value: "@Alice thanks" } });
        input.setSelectionRange(13, 13);
        fireEvent.keyUp(input);

        fireEvent.click(screen.getByTestId("messages-pane-v3-send"));

        // The pane awaits the send promise — let microtasks flush.
        await Promise.resolve();

        expect(spy).toHaveBeenCalledWith(
            "c-1",
            [
                {
                    type: "paragraph",
                    content: [
                        {
                            type: "mention",
                            props: { userId: "u-alice", userName: "Alice" },
                        },
                        { type: "text", text: " thanks" },
                    ],
                },
            ],
            expect.objectContaining({ bodyText: "@Alice thanks" })
        );
        spy.mockRestore();
    });

    it("shows a `@you` indicator on rows that mention the viewer", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(
            fakeMessage(
                "m-1",
                "c-1",
                { userId: "u-alice", userName: "Alice" },
                {
                    bodyText: "ping",
                    mentions: [
                        {
                            id: "mn-1",
                            mentionedUserId: "u-me",
                            viaGroupId: null,
                            tsCreated: "2026-01-01T00:00:01Z",
                        },
                    ],
                }
            )
        );

        render(<MessagesPaneV3 channelId="c-1" />);
        expect(screen.getByTestId("message-row-mention-me-m-1")).toBeInTheDocument();
    });

    it("does NOT show `@you` when the mention is for someone else", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(
            fakeMessage(
                "m-1",
                "c-1",
                { userId: "u-alice", userName: "Alice" },
                {
                    bodyText: "ping",
                    mentions: [
                        {
                            id: "mn-1",
                            mentionedUserId: "u-other",
                            viaGroupId: null,
                            tsCreated: "2026-01-01T00:00:01Z",
                        },
                    ],
                }
            )
        );

        render(<MessagesPaneV3 channelId="c-1" />);
        expect(screen.queryByTestId("message-row-mention-me-m-1")).toBeNull();
    });
});
