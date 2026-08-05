/**
 * InboxBubble — the fired message reminder (itemType 9).
 *
 * The card is composed from `itemOptionals`, not the stored English
 * `{title, text}` body, so it reads in the viewer's language; it quotes the
 * message so the reminder is actionable without a lookup; and it offers an
 * "open" chip that routes through the URL-link modal. It is an ACTIVITY, so
 * it must never render approve/reject.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InboxBubble } from "../features/inbox/components/InboxBubble";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";
import type { InboxItemProps } from "../types/common";

vi.mock("../components/editors/bnChatPreview", () => ({
    BnChatPreview: () => <div data-testid="bn-preview" />,
}));

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const reminderItem = (optionals: Record<string, unknown>): InboxItemProps => ({
    itemId: 9,
    itemType: 9,
    // What the server writes: an English fallback the client ignores.
    itemBody: { title: "Reminder about Alice's message", text: "ship the release notes" } as never,
    isRead: false,
    requestStatus: "pending",
    tsSent: "2026-08-05T09:00:00Z",
    itemOptionals: optionals,
});

const renderBubble = (item: InboxItemProps, openModalByHref = vi.fn()) => {
    render(
        <CssVarsProvider>
            <UrlLinkModalProvider value={{ openModalByHref }}>
                <InboxBubble
                    inboxItem={item}
                    myself={{ userId: "u1", teamId: "t1" } as never}
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{ allChats: [] } as never}
                    useTEM={{ teamMemberProfiles: {} } as never}
                    useUISM={{} as never}
                />
            </UrlLinkModalProvider>
        </CssVarsProvider>
    );
    return openModalByHref;
};

const fullOptionals = {
    kind: "message_reminder",
    sender_name: "Alice",
    chat_name: "release-team",
    preview: "ship the release notes",
    href: "/workspace/chat/gm/ch-1",
    remind_at: "2026-08-05T09:00:00Z",
};

describe("InboxBubble message reminder", () => {
    it("says who the message was from and quotes it", () => {
        renderBubble(reminderItem(fullOptionals));
        expect(screen.getByText(/You asked to be reminded about Alice's message/)).toBeTruthy();
        expect(screen.getByText("ship the release notes")).toBeTruthy();
    });

    it("names the chat on the open chip and routes through the modal", () => {
        const open = renderBubble(reminderItem(fullOptionals));
        fireEvent.click(screen.getByRole("button", { name: /release-team/ }));
        expect(open).toHaveBeenCalledWith("/workspace/chat/gm/ch-1");
    });

    it("falls back to a generic sentence and chip without a sender or chat name", () => {
        const open = renderBubble(
            reminderItem({ ...fullOptionals, sender_name: "", chat_name: "" })
        );
        expect(screen.getByText("You asked to be reminded about this message.")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: /open message/i }));
        expect(open).toHaveBeenCalledWith("/workspace/chat/gm/ch-1");
    });

    it("renders no open chip when the link is missing", () => {
        renderBubble(reminderItem({ ...fullOptionals, href: "" }));
        expect(screen.queryByRole("button", { name: /open/i })).toBeNull();
    });

    it("does not render the stored English body twice", () => {
        renderBubble(reminderItem(fullOptionals));
        // The `{title, text}` fallback must not surface alongside the
        // composed sentence — the legacy-body branch excludes type 9.
        expect(screen.queryByText(/Reminder about Alice's message/)).toBeNull();
    });

    it("is an activity, not a request — no approve or reject", () => {
        renderBubble(reminderItem(fullOptionals));
        expect(screen.queryByRole("button", { name: /approve|reject/i })).toBeNull();
    });
});
