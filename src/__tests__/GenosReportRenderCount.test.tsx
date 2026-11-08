/**
 * MIP-1208: render budget of the report card on a long Inbox.
 *
 * The Inbox list re-renders every visible card whenever it re-renders, so a card must cost
 * nothing when it is handed what it already drew: the body is parsed once per body object, and
 * the memoized card does not render again. Opening a section is local state of that section
 * alone. Counted by wrapping the parser and the shared status label (one per task row).
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GenosReportBody } from "../features/inbox/components/GenosReportBody";
import { parseGenosReportV2 } from "../features/inbox/utils/genosReportV2";
import { projectAvatarSrcMap } from "../features/tasks/utils/projectAvatar";

const rows = vi.hoisted(() => ({ renders: 0, external: 0 }));

vi.mock("../features/inbox/utils/genosReportV2", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../features/inbox/utils/genosReportV2")>();
    return { ...actual, parseGenosReportV2: vi.fn(actual.parseGenosReportV2) };
});

// The old (version-less) card draws an https link through this: one render per link.
vi.mock("../features/agentQA/agentMarkdown", () => ({
    ExternalLink: ({ children }: { children?: React.ReactNode }) => {
        rows.external += 1;
        return <a>{children}</a>;
    },
}));

vi.mock("../features/tasks/utils/projectAvatar", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../features/tasks/utils/projectAvatar")>();
    return { ...actual, projectAvatarSrcMap: vi.fn(actual.projectAvatarSrcMap) };
});

vi.mock("../features/tasks/components/meta/StatusLabel", () => ({
    StatusLabel: ({ status }: { status: string }) => {
        rows.renders += 1;
        return <span>{status}</span>;
    },
}));

// The answer buttons read the member's token (MIP-1211); a tap is the only thing that uses it.
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const section = (key: string, n: number) => ({
    heading: key,
    key,
    items: Array.from({ length: n }, (_, i) => ({
        text: `${key} ${i}`,
        kind: "task",
        display_id: `T-${i}`,
        title: `${key} task ${i}`,
        status: "Open",
    })),
});

const makeBody = () => ({
    version: 2,
    title: "t",
    text: "s",
    sections: [section("overdue", 3), section("due_today", 3), section("changed", 3)],
});

const tree = (itemBody: unknown, allChats: unknown[] = []) => (
    <CssVarsProvider>
        <MemoryRouter>
            <GenosReportBody allChats={allChats as never} itemBody={itemBody} />
        </MemoryRouter>
    </CssVarsProvider>
);

describe("report card render budget", () => {
    beforeEach(() => {
        rows.renders = 0;
        rows.external = 0;
        vi.mocked(parseGenosReportV2).mockClear();
        vi.mocked(projectAvatarSrcMap).mockClear();
    });

    it("parses a body once, however often its parent renders", () => {
        const body = makeBody();
        const { rerender } = render(tree(body));
        for (let i = 0; i < 5; i += 1) rerender(tree(body));
        expect(parseGenosReportV2).toHaveBeenCalledTimes(1);
    });

    it("does not render a card again for the same body, even when the chat list is replaced", () => {
        const body = makeBody();
        const { rerender } = render(tree(body, []));
        // Two sections are open on first draw: 3 + 3 rows.
        expect(rows.renders).toBe(6);
        // A new (equal) chat list on every parent render: what a busy chat does to the Inbox.
        for (let i = 0; i < 5; i += 1) rerender(tree(body, []));
        expect(rows.renders).toBe(6);
    });

    it("draws the card again only when a project picture in the chats really changed", () => {
        const body = {
            version: 2,
            sections: [
                {
                    heading: "h",
                    key: "overdue",
                    items: [
                        {
                            text: "a",
                            kind: "task",
                            display_id: "T-1",
                            title: "a",
                            status: "Open",
                            project: { id: 3, name: "Genos" },
                        },
                    ],
                },
            ],
        };
        const chat = (path: string) => ({
            chatType: 3,
            project: { projectId: 3 },
            profileImagePath: path,
        });
        const { rerender } = render(tree(body, [chat("https://m.example/a.png")]));
        expect(rows.renders).toBe(1);
        rerender(tree(body, [chat("https://m.example/a.png"), { chatType: 1 }]));
        expect(rows.renders).toBe(1);
        rerender(tree(body, [chat("https://m.example/b.png")]));
        expect(rows.renders).toBe(2);
    });

    it("renders again when the body is a new object (a refetched item), and parses it again", () => {
        const { rerender } = render(tree(makeBody()));
        rerender(tree(makeBody()));
        expect(parseGenosReportV2).toHaveBeenCalledTimes(2);
        expect(rows.renders).toBe(12);
    });

    it("does not render an old (version-less) report again for the same body either", () => {
        const old = {
            title: "t",
            text: "s",
            sections: [{ heading: "h", items: [{ text: "x", link: "https://example.com/a" }] }],
        };
        const { rerender } = render(tree(old));
        expect(rows.external).toBe(1);
        for (let i = 0; i < 5; i += 1) rerender(tree(old));
        expect(rows.external).toBe(1);
        expect(parseGenosReportV2).not.toHaveBeenCalled();
    });

    it("opening a section renders only that section's rows", () => {
        const { container } = render(tree(makeBody()));
        expect(rows.renders).toBe(6);
        const folded = container.querySelector('[data-report-section="changed"]') as HTMLElement;
        fireEvent.click(within(folded).getByRole("button"));
        // The three rows that just appeared, and none of the six already drawn.
        expect(rows.renders).toBe(9);
        fireEvent.click(within(folded).getByRole("button"));
        expect(rows.renders).toBe(9);
    });

    it("never scans the chat list for a report with no project line", () => {
        const { rerender } = render(tree(makeBody(), [{ chatType: 3 }]));
        rerender(tree(makeBody(), [{ chatType: 3 }, { chatType: 1 }]));
        expect(projectAvatarSrcMap).not.toHaveBeenCalled();
    });

    it("starts no request and no timer", () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const timers = vi.spyOn(globalThis, "setInterval");
        render(tree(makeBody()));
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(timers).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
        timers.mockRestore();
    });
});

describe("answer buttons render budget (MIP-1211)", () => {
    it("answering one task does not draw the other rows again", async () => {
        const { act } = await import("@testing-library/react");
        const { resetAnswerStore } = await import("../features/inbox/inboxAnswerStore");
        resetAnswerStore();
        rows.renders = 0;
        const body = {
            version: 2,
            sections: [
                {
                    heading: "h",
                    key: "overdue",
                    items: Array.from({ length: 4 }, (_, i) => ({
                        text: `a ${i}`,
                        kind: "task",
                        display_id: `T-${i}`,
                        title: `a ${i}`,
                        status: "Open",
                        task_id: 100 + i,
                        can_answer: true,
                    })),
                },
            ],
        };
        const { getAllByRole } = render(
            <CssVarsProvider>
                <MemoryRouter>
                    <GenosReportBody itemBody={body} teamId="t" userId="u" />
                </MemoryRouter>
            </CssVarsProvider>
        );
        expect(rows.renders).toBe(4);
        const { setAnswer, answerKey } = await import("../features/inbox/inboxAnswerStore");
        await act(async () => {
            setAnswer(answerKey("u", "t", 101), {
                phase: "saved",
                answer: "on_it",
                previous: null,
                reason: null,
            });
        });
        // The shell of that one row drew again (its Undo); no status label did.
        expect(rows.renders).toBe(4);
        expect(getAllByRole("button", { name: /^Undo/ }).length).toBe(1);
        resetAnswerStore();
    });
});
