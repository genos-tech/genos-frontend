/**
 * MIP-1811: a `YYYY-MM-DD` start / due date is a calendar day, the same day in every time zone.
 *
 * `new Date("2026-12-02")` is UTC midnight. Read with the local getters (or `setHours(0, 0, 0, 0)`,
 * or `toLocaleDateString`), it is Dec 1 for anyone west of UTC, so the task graph's node dates,
 * the "days left" tone, the milestone card and the due labels were one day early in the
 * Americas. Production has one user (Tokyo, east of UTC), so nobody saw it.
 *
 * The zone is forced PER CASE with `process.env.TZ` (Node re-reads it on assignment), so this
 * fails on the old code on a UTC build machine too, not only when run as `TZ=... vitest`.
 * Asia/Tokyo is the east-of-UTC control that always passed. "Now" is frozen at Nov 25 2026, noon
 * LOCAL time of the zone under test.
 */
import { useEffect } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { MilestoneCardBody } from "../features/tasks/components/MilestoneCardBody";
import { MilestoneNodeView } from "../features/tasks/diagram/components/MilestoneNodeCard";
import { ModalTaskDiagram } from "../features/tasks/diagram/components/ModalTaskDiagram";
import { computeOverview } from "../features/tasks/diagram/components/taskFlowCanvasHelpers";
import { TaskNodeView } from "../features/tasks/diagram/components/TaskNodeCard";
import type { TaskGraph, TaskNodeData } from "../features/tasks/diagram/types";
import { computeHealth, getScheduleStatus } from "../features/tasks/diagram/utils/scheduleStatus";
import type { Milestone } from "../features/tasks/sprint-milestone/types";
import { groupMilestonesByYearAndSprint } from "../features/tasks/sprint-milestone/utils/sortMilestones";
import { formatDueLabel } from "../features/tasks/utils/dashboardRowFormat";
import { dueBucket, urgencyPoints } from "../features/tasks/utils/taskWeight";
import { getMessages, I18nProvider, loadLocale } from "../i18n";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";
import type { TaskTableProps } from "../types/tasks";
import { calendarDaysUntil, formatMonthDay, parseCalendarDate } from "../utils/calendarDate";

vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../features/tasks/diagram/components/TaskFlowCanvas", async (importOriginal) => ({
    ...(await importOriginal<
        typeof import("../features/tasks/diagram/components/TaskFlowCanvas")
    >()),
    TaskFlowCanvas: ({ onOverviewChange }: { onOverviewChange?: (o: unknown) => void }) => {
        useEffect(() => {
            onOverviewChange?.({
                spanStart: "2026-12-02",
                spanEnd: "2026-12-20",
                spanDays: 19,
                total: 4,
                closed: 1,
                sprint: { name: "S1", startDate: "2026-12-02", endDate: "2026-12-16" },
                health: null,
            });
        }, [onOverviewChange]);
        return <div data-testid="canvas" />;
    },
}));
vi.mock("@xyflow/react", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@xyflow/react")>()),
    Handle: () => <i />,
}));

const ZONES = [
    { zone: "America/Los_Angeles", west: true },
    { zone: "Pacific/Honolulu", west: true },
    { zone: "Asia/Tokyo", west: false },
] as const;

const ORIGINAL_TZ = process.env.TZ;

