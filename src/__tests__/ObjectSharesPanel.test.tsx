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

import { ObjectSharesPanel } from "../components/ui/sharing/ObjectSharesPanel";
import type { ObjectShare } from "../types/sharing";

const share = (over: Partial<ObjectShare> = {}): ObjectShare => ({
    grantId: "g1",
    teamId: "22222222-2222-2222-2222-222222222222",
    teamName: "Acme",
    roleCeiling: "editor",
    status: "active",
    side: "given",
    canAdmit: false,
    participants: [{ avatarUrl: null, email: "z@acme.test", userId: "u9", userName: "Zoe" }],
    ...over,
});

const renderPanel = (props: Partial<Parameters<typeof ObjectSharesPanel>[0]> = {}) => {
    const handlers = {
        onAdmit: vi.fn().mockResolvedValue(undefined),
        onOffer: vi.fn().mockResolvedValue(undefined),
        onRevoke: vi.fn().mockResolvedValue(undefined),
        onWithdraw: vi.fn().mockResolvedValue(undefined),
    };
    render(
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

    it("offers connected teams to a host manager", async () => {
        const handlers = renderPanel({
            offerableTeams: [{ teamId: "t9", teamName: "Globex" }],
        });
        await userEvent.click(screen.getByRole("button", { name: "Globex" }));
        expect(handlers.onOffer).toHaveBeenCalledWith("t9");
    });

    it("shows no offer control when the caller was given no teams to offer", () => {
        renderPanel({ offerableTeams: [] });
        expect(screen.queryByText(/share with a connected team/i)).toBeNull();
    });

    it("lets a guest manager pick a colleague, and admits the one they pick", async () => {
        const handlers = renderPanel({ shares: [share({ canAdmit: true, side: "received" })] });
        await userEvent.click(screen.getByLabelText(/add someone from your team/i));
        const candidate = await screen.findByRole("button", { name: "Ann" });
        await userEvent.click(candidate);
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
