/**
 * Digest inbox fixes (user-reported): the digest bubble renders MARKDOWN
 * (not raw `**bold**` text), the digest lives on the ACTIVITIES side
 * (it's not a request — nothing to approve), and the Requests badge no
 * longer counts it.
 */

import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import DigestBody from "../features/inbox/components/DigestBody";
import { DigestHeadline } from "../features/inbox/components/DigestHeadline";
import { useInboxItems } from "../features/inbox/hooks/useInboxItems";
import { useInboxManagement } from "../hooks/inbox/useInboxManagement";
import { InboxItemProps } from "../types/common";

const item = (itemType: number, isRead = false): InboxItemProps =>
    ({
        itemId: itemType * 10 + (isRead ? 1 : 0),
        itemType,
        isRead,
        itemBody: [],
        itemOptionals: null,
        tsSent: "2026-08-01T08:00:00Z",
    }) as unknown as InboxItemProps;

describe("useInboxItems bucketing", () => {
    it("puts the digest (6) under Activities, not Requests", async () => {
        const items = [item(0), item(1), item(5), item(6)];
        const { result } = renderHook(() => useInboxItems(items));
        await waitFor(() =>
            expect(result.current.activityInboxItems.map((i) => i.itemType)).toEqual([0, 6])
        );
        expect(result.current.requestInboxItems.map((i) => i.itemType)).toEqual([1, 5]);
    });
});

describe("Requests badge", () => {
    it("counts unread requests only — not activities, not the digest", async () => {
        vi.doMock("../features/inbox/services/popInboxItems", () => ({
            popInboxItems: async () => [item(0), item(1), item(3, true), item(6)],
        }));
        const { useInboxManagement: mockedHook } = await import(
            "../hooks/inbox/useInboxManagement"
        );
        const { result } = renderHook(() => mockedHook());
        // unread: 0 (activity, excluded), 1 (counts), 3 read, 6 (digest,
        // excluded) => 1.
        await waitFor(() => expect(result.current.unReadInboxItemCount).toBe(1));
        vi.doUnmock("../features/inbox/services/popInboxItems");
    });
});

describe("DigestBody markdown rendering", () => {
    const renderBody = (text: string) =>
        render(
            <MemoryRouter>
                <DigestBody isDark={false} text={text} />
            </MemoryRouter>
        );

    it("renders bold and bullets instead of raw markdown", () => {
        renderBody("- **Critical Overdue**: task slipped.");
        const strong = screen.getByText("Critical Overdue");
        expect(strong.tagName).toBe("STRONG");
        expect(screen.queryByText(/\*\*/)).toBeNull();
    });

    it("renders resolved workspace links as anchors", () => {
        renderBody("See [KDS-439](/workspace/tasks/project/1/task/1015).");
        const link = screen.getByText("KDS-439").closest("a");
        expect(link?.getAttribute("href")).toBe("/workspace/tasks/project/1/task/1015");
    });

    it("degrades pre-rewrite citation tokens to plain text, never dead links", () => {
        renderBody("Fix [KDS-439](task:1015) first.");
        const label = screen.getByText("KDS-439");
        expect(label.closest("a")).toBeNull();
    });

    it("keeps external links as new-tab anchors", () => {
        renderBody("Read [MDN](https://developer.mozilla.org).");
        const link = screen.getByText("MDN").closest("a");
        expect(link?.getAttribute("href")).toBe("https://developer.mozilla.org");
        expect(link?.getAttribute("target")).toBe("_blank");
    });
});

describe("DigestHeadline", () => {
    it("shows the edition's own headline", () => {
        render(<DigestHeadline isDark={false} title="Three things are stuck" />);
        expect(screen.getByText("Three things are stuck")).toBeTruthy();
    });

    it("renders nothing for the generic fallback title", () => {
        // Pre-headline rows and headline-less runs both store this; the
        // chip already says "Genos digest", so repeating it is noise.
        const { container } = render(<DigestHeadline isDark={false} title="Your Genos digest" />);
        expect(container.textContent).toBe("");
    });

    it("renders nothing for an empty or whitespace title", () => {
        const { container } = render(<DigestHeadline isDark={false} title="   " />);
        expect(container.textContent).toBe("");
    });
});
