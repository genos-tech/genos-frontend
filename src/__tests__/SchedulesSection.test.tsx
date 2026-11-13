import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const render = (ui: React.ReactElement) => rtlRender(<CssVarsProvider>{ui}</CssVarsProvider>);

const JOBS = [
    {
        job: "what_you_did",
        title: "What you did",
        description: "A recap of your day.",
        params: { day: { type: "string", enum: ["today", "yesterday"] } },
    },
    {
        job: "what_to_do_today",
        title: "What to do today",
        description: "Your plan.",
        params: { changed_hours: { type: "integer", minimum: 1, maximum: 168 } },
    },
];

const SCHEDULE = {
    id: "s1",
    name: "Morning plan",
    job: "what_to_do_today",
    jobTitle: "What to do today",
    params: { changed_hours: 24 },
    when: "every Monday and Wednesday at 09:00",
    frequency: "weekly" as const,
    timeOfDay: "09:00",
    weekdays: [0, 2],
    enabled: true,
    deliverPush: false,
    nextRun: "2026-11-09T09:00:00+09:00",
    lastRun: "2026-11-04T09:00:02+09:00",
    lastStatus: "ok" as const,
    lastResult: { title: "What to do today", items: 3 },
};

const LIST = (schedules: unknown[] = [SCHEDULE], over: object = {}) => ({
    timeZone: "Asia/Tokyo",
    limit: 20,
    jobs: JOBS,
    schedules,
    ...over,
});

beforeEach(() => {
    for (const fn of [
        listSchedules,
        createSchedule,
        updateSchedule,
        deleteSchedule,
        runScheduleNow,
    ]) {
        fn.mockReset();
    }
    listSchedules.mockResolvedValue(LIST());
});

const row = async () => screen.findByTestId("schedule-row");

describe("SchedulesSection list", () => {
    it("asks for the current team's schedules", async () => {
        render(<SchedulesSection teamId="team-9" />);
        await row();
        expect(listSchedules).toHaveBeenCalledWith("tok", "team-9");
    });

    it("says what the page is, and shows each schedule in full", async () => {
        render(<SchedulesSection teamId="t1" />);
        const r = await row();
        expect(
            screen.getByText(
                "Genos prepares a report for you at the times you choose; it arrives in your Inbox."
            )
        ).toBeTruthy();
        expect(within(r).getByText("Morning plan")).toBeTruthy();
        expect(within(r).getByText("What to do today")).toBeTruthy();
        expect(within(r).getByText("every Monday and Wednesday at 09:00")).toBeTruthy();
        expect(within(r).getByText(/Next run: /)).toBeTruthy();
        expect(within(r).getByText(/Last run: /)).toBeTruthy();
        expect(within(r).getByText("Ran")).toBeTruthy();
        expect(within(r).getByText("What to do today, 3 items")).toBeTruthy();
    });

    it("shows the last error of a failed run, and a removed job as a warning", async () => {
        listSchedules.mockResolvedValue(
            LIST([
                {
                    ...SCHEDULE,
                    jobTitle: null,
                    lastStatus: "failed",
                    lastError: "The job failed (ValueError).",
                    lastResult: undefined,
                    problem: "This report was removed. Pick another one.",
                },
            ])
        );
        render(<SchedulesSection teamId="t1" />);
        const r = await row();
        expect(within(r).getByText("Failed")).toBeTruthy();
        expect(within(r).getByText("The job failed (ValueError).")).toBeTruthy();
        expect(within(r).getByText("This report is no longer available")).toBeTruthy();
        expect(within(r).getByText("This report was removed. Pick another one.")).toBeTruthy();
    });

    it("shows why a schedule is paused", async () => {
        listSchedules.mockResolvedValue(
            LIST([
                {
                    ...SCHEDULE,
                    enabled: false,
                    pausedReason: "Paused after three failed runs.",
                    nextRun: null,
                },
            ])
        );
        render(<SchedulesSection teamId="t1" />);
        const r = await row();
        expect(within(r).getAllByText("Paused").length).toBeGreaterThan(0);
        expect(within(r).getByText("Paused after three failed runs.")).toBeTruthy();
        expect(within(r).getByText("No run is planned")).toBeTruthy();
    });
});

