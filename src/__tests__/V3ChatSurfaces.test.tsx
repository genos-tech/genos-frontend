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

function fakeReaction(id: string, userId: string, userName: string, emoji: string) {
    return {
        id,
        user: {
            userId,
            userName,
            userEmail: `${userName}@x`,
            avatarImgPath: null,
            isSystemUser: false,
        },
        emoji,
        tsSent: "2026-01-01T00:01:00Z",
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

describe("MessagesPaneV3 — interactions", () => {
    beforeEach(async () => {
        await resetService();
        // The pane reads `userId` from localStorage to decide edit/delete
        // visibility + reaction toggle direction. Stub it for "me".
        localStorage.setItem("userId", "u-me");
    });

    it("calls markRead with the latest message id when the channel is opened", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1", "first"));
        channelService.handleMessageCreated(fakeMessage("m-2", "c-1", "second"));

        const spy = vi.spyOn(channelService, "markRead").mockResolvedValue(undefined);
        render(<MessagesPaneV3 channelId="c-1" />);

        await waitFor(() => {
            expect(spy).toHaveBeenCalledWith("c-1", "m-2");
        });
        spy.mockRestore();
    });

    it("does not call markRead again when the cursor already points at the latest", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1", "hi"));
        channelService.handleReadAdvanced({
            id: "cur-1",
            channelId: "c-1",
            threadRootId: null,
            lastReadMessageId: "m-1",
            lastReadAt: "2026-01-01T00:02:00Z",
        });

        const spy = vi.spyOn(channelService, "markRead").mockResolvedValue(undefined);
        render(<MessagesPaneV3 channelId="c-1" />);

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it("renders own-message edit + delete buttons, but only for own messages", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(
            fakeMessage("m-mine", "c-1", "mine", "Me"),
        );
        channelService.handleMessageCreated(
            fakeMessage("m-theirs", "c-1", "theirs", "Alice"),
        );
        // Override the "Me" sender ids so they match localStorage userId.
        channelService.handleMessageCreated({
            ...fakeMessage("m-mine", "c-1", "mine", "Me"),
            sender: {
                userId: "u-me",
                userName: "Me",
                userEmail: "me@x",
                avatarImgPath: null,
                isSystemUser: false,
            },
        });

        render(<MessagesPaneV3 channelId="c-1" />);
        expect(screen.getByTestId("message-row-edit-m-mine")).toBeInTheDocument();
        expect(screen.getByTestId("message-row-delete-m-mine")).toBeInTheDocument();
        expect(screen.queryByTestId("message-row-edit-m-theirs")).toBeNull();
        expect(screen.queryByTestId("message-row-delete-m-theirs")).toBeNull();
    });

    it("entering edit mode + saving calls channelService.edit with the new text", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated({
            ...fakeMessage("m-1", "c-1", "original", "Me"),
            sender: {
                userId: "u-me",
                userName: "Me",
                userEmail: "me@x",
                avatarImgPath: null,
                isSystemUser: false,
            },
        });
        const spy = vi.spyOn(channelService, "edit").mockResolvedValue(undefined);

        render(<MessagesPaneV3 channelId="c-1" />);
        fireEvent.click(screen.getByTestId("message-row-edit-m-1"));
        const input = screen.getByTestId(
            "message-row-edit-input-m-1",
        ) as HTMLInputElement;
        fireEvent.change(input, { target: { value: "edited body" } });
        fireEvent.click(screen.getByTestId("message-row-edit-save-m-1"));

        await waitFor(() => {
            expect(spy).toHaveBeenCalledWith(
                "m-1",
                [{ type: "paragraph", content: [{ type: "text", text: "edited body" }] }],
                "edited body",
            );
        });
        spy.mockRestore();
    });

    it("clicking delete prompts then calls channelService.deleteMessage on confirm", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated({
            ...fakeMessage("m-1", "c-1", "doomed", "Me"),
            sender: {
                userId: "u-me",
                userName: "Me",
                userEmail: "me@x",
                avatarImgPath: null,
                isSystemUser: false,
            },
        });
        const spy = vi.spyOn(channelService, "deleteMessage").mockResolvedValue(undefined);
        const confirmStub = vi.spyOn(window, "confirm").mockReturnValue(true);

        render(<MessagesPaneV3 channelId="c-1" />);
        fireEvent.click(screen.getByTestId("message-row-delete-m-1"));

        await waitFor(() => {
            expect(spy).toHaveBeenCalledWith("m-1", "c-1", ChannelKind.GM);
        });
        expect(confirmStub).toHaveBeenCalled();
        spy.mockRestore();
        confirmStub.mockRestore();
    });

    it("clicking delete and cancelling does NOT call deleteMessage", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated({
            ...fakeMessage("m-1", "c-1", "safe", "Me"),
            sender: {
                userId: "u-me",
                userName: "Me",
                userEmail: "me@x",
                avatarImgPath: null,
                isSystemUser: false,
            },
        });
        const spy = vi.spyOn(channelService, "deleteMessage").mockResolvedValue(undefined);
        const confirmStub = vi.spyOn(window, "confirm").mockReturnValue(false);

        render(<MessagesPaneV3 channelId="c-1" />);
        fireEvent.click(screen.getByTestId("message-row-delete-m-1"));

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
        confirmStub.mockRestore();
    });

    it("emoji-picker button reveals quick emojis; clicking one calls react()", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        channelService.handleMessageCreated(fakeMessage("m-1", "c-1", "hi", "Alice"));
        const spy = vi.spyOn(channelService, "react").mockResolvedValue(undefined);

        render(<MessagesPaneV3 channelId="c-1" />);
        // Quick-emoji row is hidden until the react button is pressed.
        expect(screen.queryByTestId("message-row-emoji-picker-m-1")).toBeNull();
        fireEvent.click(screen.getByTestId("message-row-react-m-1"));
        expect(screen.getByTestId("message-row-emoji-picker-m-1")).toBeInTheDocument();

        fireEvent.click(screen.getByTestId("message-row-emoji-m-1-🎉"));
        await waitFor(() => {
            expect(spy).toHaveBeenCalledWith("m-1", "c-1", ChannelKind.GM, "🎉");
        });
        spy.mockRestore();
    });

    it("clicking an existing reaction chip MINE toggles unreact()", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        const msg = {
            ...fakeMessage("m-1", "c-1", "hi", "Alice"),
            reactions: [fakeReaction("r-1", "u-me", "Me", "👍")],
        };
        channelService.handleMessageCreated(msg);
        const spy = vi.spyOn(channelService, "unreact").mockResolvedValue(undefined);

        render(<MessagesPaneV3 channelId="c-1" />);
        // The chip exists because of the existing reaction.
        const chip = screen.getByTestId("message-row-reaction-chip-m-1-👍");
        fireEvent.click(chip);

        await waitFor(() => {
            expect(spy).toHaveBeenCalledWith("m-1", "c-1", ChannelKind.GM, "👍");
        });
        spy.mockRestore();
    });

    it("clicking a reaction chip NOT mine adds my reaction via react()", async () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        const msg = {
            ...fakeMessage("m-1", "c-1", "hi", "Alice"),
            reactions: [fakeReaction("r-1", "u-other", "Other", "👍")],
        };
        channelService.handleMessageCreated(msg);
        const spy = vi.spyOn(channelService, "react").mockResolvedValue(undefined);

        render(<MessagesPaneV3 channelId="c-1" />);
        fireEvent.click(screen.getByTestId("message-row-reaction-chip-m-1-👍"));

        await waitFor(() => {
            expect(spy).toHaveBeenCalledWith("m-1", "c-1", ChannelKind.GM, "👍");
        });
        spy.mockRestore();
    });

    it("groups reactions by emoji and shows per-emoji counts", () => {
        channelService.handleChannelCreated(fakeChannel("c-1"));
        const msg = {
            ...fakeMessage("m-1", "c-1", "hi", "Alice"),
            reactions: [
                fakeReaction("r-1", "u-a", "Alpha", "👍"),
                fakeReaction("r-2", "u-b", "Beta", "👍"),
                fakeReaction("r-3", "u-c", "Gamma", "🎉"),
            ],
        };
        channelService.handleMessageCreated(msg);

        render(<MessagesPaneV3 channelId="c-1" />);
        const thumb = screen.getByTestId("message-row-reaction-chip-m-1-👍");
        const party = screen.getByTestId("message-row-reaction-chip-m-1-🎉");
        expect(thumb).toHaveTextContent("👍 2");
        expect(party).toHaveTextContent("🎉 1");
    });
});
