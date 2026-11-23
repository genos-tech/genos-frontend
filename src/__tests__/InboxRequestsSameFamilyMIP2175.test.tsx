/**
 * MIP-2175: the Requests items are the same card as the Activities items. Every request type
 * still renders its chip, its time, the shared unread dot while it is unanswered, and its
 * Approve / Reject actions; answering still does what it did (socket event for types 1-4,
 * HTTP for 5, 7, 8).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InboxBubble } from "../features/inbox/components/InboxBubble";
import type { InboxItemProps } from "../types/common";

vi.mock("../components/editors/bnChatPreview", () => ({
    BnChatPreview: () => <div data-testid="bn-preview" />,
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const claim = vi.fn().mockResolvedValue(true);
vi.mock("../features/admin/services/ownershipClaim", () => ({
    respondToOwnershipClaim: (...a: unknown[]) => claim(...a),
}));
const connection = vi.fn().mockResolvedValue(true);
const share = vi.fn().mockResolvedValue(true);
vi.mock("../features/admin/services/teamConnections", () => ({
    respondToTeamConnection: (...a: unknown[]) => connection(...a),
    respondToExternalShare: (...a: unknown[]) => share(...a),
}));
vi.mock("../features/admin/services/addInboxItem", () => ({
    addInboxItem: vi.fn().mockResolvedValue(null),
}));

const item = (itemType: number): InboxItemProps => ({
    itemId: 100 + itemType,
    itemType,
    itemBody: [{ content: [{ text: "someone is asking" }] }],
    isRead: false,
    requestStatus: "pending",
    tsSent: "2026-07-30T00:00:00Z",
    itemOptionals: { connection_id: "c1", grant_id: "g1", deadline: "2026-08-29T00:00:00Z" },
});

const mount = (i: InboxItemProps, socket: unknown = null) =>
    render(
        <CssVarsProvider>
            <InboxBubble
                inboxItem={i}
                myself={{ userId: "u1", teamId: "t1" } as never}
                setMyself={vi.fn()}
                socket={socket as never}
                useCM={{ allChats: [] } as never}
                useTEM={{ teamMemberProfiles: {} } as never}
                useUISM={{} as never}
            />
        </CssVarsProvider>
    );

const SOCKET_EVENTS: Record<number, [string, string]> = {
    1: ["approve_join_team_request", "reject_join_team_request"],
    2: ["approve_join_project_request", "reject_join_project_request"],
    3: ["approve_join_gm_request", "reject_join_gm_request"],
    4: ["approve_note_access_request", "reject_note_access_request"],
};

describe("every request type is the shared card", () => {
    it.each([1, 2, 3, 4, 5, 7, 8])(
        "type %i: chip, time, unread dot, Approve and Reject",
        (type) => {
            const { container } = mount(item(type));
            expect(container.querySelector('[data-bubble-layout="bubble"]')).not.toBeNull();
            expect(document.querySelector(".MuiChip-root")).not.toBeNull();
            expect(screen.getByTestId("inbox-unread-dot")).toBeTruthy();
            expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
            expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
        }
    );

    it.each([1, 2, 3, 4])("type %i still answers over the socket", (type) => {
        const emit = vi.fn();
        mount(item(type), { emit });
        fireEvent.click(screen.getByRole("button", { name: "Approve" }));
        expect(emit).toHaveBeenCalledWith(SOCKET_EVENTS[type][0], { item_id: 100 + type });
        // answered: the dot goes with the buttons
        expect(screen.queryByTestId("inbox-unread-dot")).toBeNull();
    });

    it.each([1, 2, 3, 4])("type %i reject emits the reject event", (type) => {
        const emit = vi.fn();
        mount(item(type), { emit });
        fireEvent.click(screen.getByRole("button", { name: "Reject" }));
        expect(emit).toHaveBeenCalledWith(SOCKET_EVENTS[type][1], { item_id: 100 + type });
    });

    it.each([
        [5, claim],
        [7, connection],
        [8, share],
    ])("type %i still answers over HTTP", async (type, fn) => {
        mount(item(type));
        fireEvent.click(screen.getByRole("button", { name: "Approve" }));
        await waitFor(() => expect(fn).toHaveBeenCalled());
        await waitFor(() => expect(screen.queryByTestId("inbox-unread-dot")).toBeNull());
    });
});
