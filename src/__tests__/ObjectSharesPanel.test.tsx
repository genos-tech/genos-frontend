/**
 * The shared cross-team panel, exercised where the chat modal cannot reach
 * it: OFFERING an object to a connected team.
 *
 * Offering is the host's half of the design and the guest's is admitting, so
 * the two controls must never both appear on one row. These tests pin that,
 * plus the detail that makes the panel safe to reuse for projects and note
 * folders: the offer list is a caller decision (only a host manager gets
 * one), while add/remove follow the server's `canAdmit`.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { ObjectSharesPanel } from "../components/ui/sharing/ObjectSharesPanel";
import type { UserProps } from "../types/admin";
import type { ObjectShare } from "../types/sharing";

const share = (over: Partial<ObjectShare> = {}): ObjectShare => ({
    grantId: "g1",
    teamId: "22222222-2222-2222-2222-222222222222",
    teamName: "Acme",
    ownerTeamId: "11111111-1111-1111-1111-111111111111",
    ownerTeamName: "Initech",
    roleCeiling: "editor",
    status: "active",
    side: "given",
    canAdmit: false,
    canSetCeiling: false,
    participants: [{ avatarUrl: null, email: "z@acme.test", userId: "u9", userName: "Zoe" }],
    ...over,
});

const renderPanel = (props: Partial<Parameters<typeof ObjectSharesPanel>[0]> = {}) => {
    const handlers = {
        onAdmit: vi.fn().mockResolvedValue(undefined),
        onOffer: vi.fn().mockResolvedValue(undefined),
        onRevoke: vi.fn().mockResolvedValue(undefined),
        onSetCeiling: vi.fn().mockResolvedValue(undefined),
        onWithdraw: vi.fn().mockResolvedValue(undefined),
    };
    render(
        // The admit picker avatars its candidates, which reads the roster
        // from context — the same context the authenticated shell provides.
        <AvatarContextProvider
            value={{
                myself: { userId: "me", userName: "Me" } as unknown as UserProps,
                setMyself: () => {},
                teamMemberProfiles: {},
                setTeamMemberProfiles: () => {},
                socket: null,
                useCM: {} as never,
                useUISM: {} as never,
            }}
        >
            <CssVarsProvider>
                <ObjectSharesPanel
                    borderColor="#ccc"
                    busy={false}
                    error={null}
                    labelColor="#666"
                    myUserId="me"
                    rosterFor={vi.fn().mockResolvedValue([{ userId: "u1", userName: "Ann" }])}
                    shares={[share()]}
                    valueColor="#111"
                    {...handlers}
                    {...props}
                />
            </CssVarsProvider>
        </AvatarContextProvider>
    );
    return handlers;
};

describe("ObjectSharesPanel", () => {
    it("renders nothing when there is neither a share nor a team to offer", () => {
        const { container } = render(
            <CssVarsProvider>
                <ObjectSharesPanel
                    borderColor="#ccc"
                    busy={false}
                    error={null}
                    labelColor="#666"
                    myUserId="me"
                    rosterFor={vi.fn()}
                    shares={[]}
                    valueColor="#111"
                    onAdmit={vi.fn()}
                    onRevoke={vi.fn()}
                    onWithdraw={vi.fn()}
                />
            </CssVarsProvider>
        );
        expect(container.textContent).toBe("");
    });

    it("offers connected teams to a host manager, editing by default", async () => {
        const handlers = renderPanel({
            offerableTeams: [{ teamId: "t9", teamName: "Globex" }],
        });
        await userEvent.click(screen.getByRole("button", { name: "Globex" }));
        expect(handlers.onOffer).toHaveBeenCalledWith("t9", "editor");
    });

    it("offers read-only when the host picks view only", async () => {
        const handlers = renderPanel({
            offerableTeams: [{ teamId: "t9", teamName: "Globex" }],
        });
        await userEvent.click(screen.getByRole("button", { name: /view only/i }));
        await userEvent.click(screen.getByRole("button", { name: "Globex" }));
        expect(handlers.onOffer).toHaveBeenCalledWith("t9", "viewer");
    });

    it("names both teams rather than telling the reader which side they are on", () => {
        renderPanel();
        // Whoever is reading, and even if they belong to both teams.
        expect(screen.getByText(/initech shared this with acme/i)).toBeTruthy();
        expect(screen.queryByText(/you shared this/i)).toBeNull();
    });

    it("lets the host turn the ceiling down", async () => {
        const handlers = renderPanel({ shares: [share({ canSetCeiling: true })] });
        await userEvent.click(screen.getByRole("button", { name: /up to editor/i }));
        await waitFor(() => expect(handlers.onSetCeiling).toHaveBeenCalled());
        expect(handlers.onSetCeiling.mock.calls[0][1]).toBe("viewer");
    });

    it("shows the guest side the ceiling as a label, with nothing to press", () => {
        renderPanel({
            shares: [share({ canAdmit: true, canSetCeiling: false, side: "received" })],
        });
        expect(screen.getByText(/up to editor/i)).toBeTruthy();
        expect(screen.queryByRole("button", { name: /up to editor/i })).toBeNull();
    });

    it("shows no offer control when the caller was given no teams to offer", () => {
        renderPanel({ offerableTeams: [] });
        expect(screen.queryByText(/share with a connected team/i)).toBeNull();
    });

    it("lets a guest manager pick a colleague, and admits the one they pick", async () => {
        const handlers = renderPanel({ shares: [share({ canAdmit: true, side: "received" })] });
        await userEvent.click(screen.getByLabelText(/add someone from your team/i));
        // Typed at, not scanned: a roster of forty was a row of forty
        // buttons before, which is what the autocomplete replaces.
        await userEvent.type(
            await screen.findByPlaceholderText(/add someone from your team/i),
            "An"
        );
        await userEvent.click(await screen.findByRole("option", { name: /ann/i }));
        await waitFor(() => expect(handlers.onAdmit).toHaveBeenCalled());
        expect(handlers.onAdmit.mock.calls[0][1]).toBe("u1");
    });

    it("removes a participant through the caller's own writer", async () => {
        const handlers = renderPanel();
        // `fireEvent`, not `userEvent`: this button sits in a Joy Chip
        // decorator, which the real DOM makes clickable but jsdom reports as
        // `pointer-events: none`, so the user-event pointer check refuses it.
        fireEvent.click(screen.getByLabelText(/remove zoe/i));
        await waitFor(() => expect(handlers.onWithdraw).toHaveBeenCalled());
        expect(handlers.onWithdraw.mock.calls[0][1]).toBe("u9");
    });

    it("ends a whole share when asked", async () => {
        const handlers = renderPanel();
        await userEvent.click(screen.getByLabelText(/stop sharing with this team/i));
        expect(handlers.onRevoke).toHaveBeenCalled();
    });
});
