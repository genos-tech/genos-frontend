/**
 * MIP-1211: "On it" and "Not important" on a report's task rows, and the "N unchanged" chip.
 *
 * Layout (390 / 1440, light / dark, RTL) is checked by eye in the running app: jsdom has no
 * layout. These pin the behaviour: which rows get buttons, the request each tap sends, the
 * optimistic dim and its Undo, the refusals told in words, that one answer reaches every card
 * of the same task, and that a tap never opens the task.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GenosReportBody } from "../features/inbox/components/GenosReportBody";
import { resetAnswerStore } from "../features/inbox/inboxAnswerStore";
import { en } from "../i18n/locales/en";

const api = vi.hoisted(() => ({ put: vi.fn(), delete: vi.fn() }));

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../services/api", () => ({ authApi: () => api }));

const c = en.inbox.report;

const task = (n: number, over: Record<string, unknown> = {}) => ({
    text: `MIP-${n} · Task ${n}`,
    link: `/workspace/tasks/project/3/task/${n}`,
    kind: "task",
    project: { id: 3, name: "Genos", code: "MIP" },
    display_id: `MIP-${n}`,
    title: `Task ${n}`,
    status: "Open",
    task_id: 1000 + n,
    can_answer: true,
    ...over,
});

const body = (items: unknown[], extra: Record<string, unknown> = {}) => ({
    version: 2,
    title: "What to do today",
    text: "Two overdue.",
    sections: [{ heading: "Overdue", key: "overdue", items }],
    ...extra,
});

const tree = (itemBody: unknown, userId = "u1", teamId = "t1") => (
    <CssVarsProvider>
        <MemoryRouter>
            <GenosReportBody itemBody={itemBody} teamId={teamId} userId={userId} />
        </MemoryRouter>
    </CssVarsProvider>
);

const press = async (name: RegExp | string) => {
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name }));
    });
};

const saved = (previous: string | null = null) => ({
    data: { taskId: 1001, displayId: "MIP-1", mark: "on_it", previous },
});

const refusal = (status: number, code?: string) =>
    Object.assign(new Error("refused"), { response: { status, data: code ? { code } : {} } });

beforeEach(() => {
    api.put.mockReset().mockResolvedValue(saved());
    api.delete.mockReset().mockResolvedValue({ data: {} });
    resetAnswerStore();
});

describe("which rows get buttons", () => {
    it("draws both buttons on a row the server marked answerable, and names the task", () => {
        render(tree(body([task(1)])));
        expect(screen.getByRole("button", { name: "On it: MIP-1 Task 1" })).toBeTruthy();
        expect(
            screen.getByRole("button", { name: "Mark MIP-1 Task 1 as not important" })
        ).toBeTruthy();
    });

    it("draws none without can_answer, without a valid task_id, or without a member and team", () => {
        const { container, rerender } = render(
            tree(
                body([
                    task(1, { can_answer: undefined }),
                    task(2, { can_answer: "true" }),
                    task(3, { task_id: "1003" }),
                    task(4, { task_id: 1.5 }),
                    task(5, { task_id: -4 }),
                    task(6, { task_id: undefined }),
                ])
            )
        );
        expect(container.querySelectorAll("button[aria-label]").length).toBe(0);
        // A good row, but the card was given no member or team.
        rerender(
            <CssVarsProvider>
                <MemoryRouter>
                    <GenosReportBody itemBody={body([task(1)])} />
                </MemoryRouter>
            </CssVarsProvider>
        );
        expect(screen.queryByRole("button", { name: /On it/ })).toBeNull();
    });

    it("sends no request until a tap", () => {
        render(tree(body([task(1), task(2)])));
        expect(api.put).not.toHaveBeenCalled();
        expect(api.delete).not.toHaveBeenCalled();
    });

    it("keeps the buttons out of the row's link, and a tap does not open the task", async () => {
        const onRowClick = vi.fn();
        render(
            <CssVarsProvider>
                <MemoryRouter>
                    {/* The Inbox row around a card opens the item on a click. */}
                    <div onClick={onRowClick}>
                        <GenosReportBody itemBody={body([task(1)])} teamId="t1" userId="u1" />
                    </div>
                </MemoryRouter>
            </CssVarsProvider>
        );
        const button = screen.getByRole("button", { name: /^On it:/ });
        expect(button.closest("a")).toBeNull();
        await press(/^On it:/);
        expect(onRowClick).not.toHaveBeenCalled();
    });
});

