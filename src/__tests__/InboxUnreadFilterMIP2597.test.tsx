/**
 * MIP-2597: an "Unread" filter on the Inbox, off by default, for both tabs.
 *
 * Pins what the filter shows (the badge's rule, so a waiting request counts), that a card read
 * under the reader's eyes is held until the list is opened again, that the choice lasts for the
 * tab session, and the empty state's way out.
 */
import type { ComponentProps } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { VirtuosoMockContext } from "react-virtuoso";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InboxSection } from "../features/inbox/components/InboxSection";
import { InboxHome } from "../features/inbox/inboxHome";
import type { InboxHomeProps as HomeProps } from "../features/inbox/types/inboxTypes";
import { useUnreadItems, useUnreadOnly } from "../features/inbox/unreadFilter";
import type { InboxItemProps } from "../types/common";

vi.mock("../services/api", () => ({ authApi: () => null }));
vi.mock("../db/workers/channels", () => ({ inboxChannel: { request: vi.fn() } }));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/inbox/components/InboxBubble", () => ({
    InboxBubble: ({ inboxItem }: { inboxItem: InboxItemProps }) => (
        <div data-testid="card">card-{inboxItem.itemId}</div>
    ),
}));

const row = (itemId: number, itemType: number, isRead: boolean): InboxItemProps =>
    ({ itemId, itemType, isRead, itemBody: [], tsSent: "2026-11-16T00:00:00Z" }) as never;
const ids = (items: InboxItemProps[]) => items.map((i) => i.itemId);
const cards = () => screen.queryAllByTestId("card").map((el) => el.textContent);

beforeEach(() => window.sessionStorage.clear());
afterEach(() => window.sessionStorage.clear());

describe("useUnreadOnly", () => {
    it("is off on first open, and the choice lasts for the tab session", () => {
        const first = renderHook(() => useUnreadOnly());
        expect(first.result.current[0]).toBe(false);
        act(() => first.result.current[1]());
        expect(first.result.current[0]).toBe(true);
        first.unmount();
        expect(renderHook(() => useUnreadOnly()).result.current[0]).toBe(true);
    });
});

describe("useUnreadItems", () => {
    const start = [row(3, 0, false), row(2, 1, false), row(1, 0, true)];
    const mount = () =>
        renderHook(
            ({ items, on }: { items: InboxItemProps[]; on: boolean }) => useUnreadItems(items, on),
            { initialProps: { items: start, on: true } }
        );

    it("shows everything while off, and only unread items (requests too) while on", () => {
        const { result, rerender } = mount();
        expect(ids(result.current)).toEqual([3, 2]);
        rerender({ items: start, on: false });
        expect(ids(result.current)).toEqual([3, 2, 1]);
    });

    it("keeps a card that turns read, and adds a new unread one", () => {
        const { result, rerender } = mount();
        const read = [row(3, 0, true), row(2, 1, true), row(1, 0, true)];
        rerender({ items: read, on: true });
        expect(ids(result.current)).toEqual([3, 2]);
        rerender({ items: [row(4, 0, false), ...read], on: true });
        expect(ids(result.current)).toEqual([4, 3, 2]);
    });

    it("drops a card that was removed", () => {
        const { result, rerender } = mount();
        rerender({ items: start.slice(1), on: true });
        expect(ids(result.current)).toEqual([2]);
    });

    it("shows the read card the route points at, and keeps it when another is opened", () => {
        const { result, rerender } = renderHook(
            ({ selected }: { selected?: number }) => useUnreadItems(start, true, selected),
            { initialProps: { selected: 1 as number | undefined } }
        );
        expect(ids(result.current)).toEqual([3, 2, 1]);
        rerender({ selected: 3 });
        expect(ids(result.current)).toEqual([3, 2, 1]);
    });

    it("hands back the same array while nothing changed (the list's scroll relies on it)", () => {
        const { result, rerender } = mount();
        const before = result.current;
        rerender({ items: start, on: true });
        expect(result.current).toBe(before);
    });
});

const shell = (ui: React.ReactNode, path = "/workspace/inbox/activities") =>
    render(
        <CssVarsProvider>
            <MemoryRouter initialEntries={[path]}>
                <VirtuosoMockContext.Provider value={{ viewportHeight: 800, itemHeight: 80 }}>
                    {ui}
                </VirtuosoMockContext.Provider>
            </MemoryRouter>
        </CssVarsProvider>
    );

describe("InboxSection's empty state with the filter on", () => {
    const props = { itemKeyPrefix: "k" } as never as ComponentProps<typeof InboxSection>;

    it("says nothing is unread and offers to turn the filter off", async () => {
        const onShowAll = vi.fn();
        shell(
            <InboxSection {...props} items={[row(1, 0, true)]} unreadOnly onShowAll={onShowAll} />
        );
        expect(screen.getByText("No unread items")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Show all" }));
        expect(onShowAll).toHaveBeenCalled();
    });
});

describe("InboxHome", () => {
    const items = [row(4, 0, false), row(3, 0, true), row(2, 1, false), row(1, 1, true)];
    const useIM = {
        inboxItems: items,
        unReadRequestCount: 1,
        unReadActivityCount: 1,
        funcSetInboxItems: vi.fn(),
    };
    const home = () =>
        shell(
            <Routes>
                <Route
                    element={<InboxHome {...({ useIM, myself: {} } as never as HomeProps)} />}
                    path="/workspace/inbox/*"
                />
            </Routes>
        );
    const chip = () => screen.getByRole("button", { name: "Unread" });

    it("filters whichever tab is open, from one chip in the header, by keyboard too", async () => {
        const user = userEvent.setup();
        home();
        expect(chip()).toHaveAttribute("aria-pressed", "false");
        expect(cards()).toEqual(["card-4", "card-3"]);

        chip().focus();
        await user.keyboard("{Enter}");
        expect(chip()).toHaveAttribute("aria-pressed", "true");
        expect(cards()).toEqual(["card-4"]);

        await user.click(screen.getByRole("tab", { name: /Requests/ }));
        expect(cards()).toEqual(["card-2"]);

        await user.click(chip());
        expect(cards()).toEqual(["card-2", "card-1"]);
    });

    it("keeps a read card in place when a card is opened (the route changes)", async () => {
        const user = userEvent.setup();
        window.sessionStorage.setItem("genos:inbox:unread-only", "1");
        const ui = (list: InboxItemProps[]) => (
            <CssVarsProvider>
                <MemoryRouter initialEntries={["/workspace/inbox/activities"]}>
                    <VirtuosoMockContext.Provider value={{ viewportHeight: 800, itemHeight: 80 }}>
                        <Routes>
                            <Route
                                path="/workspace/inbox/*"
                                element={
                                    <InboxHome
                                        {...({
                                            useIM: { ...useIM, inboxItems: list },
                                            myself: {},
                                        } as never as HomeProps)}
                                    />
                                }
                            />
                        </Routes>
                    </VirtuosoMockContext.Provider>
                </MemoryRouter>
            </CssVarsProvider>
        );
        const unread = [row(5, 0, false), row(4, 0, false)];
        const view = render(ui(unread));
        view.rerender(ui([row(5, 0, true), row(4, 0, true)]));
        expect(cards()).toEqual(["card-5", "card-4"]);
        await user.click(screen.getByText("card-4"));
        expect(cards()).toEqual(["card-5", "card-4"]);
    });
});
