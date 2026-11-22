/**
 * MIP-1992: the rich Today view. The pure summary and progress rules, then the row (task or
 * milestone, project, due emphasis, blocked, tags), the page's top block and the good empty day.
 * Layout at 390 and 1440 px is not testable in jsdom: it is read in a real browser (see the PR).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BriefingToday, normaliseBriefing } from "../features/today/briefingToday";
import type { TodayCopy } from "../features/today/briefingWords";
import { TodayBriefing } from "../features/today/TodayBriefing";
import { progressOf, summaryParts, summarySentence } from "../features/today/todaySummary";
import { TodayTaskRow } from "../features/today/TodayTaskRow";
import { en } from "../i18n/locales/en";
import { ja } from "../i18n/locales/ja";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("../services/appNavigate", () => ({ requestAppNavigate: navigate }));

const copy = en.tasks.dashboard.today as unknown as TodayCopy;
const jaCopy = ja.tasks?.dashboard?.today as unknown as TodayCopy;

const day = (over: Partial<BriefingToday> = {}): BriefingToday =>
    normaliseBriefing({
        window: { since: "x", until: "y", timeZone: "UTC", localDate: "2026-11-22" },
        ...over,
    });

beforeEach(() => navigate.mockReset());

describe("summary and progress", () => {
    it("drops the parts that are zero and joins the rest, most pressing first", () => {
        const d = day({
            overdueCount: 1,
            dueTodayCount: 3,
            mentions: [{ source: "chat", at: "t" }],
        });
        expect(summaryParts(d, copy)).toEqual(["1 overdue", "3 due today", "1 waiting on you"]);
        expect(summarySentence(d, copy)).toBe("1 overdue, 3 due today, 1 waiting on you");
    });

    it("says there is nothing due when every part is zero, and joins in the viewer's language", () => {
        expect(summarySentence(day(), copy)).toBe("Nothing due today.");
        const d = day({ overdueCount: 2, dueTodayCount: 1 });
        expect(summarySentence(d, jaCopy)).toContain("、");
    });

    it("counts done against what is done plus what is still due", () => {
        expect(
            progressOf(day({ overdueCount: 1, dueTodayCount: 3, doneToday: { count: 2 } }))
        ).toEqual({
            done: 2,
            left: 4,
            planned: 6,
        });
    });

    it("has no bar when the server does not say what was closed, or nothing was planned", () => {
        expect(progressOf(day({ overdueCount: 1 }))).toBeNull();
        expect(progressOf(day({ doneToday: { count: 0 } }))).toBeNull();
    });
});

const row = (over: Partial<Parameters<typeof TodayTaskRow>[0]> = {}) =>
    render(
        <CssVarsProvider>
            <ul>
                <TodayTaskRow
                    copy={copy}
                    href="/workspace/tasks/project/3/task/11"
                    task={{
                        taskId: 11,
                        projectId: 3,
                        displayId: "WEB-4",
                        title: "Fix login",
                        status: "WIP",
                        priority: "High",
                        daysUntilDue: -3,
                        dueDate: "2026-11-19",
                        projectName: "Website",
                    }}
                    onOpen={navigate}
                    {...over}
                />
            </ul>
        </CssVarsProvider>
    );

describe("TodayTaskRow", () => {
    it("shows the project, the id and an overdue due date in red words", () => {
        row();
        expect(screen.getByText("Website")).toBeInTheDocument();
        expect(screen.getByText("WEB-4")).toBeInTheDocument();
        const due = screen.getByText("3 days overdue");
        expect(due.closest("[data-tone]")?.getAttribute("data-tone")).toBe("overdue");
    });

    it("says Task for a task and Milestone, with its flag, for a milestone", () => {
        const { unmount } = row();
        expect(screen.getByText("Task")).toBeInTheDocument();
        expect(screen.queryByTestId("MilestoneFlag")).toBeNull();
        unmount();
        row({
            task: {
                taskId: 12,
                projectId: 3,
                displayId: "WEB-5",
                title: "Launch",
                isMilestone: true,
                daysUntilDue: 0,
            },
        });
        expect(screen.getAllByText("Milestone").length).toBeGreaterThan(0);
        expect(screen.getByTestId("MilestoneFlag")).toBeInTheDocument();
        expect(screen.getByText("Due today")).toBeInTheDocument();
    });

    it("marks a blocked task with what it waits on", () => {
        row({ blockedBy: [{ displayId: "API-2", title: "Schema" }] });
        expect(screen.getByText("Waiting on API-2")).toBeInTheDocument();
    });

    it("draws the tags it was given", () => {
        row({
            task: {
                taskId: 11,
                projectId: 3,
                displayId: "WEB-4",
                title: "Fix login",
                tags: [{ tagName: "bug", tagColor: "#ff0000", tagTextColor: "#fff" }],
            },
        });
        expect(screen.getByText("bug")).toBeInTheDocument();
    });

    it("opens the task on click, and is plain text when it has no path", () => {
        const { unmount } = row();
        fireEvent.click(screen.getByRole("button"));
        expect(navigate).toHaveBeenCalledWith("/workspace/tasks/project/3/task/11");
        unmount();
        row({ href: null });
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("has no hover preview: hovering the row opens nothing", () => {
        vi.useFakeTimers();
        row();
        fireEvent.mouseOver(screen.getByRole("button"));
        vi.advanceTimersByTime(1000);
        expect(screen.queryByRole("tooltip")).toBeNull();
        vi.useRealTimers();
    });
});

describe("the page", () => {
    const page = (data: BriefingToday) =>
        render(
            <CssVarsProvider>
                <TodayBriefing view={{ status: "ready", data, since: null, refresh: vi.fn() }} />
            </CssVarsProvider>
        );

    it("opens with the day in one sentence and the four numbers", () => {
        page(
            day({
                overdue: [
                    { taskId: 1, projectId: 2, displayId: "A-1", title: "Late", daysUntilDue: -1 },
                ],
                overdueCount: 1,
                doneToday: { count: 2 },
            })
        );
        expect(screen.getByTestId("today-summary").textContent).toBe("1 overdue");
        expect(screen.getByTestId("today-progress")).toBeInTheDocument();
        expect(screen.getByText("Changed")).toBeInTheDocument();
    });

    it("an empty day is a good one: a clear title, what was closed, no empty lists", () => {
        page(day({ doneToday: { count: 3 } }));
        expect(screen.getByText("Your day is clear")).toBeInTheDocument();
        expect(screen.getByText(/You closed 3 today\./)).toBeInTheDocument();
        expect(screen.queryByRole("region")).toBeNull();
    });

    it("keeps the blocked and delegated sections", () => {
        page(
            day({
                blocked: [
                    {
                        taskId: 5,
                        projectId: 2,
                        displayId: "A-5",
                        title: "Stuck",
                        waitingFor: [{ displayId: "A-6", title: "Dep" }],
                    },
                ],
                delegated: [{ taskId: 7, projectId: 2, displayId: "A-7", title: "Given" }],
                delegatedTotal: 1,
            })
        );
        expect(screen.getByRole("region", { name: "You are waiting on" })).toBeInTheDocument();
        const waiting = screen.getByRole("region", { name: "You are waiting on" });
        const handed = screen.getByRole("region", { name: "Handed to others" });
        // Same row component as every other section: a task row with its project line.
        expect(waiting.querySelector('li[data-kind="Task"]')).not.toBeNull();
        expect(handed.querySelector('li[data-kind="Task"]')).not.toBeNull();
        expect(waiting).toHaveTextContent("Dep");
    });
});
