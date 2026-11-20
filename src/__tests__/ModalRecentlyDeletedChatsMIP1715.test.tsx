/**
 * MIP-1715: the "Recently deleted groups" dialog. It lists the groups the caller deleted and may
 * restore; Restore asks first (the confirm text says what a restore cannot bring back), then
 * restores, drops the row and says so. A 404 means the row was stale; any other failure keeps the
 * row and the dialog open.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModalRecentlyDeletedChats } from "../features/chat/components/modals/ModalRecentlyDeletedChats";
import { en } from "../i18n/locales/en";
import { channelService, ChannelServiceError } from "../services/channel/channelService";

const copy = en.common.recentlyDeleted;

const ROWS = [
    {
        id: "g-1",
        title: "Launch crew",
        isPrivate: true,
        deletedAt: "2026-11-19T10:00:00Z",
        memberCount: 4,
    },
    {
        id: "g-2",
        title: "Book club",
        isPrivate: false,
        deletedAt: "2026-11-18T10:00:00Z",
        memberCount: 1,
    },
];

let list: ReturnType<typeof vi.spyOn>;
let restore: ReturnType<typeof vi.spyOn>;

const show = (open = true) =>
    render(
        <CssVarsProvider>
            <ModalRecentlyDeletedChats open={open} teamId="team-1" onClose={vi.fn()} />
        </CssVarsProvider>
    );

// `hidden: true`: while the confirm dialog is open the list behind it is aria-hidden.
const restoreButton = (name: string) =>
    screen.getByRole("button", { name: `Restore ${name}`, hidden: true }) as HTMLButtonElement;

beforeEach(() => {
    list = vi.spyOn(channelService, "listDeletedChannels").mockResolvedValue(ROWS);
    restore = vi.spyOn(channelService, "restoreChannel").mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("the recently-deleted dialog", () => {
    it("lists the groups of the given team with their member counts", async () => {
        show();

        expect(await screen.findByText("Launch crew")).toBeTruthy();
        expect(screen.getByText("Book club")).toBeTruthy();
        expect(list).toHaveBeenCalledWith("team-1");
        expect(screen.getByText(/Members: 4/)).toBeTruthy();
        expect(screen.getByText(/Members: 1/)).toBeTruthy();
    });

    it("says so when there is nothing to restore", async () => {
        list.mockResolvedValue([]);
        show();
        expect(await screen.findByText(copy.emptyTitle)).toBeTruthy();
        expect(screen.getByText(copy.emptyBody)).toBeTruthy();
    });

    it("reads nothing while closed, and reads again on every opening", async () => {
        const view = show(false);
        expect(list).not.toHaveBeenCalled();

        view.rerender(
            <CssVarsProvider>
                <ModalRecentlyDeletedChats teamId="team-1" open onClose={vi.fn()} />
            </CssVarsProvider>
        );
        await screen.findByText("Launch crew");
        expect(list).toHaveBeenCalledTimes(1);

        view.rerender(
            <CssVarsProvider>
                <ModalRecentlyDeletedChats open={false} teamId="team-1" onClose={vi.fn()} />
            </CssVarsProvider>
        );
        view.rerender(
            <CssVarsProvider>
                <ModalRecentlyDeletedChats teamId="team-1" open onClose={vi.fn()} />
            </CssVarsProvider>
        );
        await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    });

    it("shows a load error and Try again reads the list again", async () => {
        list.mockRejectedValueOnce(new Error("offline"));
        show();

        expect(await screen.findByText(copy.loadError)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: en.common.actions.retry }));

        expect(await screen.findByText("Launch crew")).toBeTruthy();
        expect(screen.queryByText(copy.loadError)).toBeNull();
    });

    it("Restore asks first, says what a restore cannot bring back, and restores nothing on Cancel", async () => {
        show();
        await screen.findByText("Launch crew");

        fireEvent.click(restoreButton("Launch crew"));

        const dialog = await screen.findByRole("dialog", { name: copy.confirmTitle });
        expect(within(dialog).getByText(copy.confirmDescription)).toBeTruthy();
        expect(copy.confirmDescription).toMatch(/notes/);
        fireEvent.click(within(dialog).getByRole("button", { name: copy.cancel }));

        expect(restore).not.toHaveBeenCalled();
        expect(restoreButton("Launch crew")).toBeTruthy();
    });

    it("confirming restores that group, drops its row, keeps the other, and says it was restored", async () => {
        show();
        await screen.findByText("Launch crew");
        fireEvent.click(restoreButton("Launch crew"));
        const dialog = await screen.findByRole("dialog", { name: copy.confirmTitle });

        fireEvent.click(within(dialog).getByRole("button", { name: copy.confirm }));

        await waitFor(() => expect(restore).toHaveBeenCalledWith("g-1"));
        expect(await screen.findByText('"Launch crew" was restored.')).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Restore Launch crew" })).toBeNull();
        expect(restoreButton("Book club")).toBeTruthy();
    });

    it("a 404 means the row was stale: it goes, with a note, and the dialog does not stay stuck", async () => {
        restore.mockRejectedValue(new ChannelServiceError("NOT_FOUND", "Not found."));
        show();
        await screen.findByText("Launch crew");
        fireEvent.click(restoreButton("Launch crew"));
        const dialog = await screen.findByRole("dialog", { name: copy.confirmTitle });

        fireEvent.click(within(dialog).getByRole("button", { name: copy.confirm }));

        expect(await screen.findByText('"Launch crew" can no longer be restored.')).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Restore Launch crew" })).toBeNull();
    });

    it("any other failure keeps the row and shows the error in the dialog", async () => {
        restore.mockRejectedValue(new ChannelServiceError("BACKEND_ERROR", "boom"));
        show();
        await screen.findByText("Launch crew");
        fireEvent.click(restoreButton("Launch crew"));
        const dialog = await screen.findByRole("dialog", { name: copy.confirmTitle });

        fireEvent.click(within(dialog).getByRole("button", { name: copy.confirm }));

        expect(await within(dialog).findByText(copy.restoreError)).toBeTruthy();
        expect(restoreButton("Launch crew")).toBeTruthy();
        expect(screen.queryByText('"Launch crew" was restored.')).toBeNull();
    });
});
