/**
 * MIP-1627: Inbox activities have an unread state the member can see and change.
 *
 * Before, a notice, digest or reminder could never be marked read, the sidebar counted requests
 * only, and there was no way to clear a pile. These pin the services (`PUT /inbox/` both ways,
 * `POST /inbox/mark-read/` with the newest id held), the card's dot and toggle, the hold that
 * keeps a card unread, the Mark-all button, and the two tabs' counts.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastHost } from "../components/ui/feedback/Toast";
import { __resetToasts } from "../components/ui/feedback/toastStore";
import { InboxBubble } from "../features/inbox/components/InboxBubble";
import { InboxMarkAllReadButton } from "../features/inbox/components/InboxMarkAllReadButton";
import { ReadToggleButton, UnreadDot } from "../features/inbox/components/InboxReadControls";
import { InboxTabHeader } from "../features/inbox/components/InboxTabHeader";
import { holdUnread, isHeldUnread, readKey, resetReadHold } from "../features/inbox/readHold";
import { markAllActivitiesRead, markInboxUnread } from "../features/inbox/services/markInboxRead";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";
import type { InboxItemProps } from "../types/common";

const put = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
const request = vi.hoisted(() => vi.fn());
vi.mock("../services/api", () => ({
    authApi: (token: string | null) => (token ? { put, post } : null),
}));
vi.mock("../db/workers/channels", () => ({ inboxChannel: { request } }));
vi.mock("../components/editors/bnChatPreview", () => ({
    BnChatPreview: () => <div data-testid="bn-preview" />,
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const row = (itemId: number, itemType: number, isRead = false): InboxItemProps =>
    ({ itemId, itemType, isRead, itemBody: [], tsSent: "2026-11-16T00:00:00Z" }) as never;
const ME = { userId: "u1", teamId: "t1" } as never;

beforeEach(() => {
    put.mockReset().mockResolvedValue({ data: {} });
    post.mockReset().mockResolvedValue({ data: { updated: 2 } });
    request.mockReset().mockResolvedValue(undefined);
    __resetToasts();
    resetReadHold();
});
afterEach(() => resetReadHold());

describe("markInboxUnread", () => {
    it("PUTs is_read false with the pinned body, then patches the stored row", async () => {
        expect(await markInboxUnread("tok", "t1", 7)).toBe(true);
        expect(put).toHaveBeenCalledWith(
            "/inbox/",
            { team_id: "t1", item_id: 7, is_read: false },
            { suppressErrorToast: true }
        );
        expect(request).toHaveBeenCalledWith("markInboxItemsUnread", { itemIds: [7] });
    });

    it("writes nothing locally when the server refuses", async () => {
        put.mockRejectedValueOnce({ response: { status: 500 } });
        expect(await markInboxUnread("tok", "t1", 7)).toBe(false);
        expect(request).not.toHaveBeenCalled();
    });

    it("does nothing without a token", async () => {
        expect(await markInboxUnread(null, "t1", 7)).toBe(false);
        expect(put).not.toHaveBeenCalled();
    });
});

describe("markAllActivitiesRead", () => {
    const items = [row(5, 0), row(9, 6), row(12, 10, true), row(20, 1), row(30, 9)];

    it("sends the activities scope with the newest ACTIVITY id, and never a request's", async () => {
        const res = await markAllActivitiesRead("tok", "t1", items);
        // 20 is a request: the ceiling is the newest activity, 30.
        expect(post).toHaveBeenCalledWith(
            "/inbox/mark-read/",
            { team_id: "t1", scope: "activities", up_to_item_id: 30 },
            { suppressErrorToast: true }
        );
        expect(res).toEqual({ ok: true, updated: 2, itemIds: [5, 9, 30] });
    });

    it("patches only the unread activities locally", async () => {
        await markAllActivitiesRead("tok", "t1", items);
        expect(request).toHaveBeenCalledWith("markInboxItemsRead", { itemIds: [5, 9, 30] });
    });

    it("sends nothing when everything is already read", async () => {
        const res = await markAllActivitiesRead("tok", "t1", [row(1, 0, true), row(2, 1)]);
        expect(res).toEqual({ ok: true, updated: 0, itemIds: [] });
        expect(post).not.toHaveBeenCalled();
    });

    it("is a failure that touches no stored row when the server refuses", async () => {
        post.mockRejectedValueOnce({ response: { status: 500 } });
        expect(await markAllActivitiesRead("tok", "t1", items)).toEqual({
            ok: false,
            updated: 0,
            itemIds: [],
        });
        expect(request).not.toHaveBeenCalled();
    });
});

describe("readHold", () => {
    it("holds, releases, and survives a fresh module read", () => {
        const key = readKey("u1", "t1", 3);
        expect(isHeldUnread(key)).toBe(false);
        holdUnread(key);
        expect(isHeldUnread(key)).toBe(true);
        expect(
            JSON.parse(window.localStorage.getItem("genos:inbox:held-unread") ?? "[]")
        ).toContain(key);
    });

    it("keeps only the newest 500", () => {
        for (let i = 0; i < 510; i += 1) holdUnread(readKey("u1", "t1", i));
        expect(isHeldUnread(readKey("u1", "t1", 0))).toBe(false);
        expect(isHeldUnread(readKey("u1", "t1", 509))).toBe(true);
    });

    it("is per member and per team", () => {
        holdUnread(readKey("u1", "t1", 3));
        expect(isHeldUnread(readKey("u2", "t1", 3))).toBe(false);
        expect(isHeldUnread(readKey("u1", "t2", 3))).toBe(false);
    });
});

const shell = (ui: React.ReactNode) =>
    render(
        <CssVarsProvider>
            <MemoryRouter>
                {ui}
                <ToastHost />
            </MemoryRouter>
        </CssVarsProvider>
    );

describe("the unread dot", () => {
    it("is announced as 'Unread' without being an image", () => {
        shell(<UnreadDot />);
        expect(screen.getByTestId("inbox-unread-dot")).toHaveTextContent("Unread");
        expect(screen.queryByRole("img")).toBeNull();
    });
});

describe("ReadToggleButton", () => {
    const toggle = (isRead: boolean, onChanged = vi.fn()) => {
        shell(
            <ReadToggleButton
                inboxItem={{ itemId: 7, isRead }}
                teamId="t1"
                userId="u1"
                onChanged={onChanged}
            />
        );
        return onChanged;
    };

    it("offers 'Mark as read' on an unread card and sends is_read true", async () => {
        const onChanged = toggle(false);
        await userEvent.setup().click(screen.getByRole("button", { name: "Mark as read" }));
        await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
        expect(put.mock.calls[0][1]).toEqual({ team_id: "t1", item_id: 7, is_read: true });
    });

    it("offers 'Mark as unread' on a read card, sends is_read false, and HOLDS it", async () => {
        const onChanged = toggle(true);
        await userEvent.setup().click(screen.getByRole("button", { name: "Mark as unread" }));
        await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
        expect(put.mock.calls[0][1]).toEqual({ team_id: "t1", item_id: 7, is_read: false });
        expect(isHeldUnread(readKey("u1", "t1", 7))).toBe(true);
    });

    it("reading a held card by hand lets the dwell rule apply to it again", async () => {
        holdUnread(readKey("u1", "t1", 7));
        toggle(false);
        await userEvent.setup().click(screen.getByRole("button", { name: "Mark as read" }));
        await waitFor(() => expect(isHeldUnread(readKey("u1", "t1", 7))).toBe(false));
    });

    it("on a refusal says so, changes nothing, and does not leave a hold behind", async () => {
        put.mockRejectedValueOnce({ response: { status: 500 } });
        const onChanged = toggle(true);
        await userEvent.setup().click(screen.getByRole("button", { name: "Mark as unread" }));
        expect(
            await screen.findByText("Couldn't change the read status. Try again.")
        ).toBeTruthy();
        expect(onChanged).not.toHaveBeenCalled();
        expect(isHeldUnread(readKey("u1", "t1", 7))).toBe(false);
    });

    it("does not bubble the click up to the card, which would open it", async () => {
        const onCard = vi.fn();
        shell(
            <div onClick={onCard}>
                <ReadToggleButton
                    inboxItem={{ itemId: 7, isRead: false }}
                    teamId="t1"
                    userId="u1"
                />
            </div>
        );
        await userEvent.setup().click(screen.getByRole("button", { name: "Mark as read" }));
        expect(onCard).not.toHaveBeenCalled();
    });
});

describe("InboxMarkAllReadButton", () => {
    const mount = (items: InboxItemProps[], onChanged = vi.fn()) => {
        shell(<InboxMarkAllReadButton items={items} myself={ME} onChanged={onChanged} />);
        return onChanged;
    };
    const button = () => screen.getByRole("button", { name: "Mark all as read" });

    it("is disabled when nothing is unread", () => {
        mount([row(1, 0, true), row(2, 6, true)]);
        expect((button() as HTMLButtonElement).disabled).toBe(true);
    });

    it("sends one request, refreshes the list, releases the holds and says how many", async () => {
        holdUnread(readKey("u1", "t1", 1));
        const onChanged = mount([row(1, 0), row(2, 6)]);
        await userEvent.setup().click(button());
        await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
        expect(post).toHaveBeenCalledTimes(1);
        expect(isHeldUnread(readKey("u1", "t1", 1))).toBe(false);
        expect(await screen.findByText("2 activities marked as read")).toBeTruthy();
    });

    it("on a refusal says so and refreshes nothing", async () => {
        post.mockRejectedValueOnce({ response: { status: 500 } });
        const onChanged = mount([row(1, 0)]);
        await userEvent.setup().click(button());
        expect(
            await screen.findByText("Couldn't mark the activities as read. Try again.")
        ).toBeTruthy();
        expect(onChanged).not.toHaveBeenCalled();
    });
});

describe("InboxTabHeader counts", () => {
    it("shows each tab's own unread count", () => {
        shell(<InboxTabHeader activityCount={4} requestCount={2} />);
        const activities = screen.getByRole("tab", { name: /Activities/ });
        const requests = screen.getByRole("tab", { name: /Requests/ });
        expect(within(activities).getByText("4")).toBeTruthy();
        expect(within(requests).getByText("2")).toBeTruthy();
    });

    it("hides a count of zero or none", () => {
        shell(<InboxTabHeader />);
        expect(
            within(screen.getByRole("tab", { name: /Activities/ })).queryByText("0")
        ).toBeNull();
    });
});

describe("the card shows its read state", () => {
    const card = (inboxItem: InboxItemProps) =>
        shell(
            <UrlLinkModalProvider value={{ openModalByHref: vi.fn() }}>
                <InboxBubble
                    inboxItem={inboxItem}
                    myself={ME}
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{ allChats: [] } as never}
                    useTEM={{ teamMemberProfiles: {} } as never}
                    useUISM={{} as never}
                />
            </UrlLinkModalProvider>
        );

    it.each([0, 6, 9, 10])("an unread activity of type %i has the dot and a toggle", (type) => {
        card(row(40 + type, type));
        expect(screen.getByTestId("inbox-unread-dot")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Mark as read" })).toBeTruthy();
    });

    it("a read activity has no dot and offers 'Mark as unread'", () => {
        card(row(41, 0, true));
        expect(screen.queryByTestId("inbox-unread-dot")).toBeNull();
        expect(screen.getByRole("button", { name: "Mark as unread" })).toBeTruthy();
    });

    it("a request has neither: it is read by answering it", () => {
        card(row(42, 1));
        expect(screen.queryByTestId("inbox-unread-dot")).toBeNull();
        expect(screen.queryByTestId("inbox-read-toggle")).toBeNull();
    });
});
