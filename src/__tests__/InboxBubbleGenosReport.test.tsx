/**
 * InboxBubble: a schedule's Genos report (itemType 10, MIP-1149).
 *
 * An ACTIVITY (no approve/reject, not in the Requests count), whose body is
 * `{title, text, sections}`. The text is a job's output, so it is shown as plain text
 * and a link survives only as an app path or https URL. layout (400px) is checked by
 * eye in the running app, not here: jsdom has no layout.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

const reportItem = (itemBody: unknown): InboxItemProps => ({
    itemId: 10,
    itemType: 10,
    itemBody: itemBody as never,
    isRead: false,
    // What the server writes for a report: not a request.
    requestStatus: "" as never,
    tsSent: "2026-11-09T00:00:00Z",
    itemOptionals: { kind: "schedule_report", schedule_id: "s1", job: "what_to_do_today" },
});

const BODY = {
    title: "What to do today",
    text: "Two tasks are overdue.",
    sections: [
        {
            heading: "Overdue",
            items: [
                { text: "Ship the release", link: "/workspace/tasks/KDS-1" },
                { text: "Write it up" },
            ],
        },
        { heading: "Reading", items: [{ text: "RFC 12", link: "https://example.com/rfc/12" }] },
    ],
};

const renderBubble = (item: InboxItemProps, openModalByHref = vi.fn()) => {
    render(
        <CssVarsProvider>
            <MemoryRouter>
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
            </MemoryRouter>
        </CssVarsProvider>
    );
    return openModalByHref;
};

describe("InboxBubble Genos report", () => {
    it("shows the type chip, the headline, the summary and each section", () => {
        renderBubble(reportItem(BODY));
        expect(screen.getByText("Genos report")).toBeTruthy();
        expect(screen.getByRole("heading", { name: "What to do today" })).toBeTruthy();
        expect(screen.getByText("Two tasks are overdue.")).toBeTruthy();
        expect(screen.getByRole("heading", { name: "Overdue" })).toBeTruthy();
        expect(screen.getByRole("heading", { name: "Reading" })).toBeTruthy();
        expect(screen.getAllByRole("listitem")).toHaveLength(3);
        expect(screen.getByText("Write it up")).toBeTruthy();
    });

    it("is an activity: no approve or reject", () => {
        renderBubble(reportItem(BODY));
        expect(screen.queryByRole("button", { name: /approve|reject|decline/i })).toBeNull();
    });

    it("does not print the title and summary a second time as a plain notice", () => {
        renderBubble(reportItem(BODY));
        // Substring matches: the plain-notice fallback prints "title\ntext" as one node.
        expect(screen.getAllByText(/What to do today/)).toHaveLength(1);
        expect(screen.getAllByText(/Two tasks are overdue\./)).toHaveLength(1);
    });

    it("opens an in-app link through the URL-link modal, not a page load", () => {
        const open = renderBubble(reportItem(BODY));
        const link = screen.getByRole("link", { name: "Ship the release" });
        expect(link.getAttribute("href")).toBe("/workspace/tasks/KDS-1");
        const notPrevented = fireEvent.click(link);
        expect(open).toHaveBeenCalledWith("/workspace/tasks/KDS-1");
        expect(notPrevented).toBe(false); // preventDefault was called
    });

    it("leaves the browser's own new-tab gestures alone", () => {
        const open = renderBubble(reportItem(BODY));
        fireEvent.click(screen.getByRole("link", { name: "Ship the release" }), { metaKey: true });
        expect(open).not.toHaveBeenCalled();
    });

    it("opens an https link in a new tab, safely, with its host shown", () => {
        const open = renderBubble(reportItem(BODY));
        const link = screen.getByRole("link", { name: /RFC 12/ });
        expect(link.getAttribute("href")).toBe("https://example.com/rfc/12");
        expect(link.getAttribute("target")).toBe("_blank");
        expect(link.getAttribute("rel")).toContain("noopener");
        expect(within(link).getByText("(example.com)")).toBeTruthy();
        fireEvent.click(link);
        expect(open).not.toHaveBeenCalled();
    });

    it("shows an item with no link as text, not a link", () => {
        renderBubble(reportItem(BODY));
        expect(screen.queryByRole("link", { name: "Write it up" })).toBeNull();
    });

    it("drops an unsafe link but keeps the item's text", () => {
        renderBubble(
            reportItem({
                title: "t",
                text: "s",
                sections: [
                    {
                        heading: "h",
                        items: [
                            { text: "script", link: "javascript:alert(1)" },
                            { text: "other host", link: "http://example.com" },
                            { text: "escape", link: "/workspace/../admin" },
                            { text: "protocol relative", link: "//evil.example/workspace/x" },
                        ],
                    },
                ],
            })
        );
        expect(screen.queryAllByRole("link")).toHaveLength(0);
        for (const text of ["script", "other host", "escape", "protocol relative"]) {
            expect(screen.getByText(text)).toBeTruthy();
        }
    });

    it("renders markup in a job's text as text", () => {
        const { container } = render(
            <CssVarsProvider>
                <MemoryRouter>
                    <InboxBubble
                        inboxItem={reportItem({
                            title: "<b>bold</b>",
                            text: "[a link](https://evil.example)",
                            sections: [
                                {
                                    heading: "<i>h</i>",
                                    items: [{ text: "<img src=x onerror=alert(1)> **x**" }],
                                },
                            ],
                        })}
                        myself={{ userId: "u1", teamId: "t1" } as never}
                        setMyself={vi.fn()}
                        socket={null}
                        useCM={{ allChats: [] } as never}
                        useTEM={{ teamMemberProfiles: {} } as never}
                        useUISM={{} as never}
                    />
                </MemoryRouter>
            </CssVarsProvider>
        );
        expect(container.querySelector("img")).toBeNull();
        expect(container.querySelector("b, i")).toBeNull();
        expect(container.querySelector("a")).toBeNull();
        expect(screen.getByText("<b>bold</b>")).toBeTruthy();
        expect(screen.getByText("[a link](https://evil.example)")).toBeTruthy();
    });

    it("says nothing about items when the report is empty, but still shows the summary", () => {
        renderBubble(reportItem({ title: "Overdue", text: "Nothing is overdue.", sections: [] }));
        expect(screen.getByText("Nothing is overdue.")).toBeTruthy();
        expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    });

    it("survives a body that is not a report", () => {
        for (const body of [null, "x", [], 7, { sections: "no" }]) {
            expect(() => renderBubble(reportItem(body))).not.toThrow();
        }
    });
});