describe("empty, loading and error states", () => {
    it("says so and offers the first schedule when there are none", async () => {
        listSchedules.mockResolvedValue(LIST([]));
        render(<SchedulesSection teamId="t1" />);
        expect(await screen.findByText("You have no schedules yet.")).toBeTruthy();
        await userEvent
            .setup()
            .click(screen.getByRole("button", { name: "Create your first schedule" }));
        expect(screen.getByTestId("schedule-form")).toBeTruthy();
    });

    it("shows loading first", async () => {
        listSchedules.mockReturnValue(new Promise(() => {}));
        render(<SchedulesSection teamId="t1" />);
        expect(await screen.findByText("Loading your schedules…")).toBeTruthy();
    });

    it("says so when the list cannot be loaded, and retries", async () => {
        listSchedules.mockResolvedValueOnce(null);
        render(<SchedulesSection teamId="t1" />);
        expect(await screen.findByText("Couldn't load your schedules.")).toBeTruthy();
        await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
        await row();
        expect(listSchedules).toHaveBeenCalledTimes(2);
    });

    it("disables New schedule at the limit, with a sentence", async () => {
        listSchedules.mockResolvedValue(LIST([SCHEDULE], { limit: 1 }));
        render(<SchedulesSection teamId="t1" />);
        await row();
        const button = screen.getByRole("button", { name: "New schedule" });
        expect(button.hasAttribute("disabled")).toBe(true);
        expect(screen.getByText(/limit of 1 schedules/)).toBeTruthy();
    });

    it("refetches for another team and ignores a late answer for the old one", async () => {
        let resolveOld: (v: unknown) => void = () => {};
        listSchedules.mockImplementationOnce(() => new Promise((r) => (resolveOld = r)));
        const { rerender } = render(<SchedulesSection teamId="old" />);
        listSchedules.mockResolvedValueOnce(LIST([{ ...SCHEDULE, id: "s2", name: "New team's" }]));
        rerender(
            <CssVarsProvider>
                <SchedulesSection teamId="new" />
            </CssVarsProvider>
        );
        await screen.findByText("New team's");
        resolveOld(LIST([{ ...SCHEDULE, id: "s3", name: "Old team's" }]));
        await new Promise((r) => setTimeout(r, 10));
        expect(screen.queryByText("Old team's")).toBeNull();
        expect(screen.getByText("New team's")).toBeTruthy();
    });
});