describe("answering", () => {
    it("PUTs the mark with the team and where it came from, to the task's id", async () => {
        render(tree(body([task(1)])));
        await press(/^On it:/);
        expect(api.put).toHaveBeenCalledTimes(1);
        expect(api.put).toHaveBeenCalledWith(
            "/user/memory/marks/1001/",
            { mark: "on_it", source: "report" },
            expect.objectContaining({ params: { team_id: "t1" } })
        );
    });

    it("sends not_important for the other button", async () => {
        render(tree(body([task(1)])));
        await press(/^Mark MIP-1 Task 1 as not important/);
        expect(api.put.mock.calls[0][1]).toEqual({ mark: "not_important", source: "report" });
    });

    it("dims the row at once, before the server has answered", async () => {
        let release: (v: unknown) => void = () => undefined;
        api.put.mockReturnValue(new Promise((resolve) => (release = resolve)));
        const { container } = render(tree(body([task(1)])));
        await press(/^On it:/);
        expect(container.querySelector("[data-answer-row='dimmed']")).not.toBeNull();
        await act(async () => release(saved()));
        expect(screen.getByText(c.answerQuietedOnIt)).toBeTruthy();
    });

    it("says what happened, with an Undo, once saved", async () => {
        render(tree(body([task(1)])));
        await press(/^Mark MIP-1 Task 1 as not important/);
        expect(screen.getByText(c.answerQuietedNotImportant)).toBeTruthy();
        expect(
            screen.getByRole("button", { name: /^Undo the answer for MIP-1 Task 1/ })
        ).toBeTruthy();
        // The two answers are not offered again while one stands.
        expect(screen.queryByRole("button", { name: /^On it:/ })).toBeNull();
    });

    it("a double tap sends one request", async () => {
        let release: (v: unknown) => void = () => undefined;
        api.put.mockReturnValue(new Promise((resolve) => (release = resolve)));
        render(tree(body([task(1)])));
        const button = screen.getByRole("button", { name: /^On it:/ });
        await act(async () => {
            fireEvent.click(button);
            fireEvent.click(button);
        });
        expect(api.put).toHaveBeenCalledTimes(1);
        await act(async () => release(saved()));
    });
});

describe("Undo", () => {
    it("clears the mark when there was none before", async () => {
        const { container } = render(tree(body([task(1)])));
        await press(/^On it:/);
        await press(/^Undo the answer/);
        expect(api.delete).toHaveBeenCalledWith(
            "/user/memory/marks/1001/",
            expect.objectContaining({ params: { team_id: "t1" } })
        );
        // The row is as the report drew it, with its buttons back.
        expect(container.querySelector("[data-answer-row='dimmed']")).toBeNull();
        expect(screen.getByRole("button", { name: /^On it:/ })).toBeTruthy();
    });

    it("puts the earlier mark back when the answer replaced one", async () => {
        api.put.mockResolvedValueOnce(saved("priority_is_right"));
        render(tree(body([task(1)])));
        await press(/^On it:/);
        await press(/^Undo the answer/);
        expect(api.delete).not.toHaveBeenCalled();
        expect(api.put).toHaveBeenLastCalledWith(
            "/user/memory/marks/1001/",
            { mark: "priority_is_right", source: "report" },
            expect.anything()
        );
    });

    it("keeps the row dimmed and says so when the Undo is refused", async () => {
        render(tree(body([task(1)])));
        await press(/^On it:/);
        api.delete.mockRejectedValueOnce(refusal(500));
        await press(/^Undo the answer/);
        expect(screen.getByRole("alert").textContent).toBe(c.answerUndoFailed);
        expect(screen.getByRole("button", { name: /^Undo the answer/ })).toBeTruthy();
    });
});

