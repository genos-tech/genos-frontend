/**
 * MIP-1228: a Free member sees what schedules do and an upgrade call INSTEAD of the form.
 *
 * `planAllowed` false (or a 403 `plan_required` from any action) swaps the form, the suggestions
 * and the New button for the prompt; kept schedules stay listed with only the actions the API
 * still allows (pause, delete); a schedule paused by the plan says so. A Core member (or an API
 * that predates the gate) sees the page exactly as before. Layout is checked by eye in the
 * running app: jsdom has no layout.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SchedulesSection } from "../components/layout/schedules/SchedulesSection";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const listSchedules = vi.fn();
const createSchedule = vi.fn();
const updateSchedule = vi.fn();
const deleteSchedule = vi.fn();
const runScheduleNow = vi.fn();
vi.mock("../services/schedules", () => ({
    listSchedules: (...a: unknown[]) => listSchedules(...a),
    createSchedule: (...a: unknown[]) => createSchedule(...a),
    updateSchedule: (...a: unknown[]) => updateSchedule(...a),
    deleteSchedule: (...a: unknown[]) => deleteSchedule(...a),
    runScheduleNow: (...a: unknown[]) => runScheduleNow(...a),
}));

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;
const render = (ui: React.ReactElement) =>
    rtlRender(
        <CssVarsProvider>
            <MemoryRouter initialEntries={["/workspace/genos"]}>
                {ui}
                <Where />
            </MemoryRouter>
        </CssVarsProvider>
    );

const JOBS = [
    {
        job: "what_to_do_today",
        title: "What to do today",
        description: "Your plan.",
        params: {},
    },
];
const SCHEDULE = {
    id: "s1",
    name: "Morning plan",
    job: "what_to_do_today",
    jobTitle: "What to do today",
    params: {},
    when: "every day at 09:00",
    frequency: "daily" as const,
    timeOfDay: "09:00",
    enabled: true,
    deliverPush: false,
    nextRun: "2026-11-09T09:00:00+09:00",
    lastRun: null,
    lastStatus: null,
};
const SUGGESTION = {
    key: "morning_plan",
    name: "Morning plan",
    job: "what_to_do_today",
    params: {},
    frequency: "daily" as const,
    timeOfDay: "09:00",
};
const LIST = (over: object = {}) => ({
    timeZone: "Asia/Tokyo",
    limit: 20,
    jobs: JOBS,
    schedules: [],
    suggestions: [],
    ...over,
});
const FREE = (schedules: unknown[] = []) =>
    LIST({ planAllowed: false, planMessage: "Core and up.", schedules });

const PLAN_REFUSED = {
    ok: false,
    gone: false,
    error: "Scheduled reports are part of the Core plan and up.",
    planRequired: true,
};

beforeEach(() => {
    for (const fn of [
        listSchedules,
        createSchedule,
        updateSchedule,
        deleteSchedule,
        runScheduleNow,
    ])
        fn.mockReset();
});

const prompt = () => screen.findByTestId("schedules-upgrade");

describe("a Free member (planAllowed false)", () => {
    it("sees what schedules do, the two examples, a sample report and an upgrade call", async () => {
        listSchedules.mockResolvedValue(FREE());
        render(<SchedulesSection teamId="t1" />);
        const p = await prompt();
        expect(within(p).getByText("Reports that arrive on their own")).toBeTruthy();
        expect(within(p).getByText("Core and up")).toBeTruthy();
        const examples = within(p).getAllByTestId("schedules-upgrade-example");
        expect(examples).toHaveLength(2);
        expect(examples[0].textContent).toContain("Morning plan");
        expect(examples[0].textContent).toContain("09:00");
        expect(examples[1].textContent).toContain("Evening recap");
        expect(examples[1].textContent).toContain("17:00");
        const sample = within(p).getByTestId("schedules-upgrade-sample");
        expect(sample.textContent).toContain("What to do today");
        expect(sample.textContent).toContain("Send the invoice");
        // A picture of a report, not one: hidden from assistive tech and out of the tab order.
        expect(sample.getAttribute("aria-hidden")).toBe("true");
        expect(sample.hasAttribute("inert")).toBe(true);
        expect(within(p).getByRole("button", { name: "See plans" })).toBeTruthy();
    });

    it("shows NO form, no New button, no create-first and no suggestions", async () => {
        listSchedules.mockResolvedValue(FREE());
        render(<SchedulesSection teamId="t1" />);
        await prompt();
        for (const name of [/new schedule/i, /create your first/i, /^add$/i, /create schedule/i])
            expect(screen.queryByRole("button", { name })).toBeNull();
        expect(screen.queryByTestId("schedule-suggestions")).toBeNull();
        expect(screen.queryByText("You have no schedules yet.")).toBeNull();
    });

    it("does not show the server's English planMessage", async () => {
        listSchedules.mockResolvedValue(FREE());
        render(<SchedulesSection teamId="t1" />);
        await prompt();
        expect(screen.queryByText(/Core and up\./)).toBeNull();
    });

    it("the upgrade call closes the host, then goes to the plans page", async () => {
        listSchedules.mockResolvedValue(FREE());
        const order: string[] = [];
        const onNavigateAway = vi.fn(() =>
            order.push(`away@${screen.getByTestId("where").textContent}`)
        );
        render(<SchedulesSection teamId="t1" onNavigateAway={onNavigateAway} />);
        await prompt();
        await userEvent.click(screen.getByRole("button", { name: "See plans" }));
        expect(onNavigateAway).toHaveBeenCalledTimes(1);
        // The host was told BEFORE the route changed.
        expect(order).toEqual(["away@/workspace/genos"]);
        expect(screen.getByTestId("where").textContent).toBe("/workspace/plans");
    });

    it("keeps their schedules listed: only Pause and Delete remain", async () => {
        listSchedules.mockResolvedValue(
            FREE([
                SCHEDULE,
                {
                    ...SCHEDULE,
                    id: "s2",
                    name: "Evening recap",
                    enabled: false,
                    pausedReason: "the plan does not include scheduled reports",
                    nextRun: null,
                },
            ])
        );
        render(<SchedulesSection teamId="t1" />);
        const p = await prompt();
        expect(within(p).getByTestId("schedules-upgrade-kept")).toBeTruthy();
        const rows = await screen.findAllByTestId("schedule-row");
        expect(rows).toHaveLength(2);
        for (const r of rows) {
            expect(within(r).queryByRole("button", { name: /run now/i })).toBeNull();
            expect(within(r).queryByRole("button", { name: /^edit$/i })).toBeNull();
            expect(within(r).getByRole("button", { name: /^delete$/i })).toBeTruthy();
        }
        const running = within(rows[0]).getByRole("switch", { name: /pause morning plan/i });
        expect((running as HTMLInputElement).disabled).toBe(false);
        // A paused one cannot be resumed: the server would refuse it.
        const paused = within(rows[1]).getByRole("switch", { name: /resume evening recap/i });
        expect((paused as HTMLInputElement).disabled).toBe(true);
    });

    it("says why a plan-paused schedule is paused, and that upgrading resumes it", async () => {
        listSchedules.mockResolvedValue(
            FREE([
                {
                    ...SCHEDULE,
                    enabled: false,
                    pausedReason: "the plan does not include scheduled reports",
                    nextRun: null,
                },
            ])
        );
        render(<SchedulesSection teamId="t1" />);
        const r = await screen.findByTestId("schedule-row");
        expect(within(r).getByText(/your plan doesn't include schedules/i).textContent).toContain(
            "Upgrading resumes it"
        );
        // Not the raw label the API sends.
        expect(within(r).queryByText("the plan does not include scheduled reports")).toBeNull();
    });

    it("pausing a kept schedule still works", async () => {
        listSchedules.mockResolvedValue(FREE([SCHEDULE]));
        updateSchedule.mockResolvedValue({ ok: true, schedule: { ...SCHEDULE, enabled: false } });
        render(<SchedulesSection teamId="t1" />);
        const r = await screen.findByTestId("schedule-row");
        await userEvent.click(within(r).getByRole("switch", { name: /pause morning plan/i }));
        expect(updateSchedule).toHaveBeenCalledWith("tok", "t1", "s1", { enabled: false });
    });
});

describe("a Core member, or an API that predates the gate, sees no change", () => {
    it.each([
        ["planAllowed true", { planAllowed: true }],
        ["no planAllowed at all", {}],
    ])("%s", async (_name, over) => {
        listSchedules.mockResolvedValue(
            LIST({ ...over, schedules: [SCHEDULE], suggestions: [SUGGESTION] })
        );
        render(<SchedulesSection teamId="t1" />);
        await screen.findByTestId("schedule-row");
        expect(screen.queryByTestId("schedules-upgrade")).toBeNull();
        expect(screen.getByRole("button", { name: /new schedule/i })).toBeTruthy();
        expect(screen.getByTestId("schedule-suggestions")).toBeTruthy();
        const r = screen.getByTestId("schedule-row");
        expect(within(r).getByRole("button", { name: /run now/i })).toBeTruthy();
        expect(within(r).getByRole("button", { name: /^edit$/i })).toBeTruthy();
    });

    it("a Core member's manual pause reads in words, with no upgrade prompt", async () => {
        listSchedules.mockResolvedValue(
            LIST({
                planAllowed: true,
                schedules: [
                    {
                        ...SCHEDULE,
                        enabled: false,
                        pausedReason: "paused by the member",
                        nextRun: null,
                    },
                ],
            })
        );
        render(<SchedulesSection teamId="t1" />);
        const r = await screen.findByTestId("schedule-row");
        expect(within(r).getByText("Paused by you.")).toBeTruthy();
        expect(screen.queryByTestId("schedules-upgrade")).toBeNull();
    });
});

describe("a 403 plan_required from an action (the plan changed since the list)", () => {
    const allowed = () =>
        listSchedules.mockResolvedValueOnce(
            LIST({ planAllowed: true, schedules: [SCHEDULE], suggestions: [SUGGESTION] })
        );
    const nowFree = () => listSchedules.mockResolvedValue(FREE([SCHEDULE]));

    const expectPrompt = async () => {
        expect(await prompt()).toBeTruthy();
        // The upgrade prompt, not a generic failure.
        expect(screen.queryByRole("alert")).toBeNull();
        expect(screen.queryByText(/couldn't/i)).toBeNull();
        expect(screen.queryByText(/Core plan and up/)).toBeNull();
    };

    it("turning a schedule on", async () => {
        listSchedules.mockResolvedValueOnce(
            LIST({ planAllowed: true, schedules: [{ ...SCHEDULE, enabled: false }] })
        );
        updateSchedule.mockResolvedValue(PLAN_REFUSED);
        nowFree();
        render(<SchedulesSection teamId="t1" />);
        const r = await screen.findByTestId("schedule-row");
        await userEvent.click(within(r).getByRole("switch", { name: /resume morning plan/i }));
        await expectPrompt();
    });

    it("run now", async () => {
        allowed();
        runScheduleNow.mockResolvedValue(PLAN_REFUSED);
        nowFree();
        render(<SchedulesSection teamId="t1" />);
        const r = await screen.findByTestId("schedule-row");
        await userEvent.click(within(r).getByRole("button", { name: /run now/i }));
        await expectPrompt();
        expect(screen.queryByTestId("run-notice")).toBeNull();
    });

    it("adding a suggestion", async () => {
        listSchedules.mockResolvedValueOnce(
            LIST({ planAllowed: true, suggestions: [SUGGESTION] })
        );
        createSchedule.mockResolvedValue(PLAN_REFUSED);
        listSchedules.mockResolvedValue(FREE());
        render(<SchedulesSection teamId="t1" />);
        await userEvent.click(await screen.findByRole("button", { name: /^add$/i }));
        await expectPrompt();
    });

    it("saving the form", async () => {
        listSchedules.mockResolvedValueOnce(LIST({ planAllowed: true }));
        createSchedule.mockResolvedValue(PLAN_REFUSED);
        listSchedules.mockResolvedValue(FREE());
        render(<SchedulesSection teamId="t1" />);
        await userEvent.click(await screen.findByRole("button", { name: /create your first/i }));
        await userEvent.type(await screen.findByLabelText(/^name/i), "Plan");
        await userEvent.click(screen.getByRole("combobox", { name: /report/i }));
        await userEvent.click(await screen.findByRole("option", { name: "What to do today" }));
        await userEvent.click(screen.getByRole("button", { name: /create schedule/i }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalled());
        await expectPrompt();
        expect(screen.queryByRole("button", { name: /create schedule/i })).toBeNull();
    });

    it("still shows the prompt if the list read after it fails or disagrees", async () => {
        allowed();
        runScheduleNow.mockResolvedValue(PLAN_REFUSED);
        // The re-read still says allowed (a stale answer): the member was refused, so the prompt stays.
        listSchedules.mockResolvedValue(LIST({ planAllowed: true, schedules: [SCHEDULE] }));
        render(<SchedulesSection teamId="t1" />);
        const r = await screen.findByTestId("schedule-row");
        await userEvent.click(within(r).getByRole("button", { name: /run now/i }));
        expect(await prompt()).toBeTruthy();
    });
});

describe("other refusals are unchanged", () => {
    it("a plain 400 still shows the server's sentence, not the upgrade prompt", async () => {
        listSchedules.mockResolvedValue(LIST({ planAllowed: true, schedules: [SCHEDULE] }));
        updateSchedule.mockResolvedValue({
            ok: false,
            gone: false,
            error: "Too many.",
            planRequired: false,
        });
        render(<SchedulesSection teamId="t1" />);
        const r = await screen.findByTestId("schedule-row");
        await userEvent.click(within(r).getByRole("switch", { name: /pause morning plan/i }));
        expect((await screen.findByRole("alert")).textContent).toContain("Too many.");
        expect(screen.queryByTestId("schedules-upgrade")).toBeNull();
    });
});