describe.each(ZONES)("a calendar date in $zone", ({ zone, west }) => {
    beforeEach(async () => {
        process.env.TZ = zone;
        // The switch took effect (west of UTC the offset is positive minutes behind).
        const offset = new Date(2026, 11, 2).getTimezoneOffset();
        expect(west ? offset > 0 : offset < 0).toBe(true);
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 10, 25, 12, 0, 0));
        await loadLocale("en");
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        window.localStorage.removeItem(LOCALE_STORAGE_KEY);
        if (ORIGINAL_TZ === undefined) delete process.env.TZ;
        else process.env.TZ = ORIGINAL_TZ;
    });

    describe("pure helpers", () => {
        it("parseCalendarDate is that day at local midnight", () => {
            const d = parseCalendarDate("2026-12-02");
            expect([d?.getFullYear(), d?.getMonth(), d?.getDate(), d?.getHours()]).toEqual([
                2026, 11, 2, 0,
            ]);
            // A timestamp counts by its date part; nonsense and impossible days are null.
            expect(parseCalendarDate("2026-12-02T00:00:00Z")?.getDate()).toBe(2);
            expect(parseCalendarDate("2026-02-31")).toBeNull();
            expect(parseCalendarDate("soon")).toBeNull();
            expect(parseCalendarDate(null)).toBeNull();
            expect(parseCalendarDate("")).toBeNull();
        });

        it("calendarDaysUntil counts whole days from the viewer's today", () => {
            expect(calendarDaysUntil("2026-11-25")).toBe(0);
            expect(calendarDaysUntil("2026-11-26")).toBe(1);
            expect(calendarDaysUntil("2026-11-24")).toBe(-1);
            expect(calendarDaysUntil("2026-12-02")).toBe(7);
            expect(calendarDaysUntil("nope")).toBeNull();
        });

        it("formatMonthDay writes the same day, in the given language", () => {
            expect(formatMonthDay("2026-12-02", "en")).toBe("Dec 2");
            expect(formatMonthDay("2026-01-01", "en")).toBe("Jan 1");
            expect(formatMonthDay("2026-12-02", "fr")).toMatch(/2\s+déc/);
            expect(formatMonthDay(null, "en")).toBeNull();
            expect(formatMonthDay("soon", "en")).toBeNull();
        });

        it("getScheduleStatus: node dates, days until due, duration", () => {
            const s = getScheduleStatus("2026-12-02", "2026-12-20", "Open", "en");
            expect(s.startLabel).toBe("Dec 2");
            expect(s.dueLabel).toBe("Dec 20");
            expect(s.daysUntilDue).toBe(25);
            expect(s.durationDays).toBe(19);
            expect(s.tone).toBe("neutral");
        });

        it("getScheduleStatus: a task due today is amber, not overdue", () => {
            const today = getScheduleStatus(null, "2026-11-25", "Open", "en");
            expect(today.daysUntilDue).toBe(0);
            expect(today.tone).toBe("amber");
            const yesterday = getScheduleStatus(null, "2026-11-24", "Open", "en");
            expect(yesterday.daysUntilDue).toBe(-1);
            expect(yesterday.tone).toBe("red");
        });

        it("computeHealth: a window that is half over is 50% expected", () => {
            const h = computeHealth({ start: "2026-11-20", end: "2026-11-30" }, 10, 5);
            expect(h?.expectedPct).toBe(50);
            expect(h?.tone).toBe("on-track");
            // The last day of the window is not yet "behind".
            expect(
                computeHealth({ start: "2026-11-20", end: "2026-11-25" }, 10, 9)?.tone
            ).not.toBe("behind");
        });

        it("formatDueLabel: today, tomorrow and a date a week out", () => {
            const labels = getMessages("en").tasks.dueLabel;
            expect(formatDueLabel("2026-11-25", "en")).toEqual({
                text: labels.dueToday,
                tone: "today",
            });
            expect(formatDueLabel("2026-11-26", "en").text).toBe(labels.dueTomorrow);
            expect(formatDueLabel("2026-12-02", "en").text).toMatch(/Dec 2$/);
        });

        it("task weight: the urgency ramp and the due bucket count from the same today", () => {
            const now = new Date();
            expect(dueBucket("2026-11-25", now)).toBe("today");
            expect(dueBucket("2026-11-24", now)).toBe("overdue");
            expect(dueBucket("2026-12-02", now)).toBe("week");
            // Due tomorrow = 1 day left = the top of the ramp (5).
            expect(urgencyPoints("2026-11-26", now)).toBe(5);
            expect(urgencyPoints("2026-11-30", now)).toBe(1);
        });

        it("a milestone dated Jan 1 sits in that year's group, not the year before", () => {
            const m = {
                milestoneId: 1,
                sprintId: null,
                dueDate: "2026-01-01",
                title: "NY",
            } as unknown as Milestone;
            const groups = groupMilestonesByYearAndSprint([m], []);
            expect(groups.map((g) => g.year)).toEqual(["2026"]);
        });

        it("computeOverview: a task due in exactly seven days is due soon, one in eight is not", () => {
            const row = (id: number, dueDate: string) =>
                ({
                    id: String(id),
                    title: `t${id}`,
                    status: "Open",
                    parentTaskId: id === 1 ? null : "1",
                    dueDate,
                    startDate: null,
                    tags: [],
                    projectId: 1,
                }) as unknown as TaskTableProps;
            const graph = {
                rootTaskId: 1,
                tasks: [
                    row(1, "2026-12-31"),
                    row(2, "2026-12-02"),
                    row(3, "2026-12-03"),
                    row(4, "2026-11-24"),
                ],
                externalTasks: [],
                dependencyEdges: [],
            } as unknown as TaskGraph;
            const o = computeOverview(graph, new Map(), new Map());
            expect(o.dueSoonCount).toBe(1);
            expect(o.overdueCount).toBe(1);
        });
    });

    describe("what the graph and the milestone card write", () => {
        const withEnglish = (ui: React.ReactNode) => {
            window.localStorage.setItem(LOCALE_STORAGE_KEY, "en");
            return render(
                <I18nProvider>
                    <CssVarsProvider>{ui}</CssVarsProvider>
                </I18nProvider>
            );
        };

        const avatars = (node: React.ReactNode) => (
            <AvatarContextProvider
                value={{
                    myself: { userId: "u1", userName: "Ken", teamId: "t1" } as never,
                    setMyself: () => {},
                    teamMemberProfiles: {},
                    setTeamMemberProfiles: () => {},
                    socket: null,
                    useCM: {} as never,
                    useUISM: {} as never,
                }}
            >
                {node}
            </AvatarContextProvider>
        );

        const nodeData = (over: Partial<TaskNodeData> = {}, task: Partial<TaskTableProps> = {}) =>
            ({
                task: {
                    id: 7,
                    displayId: "MIP-7",
                    title: "Node title",
                    status: "Open",
                    priority: null,
                    assigneeId: null,
                    assigneeName: "",
                    startDate: "2026-12-02",
                    dueDate: "2026-12-20",
                    isMilestone: false,
                    ...task,
                } as unknown as TaskTableProps,
                isRoot: false,
                isCurrentPreview: false,
                isMilestone: false,
                isExternal: false,
                closedDescendantCount: 0,
                totalDescendantCount: 0,
                openBlockerCount: 0,
                projectName: null,
                onChange: vi.fn(),
                onAddSubtask: vi.fn(),
                onDelete: vi.fn(),
                onOpenPreview: vi.fn(),
                ...over,
            }) as TaskNodeData;

        it("a task node's start - due", () => {
            withEnglish(avatars(<TaskNodeView data={nodeData()} />));
            expect(screen.getByText("Dec 2 – Dec 20")).toBeTruthy();
        });

        it("a milestone node's dates and its sprint window", () => {
            withEnglish(
                avatars(
                    <MilestoneNodeView
                        data={nodeData(
                            {
                                isMilestone: true,
                                totalDescendantCount: 3,
                                closedDescendantCount: 1,
                                sprint: {
                                    id: 1,
                                    name: "S1",
                                    startDate: "2026-12-02",
                                    endDate: "2026-12-16",
                                } as never,
                            },
                            { isMilestone: true }
                        )}
                    />
                )
            );
            expect(screen.getByText("Dec 2 – Dec 20")).toBeTruthy();
            expect(screen.getByText("Dec 2 – Dec 16")).toBeTruthy();
        });

        it("the graph modal's header span and sprint", async () => {
            withEnglish(
                <ModalTaskDiagram
                    myself={{ userId: "u1", userName: "Ken", teamId: "t1" } as never}
                    projectId={1}
                    rootLabel="KDS-5 · Five"
                    rootTaskId={5}
                    usePM={{} as never}
                    useTM={{} as never}
                    open
                    onClose={vi.fn()}
                />
            );
            await waitFor(() => {
                expect(document.body.textContent).toContain("Dec 2 – Dec 20");
                expect(document.body.textContent).toContain("Dec 2 – Dec 16");
            });
        });

        it("the milestone card's due date", () => {
            withEnglish(
                avatars(
                    <MilestoneCardBody
                        sprintName={null}
                        topRight={null}
                        milestone={
                            {
                                milestoneId: 1,
                                taskId: 1,
                                displayId: "MIP-1",
                                title: "Launch",
                                status: "Open",
                                dueDate: "2026-12-02",
                                assignees: [],
                                tags: [],
                                tasksTotal: 2,
                                tasksClosed: 1,
                            } as unknown as Milestone
                        }
                    />
                )
            );
            expect(screen.getByText("Dec 2")).toBeTruthy();
        });
    });
});
