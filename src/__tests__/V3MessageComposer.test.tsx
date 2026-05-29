/**
 * `MessageComposerV3` adapter tests.
 *
 * These tests focus on the pure adapter functions (`deriveBodyText`,
 * `draftKeyFor`) and the contract surface a parent surface depends on
 * (testIdPrefix wiring). The BlockNote editor itself isn't tractable
 * to drive via fireEvent in jsdom, so end-to-end send flows that go
 * through the editor are covered by V3AttachmentUpload's attachment-
 * driven integration tests (the channelService.send code path is the
 * same regardless of whether the trigger was text or attachment).
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    deriveBodyText,
    draftKeyFor,
    MessageComposerV3,
} from "../features/channel/components/MessageComposerV3";
import { channelService } from "../services/channel/channelService";
import { ChannelKind, type Channel } from "../types/channel";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

const _origWarn = console.warn;
beforeEach(() => {
    console.warn = vi.fn();
});
afterEach(() => {
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

describe("draftKeyFor", () => {
    it("returns a channel-scoped key when no parentId", () => {
        expect(draftKeyFor("c-1")).toBe("v3-channel:c-1");
    });
    it("namespaces threads separately from the main pane draft", () => {
        const main = draftKeyFor("c-1");
        const thread = draftKeyFor("c-1", "m-root");
        expect(main).not.toBe(thread);
        expect(thread).toBe("v3-channel:c-1:thread:m-root");
    });
    it("different parents → different thread keys (each thread has its own draft)", () => {
        expect(draftKeyFor("c-1", "m-a")).not.toBe(draftKeyFor("c-1", "m-b"));
    });
    it("different channels → different keys", () => {
        expect(draftKeyFor("c-1")).not.toBe(draftKeyFor("c-2"));
    });
    it("legacy chat drafts use a different namespace (no collision risk)", () => {
        // Legacy bnChatEditor keys like `chat:1:42` should not collide
        // with v3 keys for any reasonable input.
        expect(draftKeyFor("42")).not.toBe("chat:1:42");
        expect(draftKeyFor("42")).toMatch(/^v3-channel:/);
    });
});

describe("deriveBodyText", () => {
    it("returns empty string for an empty document", () => {
        expect(deriveBodyText([])).toBe("");
    });

    it("returns empty string for an empty paragraph", () => {
        expect(deriveBodyText([{ type: "paragraph", content: [] }])).toBe("");
    });

    it("extracts plain text", () => {
        expect(
            deriveBodyText([{ type: "paragraph", content: [{ type: "text", text: "hello" }] }])
        ).toBe("hello");
    });

    it("collapses whitespace runs between text nodes", () => {
        const blocks = [
            {
                type: "paragraph",
                content: [
                    { type: "text", text: "hello" },
                    { type: "text", text: "   world" },
                ],
            },
        ];
        expect(deriveBodyText(blocks)).toBe("hello world");
    });

    it("renders user mention as `@userName` inline", () => {
        const blocks = [
            {
                type: "paragraph",
                content: [
                    { type: "text", text: "ping " },
                    { type: "mention", props: { userId: "u-alice", userName: "Alice" } },
                    { type: "text", text: " please" },
                ],
            },
        ];
        expect(deriveBodyText(blocks)).toBe("ping @Alice please");
    });

    it("renders mentionGroup as `@groupName` inline", () => {
        const blocks = [
            {
                type: "paragraph",
                content: [
                    { type: "text", text: "fyi " },
                    {
                        type: "mentionGroup",
                        props: { groupId: "7", groupName: "team-leads", memberCount: "4" },
                    },
                ],
            },
        ];
        expect(deriveBodyText(blocks)).toBe("fyi @team-leads");
    });

    it("recurses into nested children (list items, etc.)", () => {
        const blocks = [
            {
                type: "bulletListItem",
                content: [{ type: "text", text: "outer" }],
                children: [
                    {
                        type: "bulletListItem",
                        content: [{ type: "text", text: "inner" }],
                    },
                ],
            },
        ];
        expect(deriveBodyText(blocks)).toBe("outer inner");
    });

    it("ignores blocks without an array `content` (defensive against malformed input)", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blocks: any[] = [
            { type: "image", props: { url: "x.png" } },
            { type: "paragraph", content: [{ type: "text", text: "after" }] },
        ];
        expect(deriveBodyText(blocks)).toBe("after");
    });

    it("trims leading and trailing whitespace from the preview", () => {
        const blocks = [{ type: "paragraph", content: [{ type: "text", text: "  hi  " }] }];
        expect(deriveBodyText(blocks)).toBe("hi");
    });
});

describe("MessageComposerV3 — render integration", () => {
    beforeEach(() => {
        // Reset the snapshot so each test starts with no channels.
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
    });

    it("mounts with the default testIdPrefix when none is supplied", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        render(<MessageComposerV3 channelId="c-1" currentUserId="u-me" />);
        expect(screen.getByTestId("message-composer-v3")).toBeInTheDocument();
        expect(screen.getByTestId("message-composer-v3-attach")).toBeInTheDocument();
        expect(screen.getByTestId("message-composer-v3-send")).toBeInTheDocument();
        expect(screen.getByTestId("message-composer-v3-file-input")).toBeInTheDocument();
    });

    it("honors a custom testIdPrefix so the parent surface keeps stable selectors", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        render(<MessageComposerV3 channelId="c-1" currentUserId="u-me" testIdPrefix="my-pane" />);
        expect(screen.getByTestId("my-pane")).toBeInTheDocument();
        expect(screen.getByTestId("my-pane-attach")).toBeInTheDocument();
        expect(screen.getByTestId("my-pane-send")).toBeInTheDocument();
        expect(screen.getByTestId("my-pane-file-input")).toBeInTheDocument();
        // No leakage of the default prefix.
        expect(screen.queryByTestId("message-composer-v3")).toBeNull();
    });

    it("send button is initially disabled (empty editor, no attachments)", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        render(<MessageComposerV3 channelId="c-1" currentUserId="u-me" />);
        expect(screen.getByTestId("message-composer-v3-send")).toBeDisabled();
    });
});