describe("row actions", () => {
    it("pausing sends PATCH enabled:false, then refetches", async () => {
        updateSchedule.mockResolvedValue({ ok: true, schedule: SCHEDULE });
        render(<SchedulesSection teamId="t1" />);
        await row();
        const user = userEvent.setup();
        await user.click(screen.getByRole("switch", { name: "Pause Morning plan" }));
        await waitFor(() =>
            expect(updateSchedule).toHaveBeenCalledWith("tok", "t1", "s1", { enabled: false })
        );
        await waitFor(() => expect(listSchedules).toHaveBeenCalledTimes(2));
    });

    it("resuming a paused schedule sends enabled:true", async () => {
        listSchedules.mockResolvedValue(LIST([{ ...SCHEDULE, enabled: false }]));
        updateSchedule.mockResolvedValue({ ok: true, schedule: SCHEDULE });
        render(<SchedulesSection teamId="t1" />);
        await row();
        await userEvent.setup().click(screen.getByRole("switch", { name: "Resume Morning plan" }));
        await waitFor(() =>
            expect(updateSchedule).toHaveBeenCalledWith("tok", "t1", "s1", { enabled: true })
        );
    });

    it("Run now shows the outcome inline and keeps it through the refetch", async () => {
        runScheduleNow.mockResolvedValue({
            ok: true,
            outcome: { status: "ok", error: "", title: "What to do today", items: 3 },
        });
        render(<SchedulesSection teamId="t1" />);
        await row();
        await userEvent.setup().click(screen.getByRole("button", { name: "Run now" }));
        const notice = await screen.findByTestId("run-notice");
        expect(notice.textContent).toBe(
            "Ran: What to do today, 3 items. The report is in your Inbox."
        );
        await waitFor(() => expect(listSchedules).toHaveBeenCalledTimes(2));
        expect(screen.getByTestId("run-notice")).toBeTruthy();
        expect(runScheduleNow).toHaveBeenCalledWith("tok", "t1", "s1");
    });

    it("Run now shows a failed run's reason", async () => {
        runScheduleNow.mockResolvedValue({
            ok: true,
            outcome: { status: "failed", error: "The job failed.", title: "", items: 0 },
        });
        render(<SchedulesSection teamId="t1" />);
        await row();
        await userEvent.setup().click(screen.getByRole("button", { name: "Run now" }));
        expect((await screen.findByTestId("run-notice")).textContent).toBe(
            "The run failed: The job failed."
        );
    });

    it("Run now shows the one-a-minute refusal sentence as it came", async () => {
        runScheduleNow.mockResolvedValue({
            ok: false,
            gone: false,
            error: "This schedule ran a moment ago. Try again in 42 seconds.",
        });
        render(<SchedulesSection teamId="t1" />);
        await row();
        await userEvent.setup().click(screen.getByRole("button", { name: "Run now" }));
        expect((await screen.findByTestId("run-notice")).textContent).toBe(
            "This schedule ran a moment ago. Try again in 42 seconds."
        );
    });

    it("delete asks first, in the page, and calls the API only on yes", async () => {
        deleteSchedule.mockResolvedValue({ ok: true });
        const confirm = vi.spyOn(window, "confirm");
        render(<SchedulesSection teamId="t1" />);
        await row();
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Delete" }));
        expect(screen.getByText(/Delete Morning plan\?/)).toBeTruthy();
        expect(deleteSchedule).not.toHaveBeenCalled();
        listSchedules.mockResolvedValue(LIST([]));
        await user.click(screen.getByRole("button", { name: "Delete" }));
        await waitFor(() => expect(deleteSchedule).toHaveBeenCalledWith("tok", "t1", "s1"));
        await waitFor(() => expect(screen.queryByTestId("schedule-row")).toBeNull());
        expect(confirm).not.toHaveBeenCalled();
        confirm.mockRestore();
    });

    it("cancelling the confirm deletes nothing", async () => {
        render(<SchedulesSection teamId="t1" />);
        await row();
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Delete" }));
        await user.click(screen.getByRole("button", { name: "Cancel" }));
        expect(deleteSchedule).not.toHaveBeenCalled();
        expect(screen.getByTestId("schedule-row")).toBeTruthy();
    });

    it("keeps the row and says so when delete fails", async () => {
        deleteSchedule.mockResolvedValue({ ok: false, gone: false, error: null });
        render(<SchedulesSection teamId="t1" />);
        await row();
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Delete" }));
        await user.click(screen.getByRole("button", { name: "Delete" }));
        expect(await screen.findByText("Couldn't delete that schedule. Try again.")).toBeTruthy();
        expect(screen.getByTestId("schedule-row")).toBeTruthy();
    });
});

