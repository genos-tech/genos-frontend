/**
 * InboxBubble — the fired TO-DO reminder.
 *
 * Same `itemType` 9 as the message reminder, told apart by
 * `itemOptionals.kind`. That sharing is the thing worth testing: the two
 * cards must not bleed into each other (a to-do reminder that says "this
 * message" is a bug the type alone can't catch), while the parts that ARE
 * shared — the quoted preview, the deep-link chip through the URL-link
 * modal, activity-not-request — must keep working for both.
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

// The href names the ROW, not just the day — `/workspace/todo/:localDate/
// item/:itemId`, the same link the row's own "Copy link" writes. See
// `todo_reminders.todo_href`.
const TODO_HREF = "/workspace/todo/2026-08-16/item/88";

const todoOptionals = {
    kind: "todo_reminder",
    reminder_id: "r-1",
    todo_item_id: "88",
    local_date: "2026-08-16",
    preview: "ship the release notes",
    href: TODO_HREF,
    remind_at: "2026-08-16T09:00:00Z",
};

const reminderItem = (optionals: Record<string, unknown>): InboxItemProps => ({
    itemId: 9,
    itemType: 9,
    // What the server writes: an English fallback the client ignores.
    itemBody: { title: "Reminder about your to-do", text: "ship the release notes" } as never,
    isRead: false,
    requestStatus: "pending",
    tsSent: "2026-08-16T09:00:00Z",
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

describe("InboxBubble to-do reminder", () => {
    it("says it is about a to-do and quotes the title", () => {
        renderBubble(reminderItem(todoOptionals));
        expect(screen.getByText("You asked to be reminded about this to-do.")).toBeTruthy();
        expect(screen.getByText("ship the release notes")).toBeTruthy();
    });

    it("names the kind on the type chip, so a mixed inbox is readable", () => {
        renderBubble(reminderItem(todoOptionals));
        expect(screen.getByText("To-do reminder")).toBeTruthy();
        expect(screen.queryByText("Reminder")).toBeNull();
    });

    it("never uses the message wording", () => {
        renderBubble(reminderItem(todoOptionals));
        expect(screen.queryByText(/about this message/)).toBeNull();
        expect(screen.queryByRole("button", { name: /open message/i })).toBeNull();
    });

    it("opens the to-do through the URL-link modal, focused on the row", () => {
        const open = renderBubble(reminderItem(todoOptionals));
        fireEvent.click(screen.getByRole("button", { name: /open to-do/i }));
        expect(open).toHaveBeenCalledWith(TODO_HREF, { fullPageHref: TODO_HREF });
    });

    it("renders no open chip when the link is missing", () => {
        renderBubble(reminderItem({ ...todoOptionals, href: "" }));
        expect(screen.queryByRole("button", { name: /open/i })).toBeNull();
    });

    it("does not render the stored English body alongside the composed one", () => {
        renderBubble(reminderItem(todoOptionals));
        expect(screen.queryByText(/Reminder about your to-do/)).toBeNull();
    });

    it("is an activity, not a request — no approve or reject", () => {
        renderBubble(reminderItem(todoOptionals));
        expect(screen.queryByRole("button", { name: /approve|reject/i })).toBeNull();
    });

    it("still reads as a MESSAGE reminder when the kind says so", () => {
        // The discriminator, not the type, is what picks the wording — so a
        // message reminder filed under the same type keeps its own card.
        renderBubble(
            reminderItem({
                kind: "message_reminder",
                sender_name: "Alice",
                chat_name: "release-team",
                preview: "ship the release notes",
                href: "/workspace/chat/gm/ch-1/message/111",
            })
        );
        expect(screen.getByText(/You asked to be reminded about Alice's message/)).toBeTruthy();
        expect(screen.queryByText("To-do reminder")).toBeNull();
    });
});
