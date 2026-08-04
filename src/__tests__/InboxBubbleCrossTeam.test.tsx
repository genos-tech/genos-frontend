/**
 * The cross-team cards in the inbox (item types 7 and 8).
 *
 * Both shipped invisible: the bubble knew types 1-5, so a connection
 * request rendered as a bordered box with a date and nothing else — no
 * label, no body, and above all no Approve button, on the one request that
 * cannot be answered anywhere else in the product. These tests pin the
 * three parts of that fix, and that answering goes over HTTP (their rules
 * live in a Django transaction, so there are no socket events for them).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InboxBubble } from "../features/inbox/components/InboxBubble";
import type { InboxItemProps } from "../types/common";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const respondToTeamConnection = vi.fn().mockResolvedValue(true);
const respondToExternalShare = vi.fn().mockResolvedValue(true);
vi.mock("../features/admin/services/teamConnections", () => ({
    respondToExternalShare: (...args: unknown[]) => respondToExternalShare(...args),
    respondToTeamConnection: (...args: unknown[]) => respondToTeamConnection(...args),
}));

const addInboxItem = vi.fn().mockResolvedValue(undefined);
vi.mock("../features/admin/services/addInboxItem", () => ({
    addInboxItem: (...args: unknown[]) => addInboxItem(...args),
}));

vi.mock("../features/admin/services/ownershipClaim", () => ({
    respondToOwnershipClaim: vi.fn().mockResolvedValue(true),
}));

// The body renders through the BlockNote preview, which pulls in the whole
// editor; what matters here is that the text reaches the card.
vi.mock("../components/messageBody/MessageBody", () => ({
    MessageBody: ({ content }: { content: { content?: { text?: string }[] }[] }) => (
        <div data-testid="body">
            {content.flatMap((b) => (b.content ?? []).map((s) => s.text)).join("")}
        </div>
    ),
}));

vi.mock("../hooks/common/UrlLinkModalContext", () => ({
    useUrlLinkModal: () => null,
}));

const body = (text: string) => [
    { type: "paragraph", props: {}, content: [{ text, type: "text", styles: {} }], children: [] },
];

const renderBubble = (item: Partial<InboxItemProps>, onItemChanged = vi.fn()) => {
    render(
        <CssVarsProvider>
            <InboxBubble
                inboxItem={
                    {
                        itemId: 9,
                        itemBody: body("Acme would like to connect with your team."),
                        isRead: false,
                        requestStatus: "pending",
                        tsSent: "2026-08-04T00:00:00Z",
                        ...item,
                    } as InboxItemProps
                }
                myself={{ userId: "u", teamId: "t" } as never}
                setMyself={vi.fn()}
                socket={null}
                useCM={{ allChats: [] } as never}
                useTEM={{ currentTeam: {}, teamMemberProfiles: {} } as never}
                useUISM={{} as never}
                onItemChanged={onItemChanged}
            />
        </CssVarsProvider>
    );
    return onItemChanged;
};

describe("InboxBubble — cross-team requests", () => {
    beforeEach(() => {
        respondToTeamConnection.mockClear();
        respondToExternalShare.mockClear();
        addInboxItem.mockClear();
    });

    it("shows a connection request with its body and an Approve button", () => {
        renderBubble({ itemType: 7, itemOptionals: { connection_id: "c-1" } });

        expect(screen.getByText("Team Connection")).toBeTruthy();
        expect(screen.getByTestId("body").textContent).toContain("Acme would like to connect");
        expect(screen.getByText("Approve")).toBeTruthy();
    });

    it("approves a connection over HTTP and remembers the answer", async () => {
        const onItemChanged = renderBubble({
            itemType: 7,
            itemOptionals: { connection_id: "c-1" },
        });

        fireEvent.click(screen.getByText("Approve"));

        await waitFor(() => expect(respondToTeamConnection).toHaveBeenCalled());
        const [, connectionId, accept] = respondToTeamConnection.mock.calls[0];
        expect(connectionId).toBe("c-1");
        expect(accept).toBe(true);
        // Persisted, not just local state: these rows recycle inside a
        // virtualised list, so a card that only flipped state came back
        // offering Approve on a request already answered.
        await waitFor(() =>
            expect(addInboxItem).toHaveBeenCalledWith(
                expect.objectContaining({ requestStatus: "approved", isRead: true })
            )
        );
        await waitFor(() => expect(onItemChanged).toHaveBeenCalled());
    });

    it("declines a share offer with the grant it names", async () => {
        renderBubble({
            itemType: 8,
            itemBody: body("Acme shared a project with your team."),
            itemOptionals: { grant_id: "g-1", object_type: "project" },
        });

        expect(screen.getByText("Shared With Your Team")).toBeTruthy();
        fireEvent.click(screen.getByText("Reject"));

        await waitFor(() => expect(respondToExternalShare).toHaveBeenCalled());
        const [, grantId, accept] = respondToExternalShare.mock.calls[0];
        expect(grantId).toBe("g-1");
        expect(accept).toBe(false);
    });

    it("says so rather than silently doing nothing when the id is missing", async () => {
        // Rows written before the optionals carried ids, or by hand. The
        // button must not report success for a request it never sent.
        renderBubble({ itemType: 7, itemOptionals: {} });

        fireEvent.click(screen.getByText("Approve"));

        await waitFor(() => expect(screen.getByText(/Couldn’t respond/)).toBeTruthy());
        expect(respondToTeamConnection).not.toHaveBeenCalled();
        expect(addInboxItem).not.toHaveBeenCalled();
    });

    it("reads the body of a row filed in the old digest-style shape", () => {
        // Types 7 and 8 first wrote {title, text}, which the BlockNote
        // renderer reads as an empty document. Those rows are already in
        // people's inboxes, so the card has to read either shape.
        renderBubble({
            itemType: 7,
            itemBody: {
                title: "Team connection request",
                text: "Acme would like to connect with your team.",
            } as never,
            itemOptionals: { connection_id: "c-1" },
        });

        expect(screen.getByText(/Acme would like to connect with your team/)).toBeTruthy();
        expect(screen.getByText("Approve")).toBeTruthy();
    });

    it("shows an answered request as settled, with no buttons to press again", () => {
        renderBubble({
            itemType: 8,
            requestStatus: "approved",
            itemOptionals: { grant_id: "g-1" },
        });

        expect(screen.getByText("Approved")).toBeTruthy();
        expect(screen.queryByText("Reject")).toBeNull();
    });
});
