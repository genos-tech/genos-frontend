/**
 * MIP-2457: a slow report runs after "Run now" has answered `started`.
 *
 * Pinned: the answer is a "Started" toast, never a failure; the run is followed until the SERVER
 * says it is over and then announced once (recorded ok, recorded failed, or no result recorded);
 * "Running…" on the button comes from the server's `running`, so it ends when the server says so
 * and can never be a spinner left behind; the list is read again while a run goes on and not
 * otherwise; and the dashboard tab shows the new page when a background run ends.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SchedulesSection } from "../components/layout/schedules/SchedulesSection";
import { FOLLOW_EVERY_MS, followRun, stopFollowing } from "../features/schedules/followRun";
import { announceRunResult } from "../features/schedules/runScheduleAndAnnounce";
import { CustomDashboardsTab } from "../features/tasks/components/dashboard/customDashboards/CustomDashboardsTab";
import { loadCustomDashboards } from "../features/tasks/services/loadCustomDashboards";
import { en } from "../i18n/locales/en";
import type { Schedule } from "../services/schedules";

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const listSchedules = vi.fn();
const runScheduleNow = vi.fn();
vi.mock("../services/schedules", () => ({
    listSchedules: (...a: unknown[]) => listSchedules(...a),
    createSchedule: vi.fn(),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    runScheduleNow: (...a: unknown[]) => runScheduleNow(...a),
}));
const toast = vi.hoisted(() => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    neutral: vi.fn(),
}));
vi.mock("../components/ui/feedback/toastStore", () => ({ toast }));
vi.mock("../features/inbox/inboxResyncEvent", () => ({
    requestInboxResync: vi.fn(async () => undefined),
}));
vi.mock("../services/appNavigate", () => ({ requestAppNavigate: vi.fn() }));
vi.mock("../features/tasks/services/loadCustomDashboards", () => ({
    loadCustomDashboards: vi.fn(),
}));
const viewerMounts = vi.hoisted(() => ({ n: 0 }));
vi.mock("../features/notes/common/components/HtmlNoteView", async () => {
    const { useEffect } = await import("react");
    return {
        HtmlNoteView: () => {
            useEffect(() => {
                viewerMounts.n += 1;
            }, []);
            return <div data-testid="note-viewer" />;
        },
    };
});

const s = en.settings.schedules;
const c = en.tasks.dashboard.customDashboards;
const STARTED_AT = "2026-11-27T21:50+09:00";

const row = (over: Partial<Schedule> = {}): Schedule =>
    ({
        id: "s1",
        name: "Board",
        job: "ai_dashboard",
        jobTitle: "Dashboard page",
        params: {},
        when: "every day at 09:00",
        frequency: "daily",
        timeOfDay: "09:00",
        enabled: true,
        deliverPush: true,
        nextRun: null,
        lastRun: null,
        lastStatus: null,
        running: false,
        ...over,
    }) as Schedule;

const list = (schedules: Schedule[]) => ({
    timeZone: "Asia/Tokyo",
    limit: 20,
    jobs: [],
    schedules,
    suggestions: [],
    chatTargets: [],
});

const tick = async (ms = FOLLOW_EVERY_MS) => {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
};

const started = {
    ok: true as const,
    outcome: { status: "started" as const, error: "", title: "", items: 0, startedAt: STARTED_AT },
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    viewerMounts.n = 0;
});

afterEach(() => {
    stopFollowing("s1");
    vi.useRealTimers();
});

describe("following a background run", () => {
    const follow = () => {
        const onEnd = vi.fn();
        followRun({ accessToken: "tok", teamId: "t1", id: "s1", startedAt: STARTED_AT, onEnd });
        return onEnd;
    };

    it("waits while the server says it is running, then reports what was recorded, once", async () => {
        listSchedules.mockResolvedValue(list([row({ running: true })]));
        const onEnd = follow();
        await tick();
        await tick();
        expect(onEnd).not.toHaveBeenCalled();
        listSchedules.mockResolvedValue(
            list([
                row({
                    lastRun: STARTED_AT,
                    lastStatus: "ok",
                    lastResult: { title: "Your board", items: 3 },
                }),
            ])
        );
        await tick();
        await tick();
        expect(onEnd).toHaveBeenCalledTimes(1);
        expect(onEnd).toHaveBeenCalledWith({
            status: "ok",
            error: "",
            title: "Your board",
            items: 3,
        });
    });

    it("reports a recorded failure in the server's words", async () => {
        listSchedules.mockResolvedValue(
            list([row({ lastRun: STARTED_AT, lastStatus: "failed", lastError: "No page." })])
        );
        const onEnd = follow();
        await tick();
        expect(onEnd.mock.calls[0][0]).toMatchObject({ status: "failed", error: "No page." });
    });

    it("says so when the run stopped without recording anything", async () => {
        listSchedules.mockResolvedValue(
            list([row({ lastRun: "2026-11-26T09:00+09:00", lastStatus: "ok" })])
        );
        const onEnd = follow();
        await tick();
        expect(onEnd.mock.calls[0][0]).toMatchObject({ status: "failed", error: s.runStopped });
    });

    it("ends quietly when the schedule was deleted, and keeps asking through a failed read", async () => {
        listSchedules.mockResolvedValueOnce(null).mockResolvedValue(list([]));
        const onEnd = follow();
        await tick();
        await tick();
        await tick();
        expect(listSchedules).toHaveBeenCalledTimes(2);
        expect(onEnd).not.toHaveBeenCalled();
    });

    it("a started answer is a Started toast, then the usual announcement", async () => {
        listSchedules.mockResolvedValue(
            list([
                row({
                    lastRun: STARTED_AT,
                    lastStatus: "ok",
                    lastResult: { title: "Your board", items: 1 },
                }),
            ])
        );
        await announceRunResult(started, "s1", () => true, null, {
            accessToken: "tok",
            teamId: "t1",
        });
        expect(toast.neutral).toHaveBeenCalledWith(s.runStarted, expect.anything());
        expect(toast.error).not.toHaveBeenCalled();
        await tick();
        expect(toast.success).toHaveBeenCalledWith(
            s.reportReadyTitled.replace("{title}", "Your board"),
            expect.anything()
        );
    });
});

describe("Settings > Schedules", () => {
    it("shows Running… from the server's word, and Run now again when the server says over", async () => {
        listSchedules.mockResolvedValue(list([row({ running: true })]));
        render(
            <CssVarsProvider>
                <SchedulesSection teamId="t1" />
            </CssVarsProvider>
        );
        await tick(0);
        expect(screen.getByRole("button", { name: s.running })).toBeDisabled();
        listSchedules.mockResolvedValue(list([row({ lastRun: STARTED_AT, lastStatus: "ok" })]));
        await tick();
        expect(screen.getByRole("button", { name: s.runNow })).toBeEnabled();
        // Nothing runs any more: the list is left alone.
        const reads = listSchedules.mock.calls.length;
        await tick(FOLLOW_EVERY_MS * 3);
        expect(listSchedules.mock.calls.length).toBe(reads);
    });

    it("a started Run now says it started, not that it failed", async () => {
        listSchedules.mockResolvedValue(list([row()]));
        runScheduleNow.mockResolvedValue(started);
        render(
            <CssVarsProvider>
                <SchedulesSection teamId="t1" />
            </CssVarsProvider>
        );
        await tick(0);
        listSchedules.mockResolvedValue(list([row({ running: true })]));
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: s.runNow }));
        });
        await tick(0);
        expect(screen.getByTestId("run-notice").textContent).toBe(s.runStarted);
        expect(screen.getByRole("button", { name: s.running })).toBeDisabled();
        expect(toast.error).not.toHaveBeenCalled();
    });
});

describe("Custom dashboards by AI", () => {
    const dashboards = (running: boolean, lastRun: string) => ({
        status: "ready" as const,
        data: {
            own: [
                {
                    scheduleId: "s1",
                    name: "Board",
                    enabled: true,
                    lastRun,
                    lastStatus: "ok",
                    note: { noteId: 11, noteType: "personal" as const, title: "Board page" },
                    running,
                },
            ],
            shared: [],
        },
    });

    it("shows Running…, then the new page when the run ends", async () => {
        vi.mocked(loadCustomDashboards).mockResolvedValue(dashboards(true, "a"));
        render(
            <ThemeProvider theme={{ [THEME_ID]: createTheme({ cssVariables: true }) }}>
                <CssVarsProvider>
                    <MemoryRouter initialEntries={["/workspace/tasks?view=custom"]}>
                        <CustomDashboardsTab teamId="t1" />
                    </MemoryRouter>
                </CssVarsProvider>
            </ThemeProvider>
        );
        await tick(0);
        expect(screen.getByRole("button", { name: s.running })).toBeDisabled();
        const mounts = viewerMounts.n;
        vi.mocked(loadCustomDashboards).mockResolvedValue(dashboards(false, "b"));
        await tick();
        expect(screen.getByRole("button", { name: c.runNow })).toBeEnabled();
        expect(viewerMounts.n).toBe(mounts + 1);
    });
});
