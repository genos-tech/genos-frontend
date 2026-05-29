/**
 * MessageRow hover-toolbar tests.
 *
 * Three layers:
 *   1. The `MessageRowHoverToolbar` component in isolation — visibility
 *      contract, action dispatch, owner gating.
 *   2. The `MessagesPaneV3` row integration — hover/leave/focus drive
 *      `data-toolbar-visible`; reaction popover keeps it visible after
 *      the mouse leaves.
 *   3. Pure helpers: `messageDeepLinkUrl` shape, `useCopyMessageLink`
 *      writes to `navigator.clipboard` with the right URL.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
    messageDeepLinkUrl,
    MessageRowHoverToolbar,
} from "../features/channel/components/MessageRowHoverToolbar";
import { MessagesPaneV3 } from "../features/channel/components/MessagesPaneV3";
import { channelService } from "../services/channel/channelService";
import { ChannelKind, type Channel, type Message, type UserLite } from "../types/channel";

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
    sender: UserLite,
    overrides: Partial<Message> = {}
): Message {
    return {
        id,
        channelId,
        channelKind: ChannelKind.GM,
        sender,
        seq: 1,
        body: [],
        bodyText: "hello",
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
    channelService.setCurrentUserId(null);
    channelService.resetIdbHealth();
    // `MessagesPaneV3` renders a "Loading channel…" placeholder until
    // the service snapshot reports `hydrated=true`. The IDB read is
    // stubbed to reject (see vi.mock above), but `hydrateFromIDB`'s
    // catch path still flips the flag — call it once so the tests see
    // the post-hydration UI.
    await channelService.hydrateFromIDB();
}

describe("MessageRowHoverToolbar — isolated", () => {
    const baseProps = {
        messageId: "m-1",
        visible: true,
        onFlag: vi.fn(),
        isFlagged: false,
        onReact: vi.fn(),
        replyCount: 0,
        onCopyLink: vi.fn(),
        isMine: false,
        onEdit: vi.fn(),
        onDelete: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("data-toolbar-visible reflects the visible prop", () => {
        const { rerender } = render(<MessageRowHoverToolbar {...baseProps} visible={false} />);
        expect(
            screen.getByTestId("message-row-toolbar-m-1").getAttribute("data-toolbar-visible")
        ).toBe("false");
        rerender(<MessageRowHoverToolbar {...baseProps} visible={true} />);
        expect(
            screen.getByTestId("message-row-toolbar-m-1").getAttribute("data-toolbar-visible")
        ).toBe("true");
    });

    it("dispatches onFlag / onReact / onCopyLink for any viewer", () => {
        render(<MessageRowHoverToolbar {...baseProps} />);
        fireEvent.click(screen.getByTestId("message-row-flag-m-1"));
        fireEvent.click(screen.getByTestId("message-row-react-m-1"));
        fireEvent.click(screen.getByTestId("message-row-copy-link-m-1"));
        expect(baseProps.onFlag).toHaveBeenCalledTimes(1);
        expect(baseProps.onReact).toHaveBeenCalledTimes(1);
        expect(baseProps.onCopyLink).toHaveBeenCalledTimes(1);
    });

    it("hides edit + delete when isMine is false", () => {
        render(<MessageRowHoverToolbar {...baseProps} isMine={false} />);
        expect(screen.queryByTestId("message-row-edit-m-1")).toBeNull();
        expect(screen.queryByTestId("message-row-delete-m-1")).toBeNull();
    });

    it("shows edit + delete when isMine is true and dispatches them", () => {
        render(<MessageRowHoverToolbar {...baseProps} isMine={true} />);
        fireEvent.click(screen.getByTestId("message-row-edit-m-1"));
        fireEvent.click(screen.getByTestId("message-row-delete-m-1"));
        expect(baseProps.onEdit).toHaveBeenCalledTimes(1);
        expect(baseProps.onDelete).toHaveBeenCalledTimes(1);
    });

    it("hides the thread button when onReply is undefined", () => {
        render(<MessageRowHoverToolbar {...baseProps} onReply={undefined} />);
        expect(screen.queryByTestId("message-row-thread-m-1")).toBeNull();
    });

    it("renders replyCount on the thread button when > 0", () => {
        const onReply = vi.fn();
        render(<MessageRowHoverToolbar {...baseProps} onReply={onReply} replyCount={3} />);
        const btn = screen.getByTestId("message-row-thread-m-1");
        expect(btn).toHaveTextContent("3");
        fireEvent.click(btn);
        expect(onReply).toHaveBeenCalledTimes(1);
    });

    it("dims the flag button when not flagged (opacity < 1)", () => {
        const { rerender } = render(<MessageRowHoverToolbar {...baseProps} isFlagged={false} />);
        const btn = screen.getByTestId("message-row-flag-m-1");
        const dimOpacity = window.getComputedStyle(btn).opacity;
        rerender(<MessageRowHoverToolbar {...baseProps} isFlagged={true} />);
        const fullOpacity = window.getComputedStyle(btn).opacity;
        expect(Number(dimOpacity)).toBeLessThan(Number(fullOpacity));
    });
});

describe("messageDeepLinkUrl", () => {
    it("builds /workspace/v3/<channelId>#message-<id> on origin", () => {
        const url = messageDeepLinkUrl("c-1", "m-99");
        expect(url).toContain("/workspace/v3/c-1#message-m-99");
        // jsdom origin is non-empty.
        expect(url.startsWith(window.location.origin)).toBe(true);
    });
});

describe("MessagesPaneV3 row — hover visibility", () => {
    beforeEach(async () => {
        await resetService();
        localStorage.setItem("userId", "u-me");
    });

    it("toolbar starts hidden and reveals on row hover", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(
            fakeMessage("m-1", "c-1", {
                userId: "u-alice",
                userName: "Alice",
                userEmail: "a@x",
                avatarImgPath: null,
                isSystemUser: false,
            })
        );
        render(<MessagesPaneV3 channelId="c-1" />);

        const row = screen.getByTestId("message-row-m-1");
        const toolbar = screen.getByTestId("message-row-toolbar-m-1");
        expect(toolbar.getAttribute("data-toolbar-visible")).toBe("false");

        fireEvent.mouseEnter(row);
        expect(toolbar.getAttribute("data-toolbar-visible")).toBe("true");

        fireEvent.mouseLeave(row);
        expect(toolbar.getAttribute("data-toolbar-visible")).toBe("false");
    });

    it("opening the emoji popover keeps the toolbar visible after mouseLeave", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(
            fakeMessage("m-1", "c-1", {
                userId: "u-alice",
                userName: "Alice",
                userEmail: "a@x",
                avatarImgPath: null,
                isSystemUser: false,
            })
        );
        render(<MessagesPaneV3 channelId="c-1" />);

        const row = screen.getByTestId("message-row-m-1");
        fireEvent.mouseEnter(row);

        // Open the popover via the react button.
        fireEvent.click(screen.getByTestId("message-row-react-m-1"));
        expect(screen.getByTestId("message-row-emoji-picker-m-1")).toBeInTheDocument();

        // Mouse leaves — toolbar should stay visible because the popover
        // is open. Closing the popover (re-click react) restores normal
        // hover semantics.
        fireEvent.mouseLeave(row);
        expect(
            screen.getByTestId("message-row-toolbar-m-1").getAttribute("data-toolbar-visible")
        ).toBe("true");
    });

    it("writes id=`message-<id>` on the row for hash anchor navigation", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(
            fakeMessage("m-1", "c-1", {
                userId: "u-alice",
                userName: "Alice",
                userEmail: "a@x",
                avatarImgPath: null,
                isSystemUser: false,
            })
        );
        render(<MessagesPaneV3 channelId="c-1" />);
        expect(screen.getByTestId("message-row-m-1").id).toBe("message-m-1");
    });
});

describe("useCopyMessageLink (integration via the row)", () => {
    beforeEach(async () => {
        await resetService();
        localStorage.setItem("userId", "u-me");
    });

    it("click on copy-link writes the deep-link URL to navigator.clipboard", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText },
            configurable: true,
        });

        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(
            fakeMessage("m-1", "c-1", {
                userId: "u-alice",
                userName: "Alice",
                userEmail: "a@x",
                avatarImgPath: null,
                isSystemUser: false,
            })
        );
        render(<MessagesPaneV3 channelId="c-1" />);

        // jsdom doesn't honor pointer-events at the dispatch layer; the
        // click goes through whether or not we hovered first. Production
        // users would never reach an invisible button — that's enforced
        // by the visibility test above.
        fireEvent.click(screen.getByTestId("message-row-copy-link-m-1"));

        expect(writeText).toHaveBeenCalledTimes(1);
        const url = writeText.mock.calls[0][0] as string;
        expect(url).toContain("/workspace/v3/c-1#message-m-1");
    });
});
