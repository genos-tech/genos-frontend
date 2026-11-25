/**
 * MIP-2402: "One time only" offers a sub-choice, "At a date and time" (today's behaviour, the
 * default) or "Run right away". Right away asks for no date and no time, says where the report
 * goes, says "Run now" on the button, and sends `runNow: true` with nothing about WHEN: the server
 * makes the schedule and runs it in the same request. The report is then announced, not run again.
 *
 * Pinned: the pure form rules (what is sent, what is validated); the sub-choice only for a NEW
 * one-time schedule; the fields and the hint; one create call and NO second run; the failure of the
 * run shown in the form, which stays open with what the member typed.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SchedulesSection } from "../components/layout/schedules/SchedulesSection";
import {
    buildCreate,
    emptyForm,
    runsRightAway,
    validateForm,
} from "../features/schedules/scheduleForm";
import { en } from "../i18n/locales/en";
import type { ScheduleJob } from "../services/schedules";

vi.setConfig({ testTimeout: 30000 });

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const listSchedules = vi.fn();
const createSchedule = vi.fn();
const runScheduleNow = vi.fn();
vi.mock("../services/schedules", () => ({
    listSchedules: (...a: unknown[]) => listSchedules(...a),
    createSchedule: (...a: unknown[]) => createSchedule(...a),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    runScheduleNow: (...a: unknown[]) => runScheduleNow(...a),
}));
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("../components/ui/feedback/toastStore", () => ({
    toast: {
        success: (...a: unknown[]) => toastSuccess(...a),
        error: (...a: unknown[]) => toastError(...a),
        warning: vi.fn(),
    },
}));
const requestInboxResync = vi.fn(async () => undefined);
vi.mock("../features/inbox/inboxResyncEvent", () => ({
    requestInboxResync: (...a: unknown[]) => requestInboxResync(...(a as [])),
}));
vi.mock("../services/appNavigate", () => ({ requestAppNavigate: vi.fn() }));

const s = en.settings.schedules;

const JOB: ScheduleJob = {
    job: "what_you_did",
    title: "What you did",
    description: "A recap of your day.",
    params: {},
    usesAi: false,
    effortDefault: null,
    effortCost: null,
};

const SAVED_ONCE = {
    id: "s9",
    name: "Old one",
    job: "what_you_did",
    jobTitle: "What you did",
    params: {},
    when: "once on 2026-12-24 at 09:00",
    frequency: "once" as const,
    timeOfDay: "09:00",
    runDate: "2026-12-24",
    enabled: true,
    deliverPush: true,
    nextRun: "2026-12-24T09:00:00+09:00",
    lastRun: null,
    lastStatus: null,
    lastError: null,
    lastResult: null,
    deliverChannelId: null,
    deliverChannel: null,
};

const LIST = (schedules: unknown[] = []) => ({
    timeZone: "Asia/Tokyo",
    limit: 20,
    jobs: [JOB],
    schedules,
    suggestions: [],
    chatTargets: [],
    aiAvailable: true,
    aiCreditsOut: false,
});

const render = (ui: React.ReactElement) => rtlRender(<CssVarsProvider>{ui}</CssVarsProvider>);

beforeEach(() => {
    for (const fn of [
        listSchedules,
        createSchedule,
        runScheduleNow,
        toastSuccess,
        toastError,
        requestInboxResync,
    ])
        fn.mockClear();
    listSchedules.mockResolvedValue(LIST());
});

const openNewOnce = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(
        await screen.findByRole("button", { name: /^(New schedule|Create your first schedule)$/ })
    );
    await user.click(screen.getByRole("combobox", { name: "Repeat" }));
    await user.click(await screen.findByRole("option", { name: s.frequencyOnce }));
};
const chooseRightAway = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole("radio", { name: s.onceRightAway }));

describe("the form rules (pure)", () => {
    const base = () => ({ ...emptyForm([JOB]), name: "Now", frequency: "once" as const });

    it("sends runNow and nothing about when", () => {
        const body = buildCreate({ ...base(), runRightAway: true }, JOB);
        expect(body).toEqual({
            name: "Now",
            job: "what_you_did",
            params: {},
            deliverPush: true,
            frequency: "once",
            runNow: true,
        });
        expect(body).not.toHaveProperty("timeOfDay");
        expect(body).not.toHaveProperty("runDate");
    });

    it("asks for no date and no time, but still for a name", () => {
        const form = { ...base(), runRightAway: true, runDate: "", timeOfDay: "nonsense" };
        expect(validateForm(form, JOB)).toEqual({ params: {} });
        expect(validateForm({ ...form, name: " " }, JOB).name).toBe("required");
    });

    it("keeps today's rules for a date and a time", () => {
        const form = { ...base(), runRightAway: false, runDate: "", timeOfDay: "" };
        expect(validateForm(form, JOB).runDate).toBe("required");
        expect(validateForm(form, JOB).timeOfDay).toBe("required");
        expect(buildCreate({ ...form, runDate: "2026-12-24", timeOfDay: "9:30" }, JOB)).toEqual(
            expect.objectContaining({ runDate: "2026-12-24", timeOfDay: "09:30" })
        );
        expect(buildCreate({ ...form, runDate: "2026-12-24" }, JOB)).not.toHaveProperty("runNow");
    });

    it("means nothing for another frequency, even if the choice was left on", () => {
        const daily = { ...base(), frequency: "daily" as const, runRightAway: true };
        expect(runsRightAway(daily)).toBe(false);
        expect(buildCreate(daily, JOB)).toEqual(
            expect.objectContaining({ frequency: "daily", timeOfDay: "09:00" })
        );
        expect(buildCreate(daily, JOB)).not.toHaveProperty("runNow");
    });
});

describe("the one-time sub-choice", () => {
    it("is not there for another frequency, and offers At a date and time first", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click(
            await screen.findByRole("button", { name: "Create your first schedule" })
        );
        expect(screen.queryByTestId("schedule-once-when")).toBeNull();
        await user.click(screen.getByRole("combobox", { name: "Repeat" }));
        await user.click(await screen.findByRole("option", { name: s.frequencyOnce }));
        const group = screen.getByTestId("schedule-once-when");
        const radios = within(group).getAllByRole("radio");
        expect(radios.map((r) => r.getAttribute("value"))).toEqual(["at", "now"]);
        expect(screen.getByRole("radio", { name: s.onceAtTime })).toBeChecked();
        expect(screen.getByLabelText("Time (24-hour)")).toBeTruthy();
        expect(screen.getByRole("button", { name: s.create })).toBeTruthy();
    });

    it("Run right away hides the date and time, says where the report goes, and says Run now", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNewOnce(user);
        await chooseRightAway(user);
        expect(screen.queryByLabelText("Time (24-hour)")).toBeNull();
        expect(screen.queryByText(s.runDate)).toBeNull();
        expect(screen.getByRole("status", { name: "" }).textContent).toBe(s.runRightAwayHintInbox);
        expect(screen.getByRole("button", { name: s.runNow })).toBeTruthy();
        expect(screen.queryByRole("button", { name: s.create })).toBeNull();
        // And back: the date and time return, the button reads Create schedule again.
        await user.click(screen.getByRole("radio", { name: s.onceAtTime }));
        expect(screen.getByLabelText("Time (24-hour)")).toBeTruthy();
        expect(screen.getByRole("button", { name: s.create })).toBeTruthy();
    });

    it("is not offered when editing a saved one-time schedule", async () => {
        listSchedules.mockResolvedValue(LIST([SAVED_ONCE]));
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click(await screen.findByRole("button", { name: /Edit/ }));
        expect(await screen.findByTestId("schedule-form")).toBeTruthy();
        expect(screen.queryByTestId("schedule-once-when")).toBeNull();
        expect(screen.getByLabelText("Time (24-hour)")).toBeTruthy();
    });
});

describe("pressing Run now", () => {
    it("creates once with runNow, does not run it a second time, and announces the report", async () => {
        createSchedule.mockResolvedValue({
            ok: true,
            schedule: { ...SAVED_ONCE, id: "new1", lastRun: "2026-11-25T07:00:00+09:00" },
            outcome: { status: "ok", error: "", title: "Your day", items: 2 },
        });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNewOnce(user);
        await chooseRightAway(user);
        await user.click(screen.getByRole("button", { name: s.runNow }));

        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        expect(createSchedule).toHaveBeenCalledWith("tok", "t1", {
            name: "What you did",
            job: "what_you_did",
            params: {},
            deliverPush: true,
            frequency: "once",
            runNow: true,
        });
        // The create ran it: announced, never run again.
        await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
        expect(toastSuccess.mock.calls[0][0]).toContain("Your day");
        expect(requestInboxResync).toHaveBeenCalledWith("schedule-run");
        expect(runScheduleNow).not.toHaveBeenCalled();
        // The form closes and the list is read again.
        await waitFor(() => expect(listSchedules).toHaveBeenCalledTimes(2));
        expect(screen.queryByTestId("schedule-form")).toBeNull();
    });

    it("keeps the form open with the reason when the run failed, and announces nothing", async () => {
        createSchedule.mockResolvedValue({
            ok: false,
            gone: false,
            error: "RuntimeError",
            planRequired: false,
            limitReached: false,
        });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNewOnce(user);
        await chooseRightAway(user);
        await user.click(screen.getByRole("button", { name: s.runNow }));

        expect((await screen.findByRole("alert")).textContent).toBe("RuntimeError");
        expect(screen.getByTestId("schedule-form")).toBeTruthy();
        // What was typed is still there, and the choice stays on Run right away.
        expect(screen.getByRole("radio", { name: s.onceRightAway })).toBeChecked();
        expect(screen.getByRole("button", { name: s.runNow })).toBeTruthy();
        expect(toastSuccess).not.toHaveBeenCalled();
        expect(runScheduleNow).not.toHaveBeenCalled();
    });

    it("a date-and-time create is unchanged: no runNow, no announcement", async () => {
        createSchedule.mockResolvedValue({ ok: true, schedule: SAVED_ONCE });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNewOnce(user);
        const date = screen.getByLabelText(s.runDate);
        await user.type(date, "2026-12-24");
        await user.click(screen.getByRole("button", { name: s.create }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        const sent = createSchedule.mock.calls[0][2];
        expect(sent).toEqual(
            expect.objectContaining({
                frequency: "once",
                runDate: "2026-12-24",
                timeOfDay: "09:00",
            })
        );
        expect(sent).not.toHaveProperty("runNow");
        expect(toastSuccess).not.toHaveBeenCalled();
    });
});
