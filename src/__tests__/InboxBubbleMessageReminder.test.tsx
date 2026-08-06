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
import { afterEach, describe, expect, it, vi } from "vitest";

import { InboxBubble } from "../features/inbox/components/InboxBubble";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";
import type { TeamEmoji } from "../services/teamEmojiApi";
import { setTeamEmojiList } from "../services/teamEmojiStore";
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

// The href names the MESSAGE, not just the chat — that segment is what
// lets the preview scroll to and highlight the bubble the reminder is
// about. See `message_reminders.chat_href`.
const REMINDER_HREF = "/workspace/chat/gm/ch-1/message/111";

const fullOptionals = {
    kind: "message_reminder",
    sender_name: "Alice",
    chat_name: "release-team",
    preview: "ship the release notes",
    href: REMINDER_HREF,
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
        expect(open).toHaveBeenCalledWith(REMINDER_HREF, { fullPageHref: REMINDER_HREF });
    });

    it("offers the chat's own page as well as the preview", () => {
        // `fullPageHref` is what puts the Move-to-page button on the
        // preview: reading the message in place and going to the chat are
        // both reasonable answers to a reminder, so the card offers both.
        const open = renderBubble(reminderItem(fullOptionals));
        fireEvent.click(screen.getByRole("button", { name: /release-team/ }));
        expect(open.mock.calls[0][1]).toEqual({ fullPageHref: REMINDER_HREF });
    });

    it("falls back to a generic sentence and chip without a sender or chat name", () => {
        const open = renderBubble(
            reminderItem({ ...fullOptionals, sender_name: "", chat_name: "" })
        );
        expect(screen.getByText("You asked to be reminded about this message.")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: /open message/i }));
        expect(open).toHaveBeenCalledWith(REMINDER_HREF, { fullPageHref: REMINDER_HREF });
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

describe("InboxBubble message reminder — custom emoji in the quote", () => {
    // The preview is the message's stored `body_text`, where a team emoji
    // is its canonical `:name:` shortcode. Printed raw it reads as literal
    // text in the one place the reader has to recognise their own message.
    const nightKing: TeamEmoji = {
        emojiId: 1,
        name: "nightking",
        url: "https://api.example.com/media/team_emoji/t1/u1-nightking.png",
        createdBy: "u1",
        tsCreatedAt: "2026-08-05T00:00:00Z",
    };

    afterEach(() => {
        setTeamEmojiList([]);
    });

    it("renders a shortcode in the quote as the emoji image", () => {
        setTeamEmojiList([nightKing]);
        renderBubble(reminderItem({ ...fullOptionals, preview: "winter is coming :nightking:" }));

        const img = screen.getByAltText(":nightking:");
        expect(img).toHaveAttribute("src", nightKing.url);
        expect(screen.getByText(/winter is coming/)).toBeInTheDocument();
        expect(screen.queryByText(/:nightking:/)).toBeNull();
    });

    it("leaves an unknown shortcode as text (deleted or another team's emoji)", () => {
        renderBubble(reminderItem({ ...fullOptionals, preview: "rip :nightking:" }));

        expect(screen.getByText(/:nightking:/)).toBeInTheDocument();
        expect(screen.queryByRole("img")).toBeNull();
    });
});
