/**
 * MIP-1208: the rich card of a typed Genos report, drawn through the real `InboxBubble`.
 *
 * Layout (390px / 1440px, light / dark, RTL) is checked by eye in the running app, not here:
 * jsdom has no layout. These pin what the card is made of: the app's own status label, the
 * server's order, project headers where the project changes, the folds, and that nothing a job
 * wrote is ever HTML or a live link.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LINES_BEFORE_MORE, OPEN_SECTIONS } from "../features/inbox/components/GenosReportCard";
import { InboxBubble } from "../features/inbox/components/InboxBubble";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";
import { I18nProvider, loadLocale } from "../i18n";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";
import type { InboxItemProps } from "../types/common";

vi.mock("../components/editors/bnChatPreview", () => ({
    BnChatPreview: () => <div data-testid="bn-preview" />,
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

afterEach(() => localStorage.removeItem(LOCALE_STORAGE_KEY));

const MIP = { id: 3, name: "Genos", code: "MIP" };
const KDS = { id: 5, name: "Kids", code: "KDS" };
const OPS = { id: 7, name: "Operations", code: "OPS" };

const task = (
    project: typeof MIP,
    n: number,
    title: string,
    status: string,
    extra: Record<string, unknown> = {}
) => ({
    text: `${project.code}-${n} · ${title}`,
    link: `/workspace/tasks/project/${project.id}/task/${n}`,
    kind: "task",
    project,
    display_id: `${project.code}-${n}`,
    title,
    status,
    ...extra,
});

const BODY = {
    version: 2,
    title: "What to do today",
    text: "2 overdue, 1 due today.",
    stats: [
        { key: "overdue", count: 5, emoji: "🔥" },
        { key: "due_today", count: 1, emoji: "📅" },
        { key: "waiting_on_others", count: 9, emoji: "⏳" },
    ],
    sections: [
        {
            heading: "Overdue",
            key: "overdue",
            emoji: "🔥",
            items: [
                task(MIP, 7, "Fix the login", "WIP", {
                    priority: "High",
                    due_date: "2026-11-04",
                    overdue_days: 4,
                    detail: "2 comments from others",
                }),
                task(MIP, 8, "Second genos task", "Open", { priority: "Normal" }),
                task(KDS, 2, "Ship the deck", "Open", { overdue_days: 1, due_date: "2026-11-07" }),
                task(OPS, 14, "Rotate the credentials", "Blocked", { priority: "Critical" }),
                { text: "and 3 more overdue tasks", kind: "more" },
            ],
        },
        {
            heading: "Due today",
            key: "due_today",
            emoji: "📅",
            items: [task(MIP, 9, "Due today task", "Pending", { due_date: "2099-01-01" })],
        },
        {
            heading: "Waiting on others",
            key: "waiting_on_others",
            emoji: "⏳",
            items: [task(KDS, 20, "Folded task", "Pending")],
        },
    ],
};

const reportItem = (itemBody: unknown): InboxItemProps => ({
    itemId: 10,
    itemType: 10,
    itemBody: itemBody as never,
    isRead: false,
    requestStatus: "" as never,
    tsSent: "2026-11-09T00:00:00Z",
    itemOptionals: { kind: "schedule_report", schedule_id: "s1", job: "what_to_do_today" },
});

const bubble = (item: InboxItemProps, open = vi.fn(), allChats: unknown[] = []) => (
    <CssVarsProvider>
        <MemoryRouter>
            <UrlLinkModalProvider value={{ openModalByHref: open }}>
                <InboxBubble
                    inboxItem={item}
                    myself={{ userId: "u1", teamId: "t1" } as never}
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{ allChats } as never}
                    useTEM={{ teamMemberProfiles: {} } as never}
                    useUISM={{} as never}
                />
            </UrlLinkModalProvider>
        </MemoryRouter>
    </CssVarsProvider>
);

const renderBody = (body: unknown, open = vi.fn()) => {
    const utils = render(bubble(reportItem(body), open));
    return { ...utils, open };
};

const sectionOf = (container: HTMLElement, key: string) =>
    container.querySelector(`[data-report-section="${key}"]`) as HTMLElement;

describe("GenosReportCard: what it is made of", () => {
    it("is the rich card for version 2 and nothing else", () => {
        const { container } = renderBody(BODY);
        expect(container.querySelector('[data-genos-report="v2"]')).not.toBeNull();
    });

    it("shows the title, the summary and the headline counts with their emoji, in server order", () => {
        const { container } = renderBody(BODY);
        expect(screen.getByRole("heading", { name: "What to do today" })).toBeTruthy();
        expect(screen.getByText("2 overdue, 1 due today.")).toBeTruthy();
        const stats = [...container.querySelectorAll("[data-report-stat]")];
        expect(stats.map((s) => s.getAttribute("data-report-stat"))).toEqual([
            "overdue",
            "due_today",
            "waiting_on_others",
        ]);
        expect(stats[0].textContent).toContain("🔥");
        expect(stats[0].textContent).toContain("5");
        // The name of a count is the matching section's heading, for screen readers too.
        expect(within(stats[2] as HTMLElement).getByText("Waiting on others")).toBeTruthy();
    });

    it("draws sections in the server's order, each with its emoji, heading and count", () => {
        const { container } = renderBody(BODY);
        const keys = [...container.querySelectorAll("[data-report-section]")].map((s) =>
            s.getAttribute("data-report-section")
        );
        expect(keys).toEqual(["overdue", "due_today", "waiting_on_others"]);
        const overdue = sectionOf(container, "overdue");
        expect(overdue.textContent).toContain("🔥");
        expect(within(overdue).getByRole("button", { name: /Overdue/ })).toBeTruthy();
        // The count is the server's (stats), not the number of lines shown.
        expect(within(overdue).getByRole("button").textContent).toContain("5");
    });

    it("puts a project header where the project changes, once per run, in order", () => {
        const { container } = renderBody(BODY);
        const headers = [...container.querySelectorAll("[data-report-project]")].map((h) => ({
            id: h.getAttribute("data-report-project"),
            text: h.textContent,
        }));
        // MIP (two lines, one header), KDS, OPS in the first section; MIP again in the second.
        expect(headers.map((h) => h.id)).toEqual(["3", "5", "7", "3"]);
        expect(headers[0].text).toContain("Genos");
        expect(headers[0].text).toContain("MIP");
    });

    it("uses the app's own status label for a task's status", () => {
        const { container } = renderBody(BODY);
        const row = screen.getByRole("link", { name: /Fix the login/ });
        const word = row.querySelector("[data-status-word]") as HTMLElement;
        expect(word.textContent).toBe("WIP");
        const icon = word.parentElement!.querySelector('span[aria-hidden="true"]') as HTMLElement;
        expect(icon.style.color).toBe("var(--g-warning-text)");
        const blocked = screen.getByRole("link", { name: /Rotate the credentials/ });
        expect(blocked.querySelector("[data-status-word]")!.textContent).toBe("Blocked");
        expect(container.querySelectorAll("[data-status-word]").length).toBeGreaterThanOrEqual(4);
    });

    it("shows the id, the title and the detail sentence of a task", () => {
        renderBody(BODY);
        const row = screen.getByRole("link", { name: /Fix the login/ });
        expect(within(row).getByText("MIP-7")).toBeTruthy();
        expect(within(row).getByText("Fix the login")).toBeTruthy();
        expect(within(row).getByText("2 comments from others")).toBeTruthy();
    });

    it("says how late a task is from the server's count, in the due colour", () => {
        renderBody(BODY);
        const late = within(screen.getByRole("link", { name: /Fix the login/ })).getByText(
            "4d late"
        );
        expect(late.closest("[data-tone]")!.getAttribute("data-tone")).toBe("overdue");
        expect(
            within(screen.getByRole("link", { name: /Ship the deck/ })).getByText("1d late")
        ).toBeTruthy();
    });

    it("marks only a notable priority (High, Critical), not every Normal", () => {
        renderBody(BODY);
        const mark = (name: RegExp) =>
            screen.getByRole("link", { name }).querySelectorAll('[role="img"]').length;
        expect(mark(/Fix the login/)).toBe(1); // High
        expect(mark(/Rotate the credentials/)).toBe(1); // Critical
        expect(mark(/Second genos task/)).toBe(0); // Normal
    });

    it("shows the closing 'and N more' line as a quiet note", () => {
        renderBody(BODY);
        expect(screen.getByText("and 3 more overdue tasks")).toBeTruthy();
    });
});

describe("GenosReportCard: folds", () => {
    it(`opens the first ${OPEN_SECTIONS} sections and folds the rest`, () => {
        const { container } = renderBody(BODY);
        const expanded = ["overdue", "due_today", "waiting_on_others"].map((k) =>
            within(sectionOf(container, k)).getByRole("button").getAttribute("aria-expanded")
        );
        expect(expanded).toEqual(["true", "true", "false"]);
        expect(screen.queryByText("Folded task")).toBeNull();
    });

    it("opens and closes a section without opening the card's own route", () => {
        const onRowClick = vi.fn();
        const { container } = render(<div onClick={onRowClick}>{bubble(reportItem(BODY))}</div>);
        const button = within(sectionOf(container, "waiting_on_others")).getByRole("button");
        fireEvent.click(button);
        expect(button.getAttribute("aria-expanded")).toBe("true");
        expect(screen.getByText("Folded task")).toBeTruthy();
        fireEvent.click(button);
        expect(screen.queryByText("Folded task")).toBeNull();
        expect(onRowClick).not.toHaveBeenCalled();
    });

    it(`shows ${LINES_BEFORE_MORE} lines, then "Show N more", and the closing line only after all`, () => {
        const many = Array.from({ length: 9 }, (_, i) => task(MIP, 100 + i, `Task ${i}`, "Open"));
        const { container } = renderBody({
            version: 2,
            title: "t",
            text: "s",
            sections: [
                {
                    heading: "Many",
                    key: "overdue",
                    items: [...many, { text: "and 20 more", kind: "more" }],
                },
            ],
        });
        const section = sectionOf(container, "overdue");
        expect(within(section).getAllByRole("link")).toHaveLength(LINES_BEFORE_MORE);
        expect(within(section).queryByText("and 20 more")).toBeNull();
        const more = within(section).getByRole("button", { name: "Show 3 more" });
        fireEvent.click(more);
        expect(within(section).getAllByRole("link")).toHaveLength(9);
        expect(within(section).getByText("and 20 more")).toBeTruthy();
        fireEvent.click(within(section).getByRole("button", { name: "Show less" }));
        expect(within(section).getAllByRole("link")).toHaveLength(LINES_BEFORE_MORE);
    });
});

describe("GenosReportCard: non-task lines and unknown values", () => {
    const body = (items: unknown[]) => ({
        version: 2,
        title: "t",
        text: "s",
        sections: [{ heading: "Mixed", key: "todos_today", items }],
    });

    it("draws each kind with its own emoji and the text", () => {
        const { container } = renderBody({
            version: 2,
            title: "t",
            text: "s",
            sections: [
                {
                    heading: "A",
                    key: "todos_today",
                    items: [
                        { text: "Call the bank", kind: "todo" },
                        { text: "10:00 Planning", kind: "event" },
                        { text: "Design note", kind: "note" },
                        { text: "Sam wrote", kind: "chat" },
                    ],
                },
                {
                    heading: "B",
                    key: "changed",
                    items: [
                        { text: "Join request", kind: "request" },
                        { text: "Mentioned you", kind: "mention" },
                        { text: "Q4 launch", kind: "milestone" },
                        { text: "Kids", kind: "project" },
                    ],
                },
            ],
        });
        const rows = (key: string) =>
            [...sectionOf(container, key).querySelectorAll("li")].map((r) => r.textContent);
        expect(rows("todos_today")).toEqual([
            "✅Call the bank",
            "🗓️10:00 Planning",
            "📝Design note",
            "💬Sam wrote",
        ]);
        expect(rows("changed")).toEqual([
            "🙋Join request",
            "📣Mentioned you",
            "🏁Q4 launch",
            "📁Kids",
        ]);
    });

    it("draws an unknown kind as plain text behind a bullet", () => {
        renderBody(body([{ text: "Something new", kind: "hologram" }, { text: "No kind" }]));
        expect(screen.getByText("Something new").parentElement!.textContent).toBe(
            "•Something new"
        );
        expect(screen.getByText("No kind")).toBeTruthy();
    });

    it("shows an unknown status as plain text, with no status label", () => {
        renderBody(
            body([
                {
                    text: "MIP-1 · Odd",
                    kind: "task",
                    display_id: "MIP-1",
                    title: "Odd",
                    status: "Archived",
                    priority: "Urgent",
                    due_date: "2026-13-45",
                    overdue_days: 0,
                    project: { id: 0, name: "no project" },
                },
            ])
        );
        const row = screen.getByText("Odd").closest("li")!;
        expect(within(row).getByText("Archived")).toBeTruthy();
        expect(row.querySelector("[data-status-word]")).toBeNull();
        expect(row.querySelector('[role="img"]')).toBeNull();
        expect(row.querySelector("[data-tone]")).toBeNull();
        expect(document.querySelector("[data-report-project]")).toBeNull();
    });

    it("truncates a long title and keeps the whole of it as a tooltip", () => {
        const long = "A very long title ".repeat(10).trim();
        renderBody(body([task(MIP, 1, long, "Open")]));
        expect(screen.getByText(long).getAttribute("title")).toBe(long);
    });
});

describe("GenosReportCard: nothing a job wrote is markup or a live link", () => {
    it("renders HTML-looking strings as text everywhere", () => {
        const evil = "<img src=x onerror=alert(1)>";
        const { container } = renderBody({
            version: 2,
            title: `<b>${evil}</b>`,
            text: "[a link](https://evil.example)",
            stats: [{ key: "overdue", count: 1, emoji: "<script>alert(1)</script>" }],
            sections: [
                {
                    heading: `<i>${evil}</i>`,
                    key: "overdue",
                    emoji: evil,
                    items: [
                        task(MIP, 1, evil, "Open", { detail: "<script>x()</script>" }),
                        { text: evil, kind: "todo" },
                        { text: evil, kind: "more" },
                    ],
                },
            ],
        });
        expect(container.querySelector("img, b, i, script")).toBeNull();
        expect(screen.getByText("[a link](https://evil.example)")).toBeTruthy();
        expect(screen.getByText("<script>x()</script>")).toBeTruthy();
        // A hostile "emoji" is replaced by the table's own for the key.
        expect(container.querySelector("[data-report-stat]")!.textContent).toContain("🔥");
        expect(container.textContent).not.toContain("<script>alert");
    });

    it("never makes a link of javascript:, data:, http:, a traversal or a protocol-relative URL", () => {
        const bad = [
            "javascript:alert(1)",
            "data:text/html,x",
            "http://example.com",
            "/workspace/../admin",
            "//evil.example/workspace/x",
        ];
        const { container } = renderBody({
            version: 2,
            title: "t",
            text: "s",
            sections: [
                {
                    heading: "h",
                    key: "overdue",
                    items: bad.map((link, i) => task(MIP, i + 1, `Bad ${i}`, "Open", { link })),
                },
                {
                    heading: "g",
                    key: "todos_today",
                    items: bad.map((link, i) => ({ text: `Plain ${i}`, kind: "todo", link })),
                },
            ],
        });
        expect(container.querySelectorAll("a")).toHaveLength(0);
        expect(screen.getByText("Bad 0")).toBeTruthy();
        expect(screen.getByText("Plain 4")).toBeTruthy();
    });
});

describe("GenosReportCard: links", () => {
    it("opens an in-app task through the URL-link modal, not a page load", () => {
        const { open } = renderBody(BODY);
        const row = screen.getByRole("link", { name: /Fix the login/ });
        expect(row.getAttribute("href")).toBe("/workspace/tasks/project/3/task/7");
        expect(fireEvent.click(row)).toBe(false);
        expect(open).toHaveBeenCalledWith("/workspace/tasks/project/3/task/7");
    });

    it("does not also open the Inbox row around the card", () => {
        const onRowClick = vi.fn();
        render(<div onClick={onRowClick}>{bubble(reportItem(BODY))}</div>);
        fireEvent.click(screen.getByRole("link", { name: /Fix the login/ }));
        expect(onRowClick).not.toHaveBeenCalled();
    });

    it("leaves the browser's new-tab gestures alone", () => {
        const { open } = renderBody(BODY);
        fireEvent.click(screen.getByRole("link", { name: /Fix the login/ }), { ctrlKey: true });
        expect(open).not.toHaveBeenCalled();
    });

    it("opens an https link in a new tab without an opener", () => {
        renderBody({
            version: 2,
            title: "t",
            text: "s",
            sections: [
                {
                    heading: "Calendar",
                    key: "calendar",
                    items: [{ text: "Planning", kind: "event", link: "https://example.com/meet" }],
                },
            ],
        });
        const link = screen.getByRole("link", { name: /Planning/ });
        expect(link.getAttribute("target")).toBe("_blank");
        expect(link.getAttribute("rel")).toContain("noopener");
    });

    it("shows a line with no link as plain text", () => {
        renderBody({
            version: 2,
            title: "t",
            text: "s",
            sections: [
                { heading: "h", key: "todos_today", items: [{ text: "Buy milk", kind: "todo" }] },
            ],
        });
        expect(screen.queryByRole("link")).toBeNull();
        expect(screen.getByText("Buy milk")).toBeTruthy();
    });
});

describe("GenosReportCard: empty and old reports", () => {
    it("says so, kindly, when a report has nothing in it, and still shows the summary", () => {
        const { container } = renderBody({
            version: 2,
            title: "What you did",
            text: "Nothing to report.",
            sections: [],
        });
        expect(container.querySelector("[data-report-empty]")).not.toBeNull();
        expect(screen.getByText("All clear")).toBeTruthy();
        expect(screen.getByText("Nothing to report.")).toBeTruthy();
    });

    it("draws a body without `version` exactly as before: bullets, no card", () => {
        const { container } = renderBody({
            title: "Old",
            text: "s",
            sections: [
                {
                    heading: "Overdue",
                    items: [{ text: "Ship it", link: "/workspace/tasks/KDS-1" }],
                },
            ],
        });
        expect(container.querySelector("[data-genos-report]")).toBeNull();
        expect(screen.getAllByRole("listitem")).toHaveLength(1);
        expect(screen.getByRole("link", { name: "Ship it" })).toBeTruthy();
        expect(container.querySelector("button[aria-expanded]")).toBeNull();
    });

    it("treats version 1, a later version and a non-number version as an old report", () => {
        for (const version of [1, 3, "2", null]) {
            const { container, unmount } = renderBody({
                version,
                title: "Old",
                text: "s",
                sections: [{ heading: "h", items: [{ text: "x" }] }],
            });
            expect(container.querySelector("[data-genos-report]")).toBeNull();
            expect(screen.getByText("x")).toBeTruthy();
            unmount();
        }
    });

    it("does not say 'all clear' when the headline counts say otherwise", () => {
        const { container } = renderBody({
            version: 2,
            title: "t",
            text: "s",
            stats: [{ key: "overdue", count: 5, emoji: "🔥" }],
            sections: [{ heading: "h", key: "overdue", items: [{ kind: "todo" }] }],
        });
        expect(container.querySelector("[data-report-stat]")).not.toBeNull();
        expect(container.querySelector("[data-report-empty]")).toBeNull();
    });

    it("names a section by its key when the server sent no heading", () => {
        const { container } = renderBody({
            version: 2,
            title: "t",
            text: "s",
            sections: [{ key: "waiting_on_others", items: [{ text: "x" }] }],
        });
        expect(
            within(sectionOf(container, "waiting_on_others")).getByRole("button").textContent
        ).toContain("waiting on others");
    });

    it("never shows a badge lower than the lines in the section", () => {
        const { container } = renderBody({
            version: 2,
            title: "t",
            text: "s",
            stats: [{ key: "overdue", count: 1 }],
            sections: [
                {
                    heading: "Overdue",
                    key: "overdue",
                    items: [{ text: "a" }, { text: "b" }, { text: "c" }],
                },
            ],
        });
        expect(within(sectionOf(container, "overdue")).getByRole("button").textContent).toContain(
            "3"
        );
    });

    it("survives a typed body that is mostly junk", () => {
        for (const body of [
            { version: 2 },
            { version: 2, sections: "no", stats: 5 },
            { version: 2, sections: [null, 5, { items: "x" }, { heading: "h", items: [null] }] },
        ]) {
            expect(() => renderBody(body)).not.toThrow();
        }
    });
});

describe("GenosReportCard: project marks", () => {
    it("shows the PM chat's picture for a project already in memory, with no request", () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const { container } = render(
            bubble(reportItem(BODY), vi.fn(), [
                {
                    chatType: 3,
                    project: { projectId: 3 },
                    profileImagePath: "https://media.example/projects/3/a.png",
                },
            ])
        );
        const header = container.querySelector('[data-report-project="3"]')!;
        expect(header.querySelector("img")?.getAttribute("src")).toBe(
            "https://media.example/projects/3/a.png"
        );
        // The other projects have no picture in memory: the generic project icon.
        expect(container.querySelector('[data-report-project="5"] img')).toBeNull();
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });
});

describe("GenosReportCard: another locale", () => {
    it("draws the card's own chrome in Arabic", async () => {
        localStorage.setItem(LOCALE_STORAGE_KEY, "ar");
        await loadLocale("ar");
        render(
            <I18nProvider>
                {bubble(reportItem({ version: 2, title: "t", text: "s", sections: [] }))}
            </I18nProvider>
        );
        expect(screen.getByText("كل شيء على ما يرام")).toBeTruthy();
    });
});
