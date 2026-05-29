/**
 * Thread surface tests.
 *
 * Covers:
 *   - `useChannelThread` (root lookup, reply filtering by threadRootId,
 *     replyInThread routes through channelService.send with parentId)
 *   - `ThreadPanelV3` rendering + reply composer
 *   - `MessagesPaneV3` thread entry-point button + reply-count chip
 */

import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MessagesPaneV3 } from "../features/channel/components/MessagesPaneV3";
import { ThreadPanelV3 } from "../features/channel/components/ThreadPanelV3";
import { useChannelThread } from "../features/channel/hooks/useChannelThread";
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

function fakeMessage(id: string, channelId: string, text: string, sender = "Alice"): Message {
    return {
        id,
        channelId,
        channelKind: ChannelKind.GM,
        sender: {
            userId: `u-${sender.toLowerCase()}`,
            userName: sender,
            userEmail: `${sender}@x`,
            avatarImgPath: null,
            isSystemUser: false,
        },
        seq: 1,
        body: [],
        bodyText: text,
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
    };
}

function fakeReply(
    id: string,
    channelId: string,
    rootId: string,
    text: string,
    sender = "Bob",
    tsSent = "2026-01-01T00:00:02Z"
): Message {
    return {
        ...fakeMessage(id, channelId, text, sender),
        parentId: rootId,
        threadRootId: rootId,
        isThreadReply: true,
        tsSent,
        tsUpdated: tsSent,
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

describe("useChannelThread", () => {
    beforeEach(async () => {
        await resetService();
        localStorage.setItem("userId", "u-me");
    });

    it("returns the root message + filtered replies", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-root", "c-1", "topic"));
        channelService.handleMessageCreated(fakeReply("m-r1", "c-1", "m-root", "first reply"));
        channelService.handleMessageCreated(fakeReply("m-r2", "c-1", "m-root", "second reply"));
        // Also drop in a reply for a DIFFERENT root — must not leak.
        channelService.handleMessageCreated(
            fakeReply("m-other", "c-1", "OTHER-ROOT", "elsewhere")
        );

        const { result } = renderHook(() => useChannelThread("c-1", "m-root"));
        expect(result.current.root?.id).toBe("m-root");
        expect(result.current.replies.map((r) => r.id)).toEqual(["m-r1", "m-r2"]);
    });

    it("isLoading is true until the root lands", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        const { result, rerender } = renderHook(() => useChannelThread("c-1", "m-root"));
        expect(result.current.root).toBeNull();
        expect(result.current.isLoading).toBe(true);

        act(() => {
            channelService.handleMessageCreated(fakeMessage("m-root", "c-1", "topic"));
        });
        rerender();
        expect(result.current.root?.id).toBe("m-root");
        expect(result.current.isLoading).toBe(false);
    });

    it("replyInThread calls channelService.send with parentId", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-root", "c-1", "topic"));

        const spy = vi.spyOn(channelService, "send").mockResolvedValue(undefined);
        const { result } = renderHook(() => useChannelThread("c-1", "m-root"));
        await result.current.replyInThread([{ t: "p" }], { bodyText: "hello" });

        expect(spy).toHaveBeenCalledWith("c-1", [{ t: "p" }], {
            bodyText: "hello",
            metadata: undefined,
            parentId: "m-root",
        });
        spy.mockRestore();
    });
});

