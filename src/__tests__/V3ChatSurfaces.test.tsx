/**
 * Component tests for the v3 chat surfaces.
 *
 * We exercise `ChannelListV3` and `MessagesPaneV3` against the live
 * `channelService` singleton — seeding it via `handleChannelCreated` /
 * `handleMessageCreated` is exactly how the socket router would
 * populate it at runtime, so we get realistic coverage of the
 * useSyncExternalStore re-render path with no additional mocking.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ChannelListV3 } from "../features/channel/components/ChannelListV3";
import { MessagesPaneV3 } from "../features/channel/components/MessagesPaneV3";
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

/** Reset the channelService singleton state between tests. The class
 *  doesn't expose a `.clear()` so we touch the private maps via the
 *  member-removed self-eject path. Brittle but bounded — once the
 *  service grows a `.clear()` we'll switch to that. */
async function resetService() {
    const snap = channelService.getSnapshot();
    for (const id of Array.from(snap.channels.keys())) {
        // member.removed with userId == currentUserId triggers the
        // self-remove cleanup path which drops everything for that
        // channel out of the maps.
        channelService.setCurrentUserId("test-self");
        channelService.handleChannelMemberRemoved({
            channelId: id,
            channelKind: ChannelKind.GM,
            userId: "test-self",
        });
    }
    // Flip the hydration flag so the hooks return the loaded state
    // (not "still loading"). The IDB shim throws so hydrateFromIDB
    // exits through its `catch`, but the `finally` block still flips
    // the flag and notifies — which is the production behavior when
    // a user opens the app without any cached data.
    await channelService.hydrateFromIDB();
}

describe("ChannelListV3", () => {
    beforeEach(async () => {
        await resetService();
    });

    it("renders an empty state when there are no channels", () => {
        render(<ChannelListV3 selectedChannelId={null} onSelect={() => {}} />);
        expect(screen.getByText("No channels yet.")).toBeInTheDocument();
    });

    it("renders channels with their unread badges and total in the header", () => {
        channelService.handleChannelCreated(
            fakeChannel("c-1", { title: "Engineering", unreadCount: 3 })
        );
        channelService.handleChannelCreated(
            fakeChannel("c-2", { title: "Random", unreadCount: 1 })
        );

        render(<ChannelListV3 selectedChannelId={null} onSelect={() => {}} />);

        expect(screen.getByText("Engineering")).toBeInTheDocument();
        expect(screen.getByText("Random")).toBeInTheDocument();
        // Per-channel unread badges
        expect(screen.getByText("3")).toBeInTheDocument();
        expect(screen.getByText("1")).toBeInTheDocument();
        // Total in header (3 + 1 = 4)
        expect(screen.getByText("4")).toBeInTheDocument();
    });

    it("sorts channels by latestMessage.tsSent desc", () => {
        channelService.handleChannelCreated(
            fakeChannel("c-old", {
                title: "Old",
                latestMessage: fakeMessage("m-old", "c-old", "old", "Alice"),
            })
        );
        channelService.handleChannelCreated(
            fakeChannel("c-new", {
                title: "New",
                latestMessage: {
                    ...fakeMessage("m-new", "c-new", "new", "Bob"),
                    tsSent: "2026-01-02T00:00:00Z",
                },
            })
        );

        render(<ChannelListV3 selectedChannelId={null} onSelect={() => {}} />);
        const items = screen.getAllByTestId(/channel-list-v3-item-/);
        expect(items[0]).toHaveTextContent("New");
        expect(items[1]).toHaveTextContent("Old");
    });

    it("invokes onSelect when a channel row is clicked", () => {
        channelService.handleChannelCreated(fakeChannel("c-1", { title: "C1" }));
        const onSelect = vi.fn();
        render(<ChannelListV3 selectedChannelId={null} onSelect={onSelect} />);
        fireEvent.click(screen.getByTestId("channel-list-v3-item-c-1"));
        expect(onSelect).toHaveBeenCalledWith("c-1");
    });
});

describe("MessagesPaneV3", () => {
    beforeEach(async () => {
        await resetService();
    });

    it("renders 'not in store' once hydration is done but the channel id is unknown", () => {
        render(<MessagesPaneV3 channelId="absent" />);
        expect(screen.getByText(/not in store/)).toBeInTheDocument();
    });

    it("renders messages once the channel + messages are in the store", () => {
        channelService.handleChannelCreated(fakeChannel("c-1", { title: "Smoke" }));
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1", "hi", "Alice"));
        channelService.handleMessageCreated(fakeMessage("m-2", "c-1", "world", "Bob"));

        render(<MessagesPaneV3 channelId="c-1" />);
        expect(screen.getByText("Smoke", { exact: false })).toBeInTheDocument();
        expect(screen.getByText(/Alice:/)).toBeInTheDocument();
        expect(screen.getByText(/Bob:/)).toBeInTheDocument();
        expect(screen.getByText("hi")).toBeInTheDocument();
        expect(screen.getByText("world")).toBeInTheDocument();
    });

    it("re-renders live when a new message arrives via channelService", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        render(<MessagesPaneV3 channelId="c-1" />);

        expect(screen.getByText("No messages yet.")).toBeInTheDocument();
        act(() => {
            channelService.handleMessageCreated(
                fakeMessage("m-live", "c-1", "live update", "Alice")
            );
        });
        await waitFor(() => {
            expect(screen.getByText("live update")).toBeInTheDocument();
        });
    });

    it("renders soft-deleted messages with a '(deleted)' marker", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1", "real text", "Alice"));
        channelService.handleMessageDeleted({
            id: "m-1",
            channelId: "c-1",
            channelKind: ChannelKind.GM,
        });

        render(<MessagesPaneV3 channelId="c-1" />);
        expect(screen.getByText("(deleted)")).toBeInTheDocument();
        // Original body text replaced with marker, no longer visible.
        expect(screen.queryByText("real text")).toBeNull();
    });

    it("send button is disabled when the draft is empty", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        render(<MessagesPaneV3 channelId="c-1" />);
        const send = screen.getByTestId("messages-pane-v3-send");
        expect(send).toBeDisabled();

        const input = screen.getByTestId("messages-pane-v3-input") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "hi" } });
        expect(send).not.toBeDisabled();
    });

    it("surfaces a DISCONNECTED error when send is clicked with no socket", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        render(<MessagesPaneV3 channelId="c-1" />);
        const input = screen.getByTestId("messages-pane-v3-input") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "hi" } });
        fireEvent.click(screen.getByTestId("messages-pane-v3-send"));

        await waitFor(() => {
            expect(screen.getByText(/DISCONNECTED/)).toBeInTheDocument();
        });
    });
});