describe("create and edit form", () => {
    it("builds the job's parameter inputs from the catalog, and only those", async () => {
        listSchedules.mockResolvedValue(LIST([]));
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click(
            await screen.findByRole("button", { name: "Create your first schedule" })
        );
        const params = screen.getByTestId("schedule-params");
        // first job: what_you_did -> an enum select, no number input
        expect(within(params).getByText("Day")).toBeTruthy();
        expect(within(params).queryByText("Changed hours")).toBeNull();
        expect(within(params).queryByRole("spinbutton")).toBeNull();
        expect(screen.getByText("A recap of your day.")).toBeTruthy();
        expect(screen.getByText("Your time zone: Asia/Tokyo")).toBeTruthy();
    });

    it(
        "creates with the team, the declared params and the chosen recurrence",
        { timeout: 30000 },
        async () => {
            listSchedules.mockResolvedValue(LIST([]));
            createSchedule.mockResolvedValue({ ok: true, schedule: SCHEDULE });
            render(<SchedulesSection teamId="t1" />);
            const user = userEvent.setup();
            await user.click(
                await screen.findByRole("button", { name: "Create your first schedule" })
            );

            await user.click(screen.getByRole("combobox", { name: "Report" }));
            await user.click(await screen.findByRole("option", { name: "What to do today" }));
            const hours = await screen.findByRole("spinbutton");
            await user.type(hours, "48");
            await user.click(screen.getByRole("combobox", { name: "Repeat" }));
            await user.click(
                await screen.findByRole("option", { name: /Days of the week|On days of the week/ })
            );
            await user.click(screen.getByRole("button", { name: "Monday" }));
            await user.click(screen.getByRole("button", { name: "Wednesday" }));
            const time = screen.getByLabelText("Time (24-hour)");
            await user.clear(time);
            await user.type(time, "07:30");
            // Push is on for a new schedule (MIP-1374): nothing to click.
            expect(screen.getByRole("switch")).toBeChecked();
            await user.click(screen.getByRole("button", { name: "Create schedule" }));

            await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
            expect(createSchedule).toHaveBeenCalledWith("tok", "t1", {
                name: "What to do today",
                job: "what_to_do_today",
                params: { changed_hours: 48 },
                frequency: "weekly",
                weekdays: [0, 2],
                timeOfDay: "07:30",
                deliverPush: true,
            });
            // closes and refetches
            await waitFor(() => expect(listSchedules).toHaveBeenCalledTimes(2));
        }
    );

    it("does not send an invalid form, and says what is wrong", async () => {
        listSchedules.mockResolvedValue(LIST([]));
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click(
            await screen.findByRole("button", { name: "Create your first schedule" })
        );
        const time = screen.getByLabelText("Time (24-hour)");
        await user.clear(time);
        await user.type(time, "25:00");
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        expect(await screen.findByText("Use 24-hour time like 09:00.")).toBeTruthy();
        expect(createSchedule).not.toHaveBeenCalled();
    });

    it("moves focus to the first wrong field when a submit is refused", async () => {
        listSchedules.mockResolvedValue(LIST([]));
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click(
            await screen.findByRole("button", { name: "Create your first schedule" })
        );
        const time = screen.getByLabelText("Time (24-hour)");
        await user.clear(time);
        await user.type(time, "99:99");
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        await waitFor(() => expect(document.activeElement).toBe(time));
    });

    it("shows the API's sentence when it refuses a create", async () => {
        listSchedules.mockResolvedValue(LIST([]));
        createSchedule.mockResolvedValue({
            ok: false,
            gone: false,
            error: "You can have at most 20 schedules.",
        });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click(
            await screen.findByRole("button", { name: "Create your first schedule" })
        );
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        expect(await screen.findByText("You can have at most 20 schedules.")).toBeTruthy();
        expect(screen.getByTestId("schedule-form")).toBeTruthy();
    });

    it("an edit sends only what changed", async () => {
        updateSchedule.mockResolvedValue({ ok: true, schedule: SCHEDULE });
        render(<SchedulesSection teamId="t1" />);
        await row();
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Edit" }));
        const name = screen.getByLabelText("Name");
        await user.clear(name);
        await user.type(name, "Renamed");
        await user.click(screen.getByRole("button", { name: "Save changes" }));
        await waitFor(() =>
            expect(updateSchedule).toHaveBeenCalledWith("tok", "t1", "s1", { name: "Renamed" })
        );
    });

    it("saving an edit with no change calls nothing", async () => {
        render(<SchedulesSection teamId="t1" />);
        await row();
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Edit" }));
        await user.click(screen.getByRole("button", { name: "Save changes" }));
        await waitFor(() => expect(screen.queryByTestId("schedule-form")).toBeNull());
        expect(updateSchedule).not.toHaveBeenCalled();
    });
});
