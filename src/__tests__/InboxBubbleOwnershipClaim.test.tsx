/**
 * InboxBubble — team-ownership claims (itemType 5).
 *
 * WHY THIS SUITE MATTERS MORE THAN A NORMAL CARD TEST. An ownership
 * claim is finalizable by the person who filed it once the owner has
 * stayed silent past the deadline. So "the owner saw it and could
 * answer" is the thing that makes finalizing legitimate. If this card
 * fails to render its buttons, the owner loses the team by default —
 * silently, and with no way to have prevented it.
 *
 * The card also diverges from types 1-4 in HOW it answers: those emit
 * Socket.IO events, this one calls the HTTP endpoints where the locked
 * transaction lives. A test that only asserts buttons exist would pass
 * with that wiring wrong, so the call itself is asserted.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InboxBubble } from "../features/inbox/components/InboxBubble";
import type { InboxItemProps } from "../types/common";

vi.mock("../components/editors/bnChatPreview", () => ({
    BnChatPreview: () => <div data-testid="bn-preview" />,
}));

const respond = vi.fn().mockResolvedValue(true);
vi.mock("../features/admin/services/ownershipClaim", () => ({
    respondToOwnershipClaim: (...args: unknown[]) => respond(...args),
}));

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const claimItem: InboxItemProps = {
    itemId: 77,
    itemType: 5,
    itemBody: [{ content: [{ text: "editor is requesting ownership" }] }],
    isRead: false,
    requestStatus: "pending",
    tsSent: "2026-07-30T00:00:00Z",
    itemOptionals: {
        kind: "team_ownership_claim",
        team_name: "Acme",
        deadline: "2026-08-29T00:00:00Z",
    },
};

const renderBubble = (item: InboxItemProps, socket: unknown = null) =>
    render(
        <CssVarsProvider>
            <InboxBubble
                inboxItem={item}
                myself={{ userId: "u1", teamId: "t1" } as never}
                setMyself={vi.fn()}
                socket={socket as never}
                useCM={{ allChats: [] } as never}
                useTEM={{ teamMemberProfiles: {} } as never}
                useUISM={{} as never}
            />
        </CssVarsProvider>
    );

describe("InboxBubble ownership claim", () => {
    it("gives the owner a way to answer", () => {
        // THE load-bearing assertion. Without buttons the owner cannot
        // reject, and their silence — the only thing that authorises a
        // takeover — would be manufactured by the UI.
        renderBubble(claimItem);
        expect(screen.getByRole("button", { name: /approve/i })).toBeTruthy();
        expect(screen.getByRole("button", { name: /reject/i })).toBeTruthy();
    });

    it("rejects over HTTP, not the socket events types 1-4 use", async () => {
        const emit = vi.fn();
        renderBubble(claimItem, { emit });
        fireEvent.click(screen.getByRole("button", { name: /reject/i }));
        await waitFor(() =>
            expect(respond).toHaveBeenCalledWith("tok", 77, "reject", expect.anything())
        );
        expect(emit).not.toHaveBeenCalled();
    });

    it("approves over HTTP", async () => {
        respond.mockClear();
        renderBubble(claimItem);
        fireEvent.click(screen.getByRole("button", { name: /approve/i }));
        await waitFor(() =>
            expect(respond).toHaveBeenCalledWith("tok", 77, "approve", expect.anything())
        );
    });

    it("shows the date by which doing nothing costs the team", () => {
        renderBubble(claimItem);
        // `extractYYYYMMDD` renders "Aug. 29, 2026", not an ISO string.
        expect(screen.getByText(/Aug\. 29, 2026/)).toBeTruthy();
    });

    it("drops the deadline once the claim has been answered", () => {
        renderBubble({ ...claimItem, requestStatus: "rejected" });
        expect(screen.queryByText(/Aug\. 29, 2026/)).toBeNull();
    });

    it("leaves the socket types alone", () => {
        // Regression guard for the HTTP branch swallowing types 1-4.
        const emit = vi.fn();
        renderBubble({ ...claimItem, itemType: 1, itemOptionals: null }, { emit });
        fireEvent.click(screen.getByRole("button", { name: /approve/i }));
        expect(emit).toHaveBeenCalledWith("approve_join_team_request", { item_id: 77 });
    });
});