describe("refusals, told in words", () => {
    it("409 recording_off: Genos is not noting activity, and the buttons go", async () => {
        api.put.mockRejectedValueOnce(refusal(409, "recording_off"));
        const { container } = render(tree(body([task(1)])));
        await press(/^On it:/);
        expect(screen.getByRole("alert").textContent).toBe(c.answerRecordingOff);
        expect(c.answerRecordingOff).toBe(
            "Genos isn't noting your activity, so it can't remember this."
        );
        expect(container.querySelector("[data-answer-row='dimmed']")).toBeNull();
        expect(screen.queryByRole("button", { name: /^On it:/ })).toBeNull();
    });

    it("404: the task is gone", async () => {
        api.put.mockRejectedValueOnce(refusal(404));
        render(tree(body([task(1)])));
        await press(/^On it:/);
        expect(screen.getByRole("alert").textContent).toBe(c.answerGone);
    });

    it("anything else: a generic line, the row is back to normal and can be tried again", async () => {
        api.put.mockRejectedValueOnce(refusal(500));
        const { container } = render(tree(body([task(1)])));
        await press(/^On it:/);
        expect(screen.getByRole("alert").textContent).toBe(c.answerFailed);
        expect(container.querySelector("[data-answer-row='dimmed']")).toBeNull();
        await press(/^On it:/);
        expect(api.put).toHaveBeenCalledTimes(2);
        expect(screen.getByText(c.answerQuietedOnIt)).toBeTruthy();
    });
});

describe("one task, one answer everywhere", () => {
    it("a task in two cards answers in both", async () => {
        render(
            <CssVarsProvider>
                <MemoryRouter>
                    <div data-testid="a">
                        <GenosReportBody itemBody={body([task(1)])} teamId="t1" userId="u1" />
                    </div>
                    <div data-testid="b">
                        <GenosReportBody itemBody={body([task(1)])} teamId="t1" userId="u1" />
                    </div>
                </MemoryRouter>
            </CssVarsProvider>
        );
        await act(async () => {
            fireEvent.click(
                within(screen.getByTestId("a")).getByRole("button", { name: /^On it:/ })
            );
        });
        expect(within(screen.getByTestId("b")).getByText(c.answerQuietedOnIt)).toBeTruthy();
    });

    it("another team or member's card is not touched", async () => {
        render(
            <CssVarsProvider>
                <MemoryRouter>
                    <div data-testid="a">
                        <GenosReportBody itemBody={body([task(1)])} teamId="t1" userId="u1" />
                    </div>
                    <div data-testid="b">
                        <GenosReportBody itemBody={body([task(1)])} teamId="t2" userId="u1" />
                    </div>
                </MemoryRouter>
            </CssVarsProvider>
        );
        await act(async () => {
            fireEvent.click(
                within(screen.getByTestId("a")).getByRole("button", { name: /^On it:/ })
            );
        });
        expect(within(screen.getByTestId("b")).queryByText(c.answerQuietedOnIt)).toBeNull();
    });

    it("another member's card in the same team is not touched", async () => {
        render(
            <CssVarsProvider>
                <MemoryRouter>
                    <div data-testid="a">
                        <GenosReportBody itemBody={body([task(1)])} teamId="t1" userId="u1" />
                    </div>
                    <div data-testid="b">
                        <GenosReportBody itemBody={body([task(1)])} teamId="t1" userId="u2" />
                    </div>
                </MemoryRouter>
            </CssVarsProvider>
        );
        await act(async () => {
            fireEvent.click(
                within(screen.getByTestId("a")).getByRole("button", { name: /^On it:/ })
            );
        });
        expect(within(screen.getByTestId("b")).queryByText(c.answerQuietedOnIt)).toBeNull();
    });

    it("survives a remount: a row scrolled away and back still has its Undo", async () => {
        const { unmount } = render(tree(body([task(1)])));
        await press(/^On it:/);
        unmount();
        render(tree(body([task(1)])));
        expect(screen.getByRole("button", { name: /^Undo the answer/ })).toBeTruthy();
    });

    it("an answer that lands after the row unmounted is still kept", async () => {
        let release: (v: unknown) => void = () => undefined;
        api.put.mockReturnValue(new Promise((resolve) => (release = resolve)));
        const { unmount } = render(tree(body([task(1)])));
        await press(/^On it:/);
        unmount();
        await act(async () => release(saved()));
        render(tree(body([task(1)])));
        await waitFor(() =>
            expect(screen.getByRole("button", { name: /^Undo the answer/ })).toBeTruthy()
        );
    });
});

