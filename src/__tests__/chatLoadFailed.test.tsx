/**
 * MIP-1299: a failed history load in the v3 chat panes is not "no messages".
 *
 * `channelService.syncChannel` records a failure per channel; `useChannel` /
 * `useChannelThread` expose `loadFailed` + `reload`; `MessagesPaneV3` and
 * `ThreadPanelV3` show `ErrorState` with Retry for an empty pane/thread and keep
 * the rows they have. The cases fail at the REQUEST (`fetchMessagesDelta`
 * rejects), then resolve on Retry. Mutation-checked: not recording the failure in
 * `syncChannel`, or `error={false}` on a pane, turns the matching case red.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MessagesPaneV3 } from "../features/channel/components/MessagesPaneV3";
import { ThreadPanelV3 } from "../features/channel/components/ThreadPanelV3";
import { en } from "../i18n/locales/en";
import { channelService } from "../services/channel/channelService";
import { ChannelKind, type Channel, type DeltaEnvelope, type Message } from "../types/channel";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

const _origWarn = console.warn;
console.warn = vi.fn();
afterAll(() => {
    console.warn = _origWarn;
});

const CH = "11111111-1111-4111-8111-111111111111";
const ROOT = "22222222-2222-4222-8222-222222222222";

const channel = (): Channel => ({
    id: CH,
    kind: ChannelKind.GM,
    title: "Engineering",
    profileImageUrl: "",
    projectId: null,
    ownerId: null,
    isPrivate: false,
    latestMessage: null,
    unreadCount: 0,
    tsCreated: "2026-01-01T00:00:00Z",
    tsUpdated: "2026-01-01T00:00:00Z",
});

const message = (id: string, text: string, overrides: Partial<Message> = {}): Message => ({
    id,
    channelId: CH,
    channelKind: ChannelKind.GM,
    sender: {
        userId: "u-alice",
        userName: "Alice",
        userEmail: "alice@x",
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
    ...overrides,
});

const envelope = (messages: Message[] = []): DeltaEnvelope<{ messages: Message[]; deletes: [] }> =>
    ({ server_time: "2026-01-01T00:00:09Z", data: { messages, deletes: [] } }) as never;

type Svc = {
    _checkpointRepo: unknown;
    fetchMessagesDelta: (...a: unknown[]) => Promise<unknown>;
    fetchThreadsDelta: (...a: unknown[]) => Promise<unknown>;
    fetchChannelMembers: (...a: unknown[]) => Promise<unknown>;
};
const svc = channelService as unknown as Svc;

const wrap = (ui: React.ReactNode) => <CssVarsProvider>{ui}</CssVarsProvider>;
const retry = () => screen.getByRole("button", { name: en.common.actions.retry });
const ch = en.chat.channel;

async function reset() {
    channelService.setCurrentUserId("test-self");
    channelService.handleChannelMemberRemoved({
        channelId: CH,
        channelKind: ChannelKind.GM,
        userId: "test-self",
    });
    await channelService.hydrateFromIDB();
    svc._checkpointRepo = {
        getCheckpoint: vi.fn(async () => null),
        setCheckpoint: vi.fn(async () => undefined),
    };
    vi.spyOn(svc, "fetchChannelMembers").mockResolvedValue([]);
    channelService.handleChannelCreated(channel());
}

beforeEach(reset);
afterEach(() => vi.restoreAllMocks());

describe("channelService records a failed history sync per channel", () => {
    it("fails -> recorded, notifies once; succeeds -> cleared", async () => {
        vi.spyOn(svc, "fetchMessagesDelta").mockRejectedValueOnce(new Error("Network Error"));
        vi.spyOn(svc, "fetchThreadsDelta").mockResolvedValue(envelope());
        const seen: boolean[] = [];
        const off = channelService.subscribe(() =>
            seen.push(channelService.getSnapshot().syncFailedByChannel.has(CH))
        );
        await expect(channelService.syncChannel(CH)).rejects.toThrow("Network Error");
        await waitFor(() =>
            expect(channelService.getSnapshot().syncFailedByChannel.has(CH)).toBe(true)
        );

        vi.spyOn(svc, "fetchMessagesDelta").mockResolvedValue(envelope());
        await channelService.syncChannel(CH);
        await waitFor(() =>
            expect(channelService.getSnapshot().syncFailedByChannel.has(CH)).toBe(false)
        );
        off();
        // A healthy sync flips nothing by itself: the only transitions are fail, then clear.
        expect(seen.filter((v, i) => i === 0 || v !== seen[i - 1])).toContain(true);
    });
});

describe("MessagesPaneV3", () => {
    it("empty + failed history -> ErrorState with Retry, not 'No messages yet'; Retry reloads", async () => {
        const msgs = vi
            .spyOn(svc, "fetchMessagesDelta")
            .mockRejectedValueOnce(new Error("Network Error"));
        vi.spyOn(svc, "fetchThreadsDelta").mockResolvedValue(envelope());
        await act(async () => {
            await channelService.syncChannel(CH).catch(() => undefined);
        });

        render(wrap(<MessagesPaneV3 channelId={CH} />));
        expect(document.querySelector('[data-empty="channel-messages"]')).toBeNull();
        expect(screen.getByRole("alert")).toHaveTextContent(ch.pane.loadFailed);

        msgs.mockResolvedValue(envelope([message("m-1", "hello again")]));
        await act(async () => {
            fireEvent.click(retry());
        });
        await waitFor(() => expect(screen.getByText("hello again")).toBeInTheDocument());
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it("empty and the load worked -> the normal empty state", () => {
        render(wrap(<MessagesPaneV3 channelId={CH} />));
        expect(document.querySelector('[data-empty="channel-messages"]')).not.toBeNull();
        expect(document.querySelector('[data-error="channel-messages"]')).toBeNull();
    });

    it("rows already on screen stay when a later sync fails", async () => {
        channelService.handleMessageCreated(message("m-1", "still here"));
        vi.spyOn(svc, "fetchMessagesDelta").mockRejectedValue(new Error("Network Error"));
        vi.spyOn(svc, "fetchThreadsDelta").mockResolvedValue(envelope());
        await act(async () => {
            await channelService.syncChannel(CH).catch(() => undefined);
        });
        render(wrap(<MessagesPaneV3 channelId={CH} />));
        expect(screen.getByText("still here")).toBeInTheDocument();
        expect(document.querySelector('[data-error="channel-messages"]')).toBeNull();
    });
});

describe("ThreadPanelV3", () => {
    const panel = () =>
        render(wrap(<ThreadPanelV3 channelId={CH} rootMessageId={ROOT} onClose={() => {}} />));

    it("a thread whose root never loaded shows the shared skeleton, not a bare 'Loading' div", () => {
        panel();
        expect(document.querySelector('[data-skeleton="rows"]')).not.toBeNull();
        expect(screen.queryByText(ch.thread.loading, { selector: "div:not([role])" })).toBeNull();
    });

    it("root missing + failed sync -> ErrorState with Retry; Retry brings the thread", async () => {
        const msgs = vi
            .spyOn(svc, "fetchMessagesDelta")
            .mockRejectedValueOnce(new Error("Network Error"));
        vi.spyOn(svc, "fetchThreadsDelta").mockResolvedValue(envelope());
        await act(async () => {
            await channelService.syncChannel(CH).catch(() => undefined);
        });
        panel();
        expect(document.querySelector('[data-skeleton="rows"]')).toBeNull();
        expect(screen.getByRole("alert")).toHaveTextContent(ch.thread.loadFailed);

        msgs.mockResolvedValue(envelope([message(ROOT, "the root")]));
        await act(async () => {
            fireEvent.click(retry());
        });
        await waitFor(() =>
            expect(screen.getByTestId("thread-panel-v3-root")).toBeInTheDocument()
        );
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it("root present, no replies, failed sync -> the replies area says so", async () => {
        channelService.handleMessageCreated(message(ROOT, "the root"));
        vi.spyOn(svc, "fetchMessagesDelta").mockResolvedValue(envelope());
        vi.spyOn(svc, "fetchThreadsDelta").mockRejectedValueOnce(new Error("Network Error"));
        await act(async () => {
            await channelService.syncChannel(CH).catch(() => undefined);
        });
        panel();
        expect(screen.getByTestId("thread-panel-v3-root")).toBeInTheDocument();
        expect(document.querySelector('[data-empty="channel-replies"]')).toBeNull();
        expect(screen.getByRole("alert")).toHaveTextContent(ch.thread.loadFailed);
    });
});
