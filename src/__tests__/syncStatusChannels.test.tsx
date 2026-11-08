/**
 * MIP-1298: the chat list. `channelService.listChannels` reports whether the
 * channel list loaded; an EMPTY `ChannelListV3` says "couldn't load your chats"
 * (with Retry) when it did not, and "No chats yet" only when the list loaded
 * and was empty. A list with rows keeps them.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChannelListV3 } from "../features/channel/components/ChannelListV3";
import { en } from "../i18n/locales/en";
import { channelService } from "../services/channel/channelService";
import { syncStatus } from "../services/syncStatus";
import { ChannelKind, type Channel } from "../types/channel";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

type Listing = { _doListChannels: () => Promise<Channel[]> };
const stub = () => vi.spyOn(channelService as unknown as Listing, "_doListChannels");
const s = en.common.feedback.sync;

const list = () =>
    render(
        <CssVarsProvider>
            <ChannelListV3 selectedChannelId={null} onSelect={() => {}} />
        </CssVarsProvider>
    );

beforeEach(async () => {
    syncStatus.__reset();
    channelService.setCurrentUserId(null);
    channelService.resetIdbHealth();
    await channelService.hydrateFromIDB();
    vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
    channelService.setAccessToken(null);
    vi.restoreAllMocks();
});

describe("chat list: could not load vs no chats", () => {
    it("a failed listChannels is reported; a later good one clears it", async () => {
        channelService.setAccessToken("tok");
        stub().mockRejectedValueOnce(new Error("Network Error"));
        await expect(channelService.listChannels()).rejects.toThrow();
        await waitFor(() => expect(syncStatus.getSnapshot().failed).toEqual(["channels"]));

        stub().mockResolvedValueOnce([]);
        await channelService.listChannels();
        await waitFor(() => expect(syncStatus.getSnapshot().failed).toEqual([]));
    });

    it("a call before any token exists is not a failure", async () => {
        stub().mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
        await expect(channelService.listChannels()).rejects.toThrow();
        expect(syncStatus.getSnapshot().failed).toEqual([]);
    });

    it("empty list + failed load -> ErrorState with Retry, not 'No chats yet'", async () => {
        const retrySync = vi.fn();
        syncStatus.setRetry(retrySync);
        list();
        expect(document.querySelector('[data-empty="channel-list"]')).not.toBeNull();

        act(() => syncStatus.report("channels", false));
        expect(document.querySelector('[data-empty="channel-list"]')).toBeNull();
        expect(screen.getByRole("alert")).toHaveTextContent(s.chatsFailed);
        fireEvent.click(screen.getByRole("button", { name: en.common.actions.retry }));
        expect(retrySync).toHaveBeenCalledTimes(1);

        act(() => syncStatus.report("channels", true));
        expect(document.querySelector('[data-empty="channel-list"]')).not.toBeNull();
    });

    it("a list that has chats keeps them when the refresh fails", () => {
        channelService.handleChannelCreated({
            id: "c-1",
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
        syncStatus.report("channels", false);
        list();
        expect(screen.getByTestId("channel-list-v3-item-c-1")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).toBeNull();
    });
});