describe("the held-back chip", () => {
    it("draws the server's still_same count with its words, and never computes one", () => {
        render(
            tree(
                body([task(1, { can_answer: undefined, task_id: undefined })], {
                    stats: [
                        { key: "overdue", count: 1, emoji: "🔥" },
                        { key: "still_same", count: 4, emoji: "🔁" },
                        { key: "quieted", count: 2, emoji: "🔕" },
                    ],
                })
            )
        );
        const chip = document.querySelector("[data-report-stat='still_same']") as HTMLElement;
        expect(chip.textContent).toContain("4");
        expect(chip.textContent).toContain(c.statUnchanged);
        const quieted = document.querySelector("[data-report-stat='quieted']") as HTMLElement;
        expect(quieted.textContent).toContain(c.statQuieted);
    });

    it("falls back to the table's emoji when the server's is not an emoji", () => {
        render(
            tree(
                body([task(1)], {
                    stats: [{ key: "still_same", count: 3, emoji: "<b>x</b>" }],
                })
            )
        );
        const chip = document.querySelector("[data-report-stat='still_same']") as HTMLElement;
        expect(chip.textContent).toContain("🔁");
        expect(chip.querySelector("b")).toBeNull();
    });
});

describe("an old report", () => {
    it("without the new fields draws exactly the rows it always did", () => {
        const old = task(1);
        delete (old as Record<string, unknown>).task_id;
        delete (old as Record<string, unknown>).can_answer;
        const { container } = render(tree(body([old])));
        expect(container.querySelector("[data-answer-row]")).toBeNull();
        expect(screen.getByText("Task 1")).toBeTruthy();
    });
});

describe("writeMark", () => {
    it("refuses an id that is not a positive integer before any request", async () => {
        const { writeMark } = await import("../features/genos/memory/memoryApi");
        for (const id of [0, -1, 1.5, Number.NaN, 2 ** 60]) {
            const res = await writeMark("tok", "t1", id, "on_it");
            expect(res).toEqual({ ok: false, reason: "bad_input" });
        }
        expect(api.put).not.toHaveBeenCalled();
    });

    it("reads previous as untrusted: a mark it knows, else null", async () => {
        const { writeMark } = await import("../features/genos/memory/memoryApi");
        api.put.mockResolvedValueOnce({ data: { previous: "on_it" } });
        expect(await writeMark("tok", "t1", 5, "not_important")).toEqual({
            ok: true,
            data: { previous: "on_it" },
        });
        api.put.mockResolvedValueOnce({ data: { previous: "<script>" } });
        expect(await writeMark("tok", "t1", 5, "not_important")).toEqual({
            ok: true,
            data: { previous: null },
        });
        api.put.mockResolvedValueOnce({ data: {} });
        expect(await writeMark("tok", "t1", 5, "not_important")).toEqual({
            ok: true,
            data: { previous: null },
        });
    });
});