describe("ThreadPanelV3", () => {
    beforeEach(async () => {
        await resetService();
        localStorage.setItem("userId", "u-me");
    });

    it("renders 'Loading thread…' before the root lands", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        render(<ThreadPanelV3 channelId="c-1" rootMessageId="missing" onClose={() => {}} />);
        expect(screen.getByText("Loading thread…")).toBeInTheDocument();
    });

    it("renders root + replies once hydrated", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-root", "c-1", "topic", "Alice"));
        channelService.handleMessageCreated(fakeReply("m-r1", "c-1", "m-root", "first", "Bob"));
        render(<ThreadPanelV3 channelId="c-1" rootMessageId="m-root" onClose={() => {}} />);
        expect(screen.getByTestId("thread-panel-v3-root")).toHaveTextContent(/Alice:.*topic/);
        expect(screen.getByTestId("thread-panel-v3-reply-m-r1")).toHaveTextContent(/Bob:.*first/);
    });

    it("submitting the reply form calls channelService.send with parentId", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-root", "c-1", "topic"));
        const spy = vi.spyOn(channelService, "send").mockResolvedValue(undefined);

        render(<ThreadPanelV3 channelId="c-1" rootMessageId="m-root" onClose={() => {}} />);
        fireEvent.change(screen.getByTestId("thread-panel-v3-input"), {
            target: { value: "my reply" },
        });
        fireEvent.click(screen.getByTestId("thread-panel-v3-send"));

        await waitFor(() => {
            expect(spy).toHaveBeenCalledWith(
                "c-1",
                [{ type: "paragraph", content: [{ type: "text", text: "my reply" }] }],
                expect.objectContaining({ parentId: "m-root", bodyText: "my reply" })
            );
        });
        spy.mockRestore();
    });

    it("calls onClose when the close button is clicked", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-root", "c-1", "topic"));
        const onClose = vi.fn();
        render(<ThreadPanelV3 channelId="c-1" rootMessageId="m-root" onClose={onClose} />);
        fireEvent.click(screen.getByTestId("thread-panel-v3-close"));
        expect(onClose).toHaveBeenCalled();
    });

    it("a reply that lands after mount appears live", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-root", "c-1", "topic"));
        render(<ThreadPanelV3 channelId="c-1" rootMessageId="m-root" onClose={() => {}} />);
        expect(screen.getByText("No replies yet.")).toBeInTheDocument();

        act(() => {
            channelService.handleMessageCreated(
                fakeReply("m-live", "c-1", "m-root", "live reply")
            );
        });
        await waitFor(() => {
            expect(screen.getByTestId("thread-panel-v3-reply-m-live")).toBeInTheDocument();
        });
    });
});

describe("MessagesPaneV3 thread entry-point", () => {
    beforeEach(async () => {
        await resetService();
        localStorage.setItem("userId", "u-me");
    });

    it("renders the thread button only when onOpenThread is provided", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1", "hi"));

        const { unmount } = render(<MessagesPaneV3 channelId="c-1" />);
        expect(screen.queryByTestId("message-row-thread-m-1")).toBeNull();
        unmount();

        const onOpenThread = vi.fn();
        render(<MessagesPaneV3 channelId="c-1" onOpenThread={onOpenThread} />);
        expect(screen.getByTestId("message-row-thread-m-1")).toBeInTheDocument();
    });

    it("clicking the thread button calls onOpenThread with the message id", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1", "hi"));
        const onOpenThread = vi.fn();
        render(<MessagesPaneV3 channelId="c-1" onOpenThread={onOpenThread} />);

        fireEvent.click(screen.getByTestId("message-row-thread-m-1"));
        expect(onOpenThread).toHaveBeenCalledWith("m-1");
    });

    it("thread button shows the reply count when replyCount > 0", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated({
            ...fakeMessage("m-1", "c-1", "hi"),
            replyCount: 7,
        });
        render(<MessagesPaneV3 channelId="c-1" onOpenThread={() => {}} />);
        expect(screen.getByTestId("message-row-thread-m-1")).toHaveTextContent("7");
    });

    it("thread button is suppressed on a thread reply row (avoids nested threads)", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-root", "c-1", "topic"));
        channelService.handleMessageCreated(fakeReply("m-r1", "c-1", "m-root", "reply"));
        // The pane filters out thread replies from the main list anyway,
        // so this test mostly guards the row guard for future contexts
        // (e.g. if a search result preview reuses MessageRow).
        render(<MessagesPaneV3 channelId="c-1" onOpenThread={() => {}} />);
        // The reply isn't in the main list — only the root should render.
        expect(screen.getByTestId("message-row-thread-m-root")).toBeInTheDocument();
        expect(screen.queryByTestId("message-row-thread-m-r1")).toBeNull();
    });
});
