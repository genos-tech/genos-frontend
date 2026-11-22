/**
 * MIP-1694: the group-chat directory. It lists the team's public group chats with their one-line
 * description and member count, searches by word, pages, and joins (or opens) a chat from a row.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModalGroupDirectory } from "../features/chat/components/modals/ModalGroupDirectory";
import { en } from "../i18n/locales/en";
import { channelService } from "../services/channel/channelService";

const copy = en.chat.groupDirectory;

const row = (over: Record<string, unknown> = {}) => ({
    id: "c-1",
    title: "Design",
    description: "Pixels and taste",
    profileImageUrl: null,
    memberCount: 12,
    isJoined: false,
    tsCreated: "2026-11-01T00:00:00Z",
    ...over,
});

const CHANNEL = {
    id: "c-1",
    kind: 2,
    title: "Design",
    description: "Pixels and taste",
    profileImageUrl: "",
    isPrivate: false,
    tsCreated: "2026-11-01T00:00:00Z",
};

let list: ReturnType<typeof vi.spyOn>;
const useCM = { setCurrentMainChat: vi.fn(), setIsMainChatVisible: vi.fn() };
const onClose = vi.fn();

const show = () =>
    render(
        <CssVarsProvider>
            <ModalGroupDirectory
                myself={{ teamId: "team-1" } as never}
                useCM={useCM as never}
                open
                onClose={onClose}
            />
        </CssVarsProvider>
    );

beforeEach(() => {
    list = vi
        .spyOn(channelService, "listChannelDirectory")
        .mockResolvedValue({ results: [row()], total: 1, hasMore: false });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    useCM.setCurrentMainChat.mockClear();
    onClose.mockClear();
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("the group-chat directory", () => {
    it("lists chats of the team with description and member count", async () => {
        show();

        expect(await screen.findByText("Design")).toBeTruthy();
        expect(screen.getByText("Pixels and taste")).toBeTruthy();
        expect(screen.getByText("Members: 12")).toBeTruthy();
        expect(list).toHaveBeenCalledWith("team-1", { q: "", offset: 0, limit: 24 });
    });

    it("says there is no description for a chat without one", async () => {
        list.mockResolvedValue({ results: [row({ description: "" })], total: 1, hasMore: false });
        show();

        expect(await screen.findByText(copy.noDescription)).toBeTruthy();
    });

    it("searches by the typed word", async () => {
        show();
        await screen.findByText("Design");

        fireEvent.change(screen.getByLabelText(copy.searchAria), { target: { value: "des" } });

        await waitFor(() =>
            expect(list).toHaveBeenLastCalledWith("team-1", { q: "des", offset: 0, limit: 24 })
        );
    });

    it("joins a chat from its row and opens it", async () => {
        const join = vi.spyOn(channelService, "joinChannel").mockResolvedValue(CHANNEL as never);
        show();

        fireEvent.click(await screen.findByRole("button", { name: "Join Design" }));

        await waitFor(() => expect(join).toHaveBeenCalledWith("c-1"));
        await waitFor(() => expect(useCM.setCurrentMainChat).toHaveBeenCalled());
        expect(useCM.setCurrentMainChat.mock.calls[0][0]).toMatchObject({
            chatId: "c-1",
            chatType: 2,
            description: "Pixels and taste",
        });
        expect(onClose).toHaveBeenCalled();
    });

    it("shows an error and keeps the dialog when the join fails", async () => {
        vi.spyOn(channelService, "joinChannel").mockRejectedValue(new Error("no"));
        show();

        fireEvent.click(await screen.findByRole("button", { name: "Join Design" }));

        expect(await screen.findByText(copy.joinError)).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
    });

    it("offers more when the server says there is more, and appends the next page", async () => {
        list.mockResolvedValueOnce({ results: [row()], total: 2, hasMore: true });
        list.mockResolvedValueOnce({
            results: [row({ id: "c-2", title: "Ops" })],
            total: 2,
            hasMore: false,
        });
        show();
        await screen.findByText("Design");

        fireEvent.click(screen.getByRole("button", { name: "Show more (1 of 2)" }));

        expect(await screen.findByText("Ops")).toBeTruthy();
        expect(screen.getByText("Design")).toBeTruthy();
        expect(list).toHaveBeenLastCalledWith("team-1", { q: "", offset: 1, limit: 24 });
    });

    it("says so when the team has no public chats", async () => {
        list.mockResolvedValue({ results: [], total: 0, hasMore: false });
        show();

        expect(await screen.findByText(copy.emptyTitle)).toBeTruthy();
    });
});
