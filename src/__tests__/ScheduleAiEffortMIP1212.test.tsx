/**
 * MIP-1212: the AI effort control in the schedule form and the quiet line on a list row.
 *
 * The contract is genos-api #680. The wording is the point of several tests: the cost is an
 * ESTIMATE, never a charge, and never a promise that a lower level is cheaper (the API says it is
 * unmeasured, and the server may have the AI step switched off, so the form says "this uses AI"
 * about the option and never "AI is writing your report"). jsdom draws no layout: phone width
 * and both themes were looked at in a browser.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SchedulesSection } from "../components/layout/schedules/SchedulesSection";
import { HashMentionDataProvider } from "../context/HashMentionDataContext";

vi.setConfig({ testTimeout: 30000 });

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const listSchedules = vi.fn();
const createSchedule = vi.fn();
const updateSchedule = vi.fn();
vi.mock("../services/schedules", () => ({
    listSchedules: (...a: unknown[]) => listSchedules(...a),
    createSchedule: (...a: unknown[]) => createSchedule(...a),
    updateSchedule: (...a: unknown[]) => updateSchedule(...a),
    deleteSchedule: vi.fn(),
    runScheduleNow: vi.fn(),
}));
vi.mock("../features/tasks/sprint-milestone/services/loadProjectMilestones", () => ({
    loadProjectMilestones: vi.fn(async () => ({ milestones: [] })),
}));

const render = (ui: React.ReactElement) =>
    rtlRender(
        <CssVarsProvider>
            <HashMentionDataProvider
                value={{
                    tasks: [],
                    teamTasks: [],
                    notes: [],
                    chats: [],
                    allChats: [],
                    projects: [],
                    todoGroups: [],
                    myself: null,
                    refresh: () => {},
                }}
            >
                {ui}
            </HashMentionDataProvider>
        </CssVarsProvider>
    );

const COST = {
    estimate: true,
    basis: "a report listing 10 tasks with comments, nothing cached; each range is [fewest, most]",
    levels: {
        low: { model: "gemini-3.5-flash-lite", creditsMilli: [15, 23], usdMicro: [1526, 2264] },
        medium: { model: "gemini-3.6-flash", creditsMilli: [62, 93], usdMicro: [6242, 9286] },
        high: {
            model: "gemini-3.1-pro-preview",
            creditsMilli: [89, 193],
            usdMicro: [8878, 19340],
        },
    },
};

const JOBS = [
    {
        job: "what_to_do_today",
        title: "What to do today",
        description: "Your plan.",
        params: {
            changed_hours: { type: "integer", minimum: 1, maximum: 168 },
            ai_sentences: {
                type: "boolean",
                description: "One short AI-written sentence under a task. On by default.",
            },
        },
        usesAi: true,
        effortDefault: "low",
        effortCost: COST,
    },
    {
        job: "what_you_did",
        title: "What you did",
        description: "A recap of your day.",
        params: { day: { type: "string", enum: ["today", "yesterday"] } },
        usesAi: false,
        effortDefault: null,
        effortCost: null,
    },
];

const AI_SCHEDULE = {
    id: "s1",
    name: "Morning plan",
    job: "what_to_do_today",
    jobTitle: "What to do today",
    params: {},
    when: "every day at 18:00",
    frequency: "daily" as const,
    // Not the form's default time, or creating one would be a duplicate of this.
    timeOfDay: "18:00",
    enabled: true,
    deliverPush: false,
    nextRun: null,
    lastRun: null,
    lastStatus: null,
    aiEffort: null,
    aiEffortEffective: "low",
};
const PLAIN_SCHEDULE = {
    ...AI_SCHEDULE,
    id: "s2",
    name: "Evening recap",
    job: "what_you_did",
    jobTitle: "What you did",
    aiEffort: undefined,
    aiEffortEffective: undefined,
};

const LIST = (schedules: unknown[]) => ({
    timeZone: "Asia/Tokyo",
    limit: 20,
    jobs: JOBS,
    schedules,
    suggestions: [],
});

beforeEach(() => {
    for (const fn of [listSchedules, createSchedule, updateSchedule]) fn.mockReset();
    listSchedules.mockResolvedValue(LIST([AI_SCHEDULE, PLAIN_SCHEDULE]));
});

const openNew = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole("button", { name: "New schedule" }));
    return screen.getByTestId("schedule-form");
};
const pickJob = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
    await user.click(screen.getByRole("combobox", { name: "Report" }));
    await user.click(await screen.findByRole("option", { name: title }));
};
const effortBox = () => screen.queryByTestId("schedule-effort");
const radios = () =>
    within(screen.getByTestId("schedule-effort")).getAllByRole("radio") as HTMLInputElement[];
const checked = () => radios().find((r) => r.checked)?.labels?.[0]?.textContent;

describe("the control in the form", () => {
    it("is three plain levels, the job's default marked and chosen, in a labelled group", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        // The first job of the catalog is the AI one.
        expect(screen.getByRole("radiogroup", { name: "AI effort" })).toBeTruthy();
        expect(radios().map((r) => r.labels?.[0]?.textContent)).toEqual([
            "Low (default)",
            "Medium",
            "High",
        ]);
        expect(checked()).toBe("Low (default)");
    });

    it("gives the estimate of the chosen level, as an estimate, in credits", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        const box = screen.getByTestId("schedule-effort");
        expect(
            within(box).getByText("About 0.02 credits per run. This is an estimate.")
        ).toBeTruthy();
        await user.click(within(box).getByRole("radio", { name: "Medium" }));
        expect(
            within(box).getByText("About 0.06 to 0.09 credits per run. This is an estimate.")
        ).toBeTruthy();
        await user.click(within(box).getByRole("radio", { name: "High" }));
        expect(
            within(box).getByText("About 0.09 to 0.19 credits per run. This is an estimate.")
        ).toBeTruthy();
    });

    it("never calls an estimate a charge or a saving, and never says AI is running", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        const text = screen.getByTestId("schedule-form").textContent ?? "";
        for (const word of [
            /cheap/i,
            /saving/i,
            /\bsave\b/i,
            /charged/i,
            /is writing/i,
            /deduct/i,
        ]) {
            expect(text).not.toMatch(word);
        }
        // The option is described as what it does; whether the operator has the AI on is not known.
        expect(text).toMatch(/This uses AI\./);
    });

    it("sends the member's level on a create, and none while the job's default is left", async () => {
        createSchedule.mockResolvedValue({ ok: true, schedule: AI_SCHEDULE });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await user.click(
            within(screen.getByTestId("schedule-effort")).getByRole("radio", { name: "High" })
        );
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        expect(createSchedule.mock.calls[0][2]).toMatchObject({
            job: "what_to_do_today",
            aiEffort: "high",
        });
    });

    it("picking the job's own level means no choice, so it keeps following the default", async () => {
        createSchedule.mockResolvedValue({ ok: true, schedule: AI_SCHEDULE });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        const box = screen.getByTestId("schedule-effort");
        await user.click(within(box).getByRole("radio", { name: "High" }));
        await user.click(within(box).getByRole("radio", { name: "Low (default)" }));
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        expect(createSchedule.mock.calls[0][2]).not.toHaveProperty("aiEffort");
    });

    it("is not drawn for a job with no AI, and nothing about it is sent", async () => {
        createSchedule.mockResolvedValue({ ok: true, schedule: PLAIN_SCHEDULE });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await user.click(
            within(screen.getByTestId("schedule-effort")).getByRole("radio", { name: "High" })
        );
        await pickJob(user, "What you did");
        expect(effortBox()).toBeNull();
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        expect(createSchedule.mock.calls[0][2]).not.toHaveProperty("aiEffort");
    });

    it("forgets a level chosen for another report when the report changes", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await user.click(
            within(screen.getByTestId("schedule-effort")).getByRole("radio", { name: "High" })
        );
        await pickJob(user, "What you did");
        await pickJob(user, "What to do today");
        expect(checked()).toBe("Low (default)");
    });

    it("is hidden while the AI sentences switch is off, and back when it is on", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        const params = screen.getByTestId("schedule-params");
        const sw = within(params).getByRole("switch", {
            name: "AI sentences",
        }) as HTMLInputElement;
        // On unless turned off: the catalog states no default, the form knows it.
        expect(sw.checked).toBe(true);
        await user.click(sw);
        expect(sw.checked).toBe(false);
        expect(effortBox()).toBeNull();
        await user.click(sw);
        expect(effortBox()).not.toBeNull();
    });
});

describe("the AI sentences switch", () => {
    it("is a switch with our own localized, neutral hint, not the server's English text", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        const params = screen.getByTestId("schedule-params");
        expect(within(params).getByRole("switch", { name: "AI sentences" })).toBeTruthy();
        expect(within(params).queryByRole("textbox", { name: "AI sentences" })).toBeNull();
        expect(
            within(params).getByText(
                "Adds one short sentence under a task when its comments explain where it stands. This uses AI. Turn it off for a plain report."
            )
        ).toBeTruthy();
        expect(within(params).queryByText(/AI-written/)).toBeNull();
    });

    it("sends false (a boolean) when turned off, and nothing while left alone", async () => {
        createSchedule.mockResolvedValue({ ok: true, schedule: AI_SCHEDULE });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        expect(createSchedule.mock.calls[0][2].params).toEqual({});
        createSchedule.mockClear();
        await openNew(user);
        await user.click(
            within(screen.getByTestId("schedule-params")).getByRole("switch", {
                name: "AI sentences",
            })
        );
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        expect(createSchedule.mock.calls[0][2].params).toEqual({ ai_sentences: false });
    });
});

describe("editing a saved schedule", () => {
    const edit = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
        const row = (await screen.findAllByTestId("schedule-row")).find((r) =>
            within(r).queryByText(name)
        )!;
        await user.click(within(row).getByRole("button", { name: /edit/i }));
    };

    it("opens on the saved choice and sends only a change", async () => {
        listSchedules.mockResolvedValue(
            LIST([{ ...AI_SCHEDULE, aiEffort: "medium", aiEffortEffective: "medium" }])
        );
        updateSchedule.mockResolvedValue({ ok: true, schedule: AI_SCHEDULE });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await edit(user, "Morning plan");
        expect(checked()).toBe("Medium");
        await user.click(
            within(screen.getByTestId("schedule-effort")).getByRole("radio", { name: "High" })
        );
        await user.click(screen.getByRole("button", { name: "Save changes" }));
        await waitFor(() => expect(updateSchedule).toHaveBeenCalledTimes(1));
        expect(updateSchedule.mock.calls[0][3]).toEqual({ aiEffort: "high" });
    });

    it("says the plan holds the level, plainly, and shows the estimate of the level that runs", async () => {
        listSchedules.mockResolvedValue(
            LIST([{ ...AI_SCHEDULE, aiEffort: "high", aiEffortEffective: "medium" }])
        );
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await edit(user, "Morning plan");
        const box = screen.getByTestId("schedule-effort");
        expect(checked()).toBe("High");
        expect(within(box).getByTestId("schedule-effort-held").textContent).toBe(
            "Your plan runs this schedule at Medium."
        );
        expect(within(box).getByText(/About 0\.06 to 0\.09 credits/)).toBeTruthy();
        // Once the member changes it, the plan's ceiling for the NEW choice is not known: no note.
        await user.click(within(box).getByRole("radio", { name: "Low (default)" }));
        expect(within(box).queryByTestId("schedule-effort-held")).toBeNull();
    });

    it("shows no note when the plan holds nothing", async () => {
        listSchedules.mockResolvedValue(
            LIST([{ ...AI_SCHEDULE, aiEffort: "high", aiEffortEffective: "high" }])
        );
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await edit(user, "Morning plan");
        expect(screen.queryByTestId("schedule-effort-held")).toBeNull();
    });

    it("sends null to go back to the job's default", async () => {
        listSchedules.mockResolvedValue(
            LIST([{ ...AI_SCHEDULE, aiEffort: "high", aiEffortEffective: "high" }])
        );
        updateSchedule.mockResolvedValue({ ok: true, schedule: AI_SCHEDULE });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await edit(user, "Morning plan");
        await user.click(
            within(screen.getByTestId("schedule-effort")).getByRole("radio", {
                name: "Low (default)",
            })
        );
        await user.click(screen.getByRole("button", { name: "Save changes" }));
        await waitFor(() => expect(updateSchedule).toHaveBeenCalledTimes(1));
        expect(updateSchedule.mock.calls[0][3]).toEqual({ aiEffort: null });
    });
});

describe("the list row", () => {
    it("shows the effective level quietly for an AI schedule, and nothing for a plain one", async () => {
        listSchedules.mockResolvedValue(
            LIST([
                { ...AI_SCHEDULE, aiEffort: "high", aiEffortEffective: "medium" },
                PLAIN_SCHEDULE,
            ])
        );
        render(<SchedulesSection teamId="t1" />);
        const rows = await screen.findAllByTestId("schedule-row");
        expect(within(rows[0]).getByText("AI effort: Medium")).toBeTruthy();
        expect(within(rows[1]).queryByText(/AI effort/)).toBeNull();
    });

    it("shows none once the AI sentences are switched off for that schedule", async () => {
        listSchedules.mockResolvedValue(
            LIST([{ ...AI_SCHEDULE, params: { ai_sentences: false } }])
        );
        render(<SchedulesSection teamId="t1" />);
        const rows = await screen.findAllByTestId("schedule-row");
        expect(within(rows[0]).queryByText(/AI effort/)).toBeNull();
    });
});

describe("a server that predates the effort fields", () => {
    it("draws no control and sends no effort", async () => {
        const OLD_JOBS = JOBS.map((j) => ({
            job: j.job,
            title: j.title,
            description: j.description,
            params: j.params,
        }));
        listSchedules.mockResolvedValue({ ...LIST([]), jobs: OLD_JOBS });
        createSchedule.mockResolvedValue({ ok: true, schedule: PLAIN_SCHEDULE });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click(
            await screen.findByRole("button", { name: "Create your first schedule" })
        );
        expect(effortBox()).toBeNull();
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        expect(createSchedule.mock.calls[0][2]).not.toHaveProperty("aiEffort");
    });
});
