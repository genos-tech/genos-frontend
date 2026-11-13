/**
 * MIP-1309: while AI reports cannot run on the deployment (`aiAvailable: false`, genos-api), the
 * Schedules form offers no AI switch, no effort and no estimate, and a list row shows no effort
 * line: they would do nothing. Saved values are never touched by that. A server that predates the
 * key reads as available, as before. jsdom draws no layout, so this is about what is offered.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SchedulesSection } from "../components/layout/schedules/SchedulesSection";
import { HashMentionDataProvider } from "../context/HashMentionDataContext";
import { withoutAi } from "../features/schedules/scheduleEffort";
import type { EffortCost, ScheduleJob } from "../services/schedules";

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

const COST: EffortCost = {
    estimate: true,
    basis: "a report listing 10 tasks with comments, nothing cached",
    levels: {
        low: { model: "m", creditsMilli: [15, 23], usdMicro: [1526, 2264] },
        medium: { model: "m", creditsMilli: [62, 93], usdMicro: [6242, 9286] },
        high: { model: "m", creditsMilli: [89, 193], usdMicro: [8878, 19340] },
    },
};

const AI_JOB: ScheduleJob = {
    job: "what_to_do_today",
    title: "What to do today",
    description: "Your plan.",
    params: {
        changed_hours: { type: "integer", minimum: 1, maximum: 168 },
        ai_sentences: { type: "boolean", description: "One short AI-written sentence." },
    },
    usesAi: true,
    effortDefault: "low" as const,
    effortCost: COST,
};
const PLAIN_JOB: ScheduleJob = {
    job: "what_you_did",
    title: "What you did",
    description: "A recap of your day.",
    params: { day: { type: "string", enum: ["today", "yesterday"] } },
    usesAi: false,
    effortDefault: null,
    effortCost: null,
};

const AI_SCHEDULE = {
    id: "s1",
    name: "Morning plan",
    job: "what_to_do_today",
    jobTitle: "What to do today",
    params: {},
    when: "every day at 18:00",
    frequency: "daily" as const,
    timeOfDay: "18:00",
    enabled: true,
    deliverPush: false,
    nextRun: null,
    lastRun: null,
    lastStatus: null,
    aiEffort: null,
    aiEffortEffective: "low",
};

const LIST = (aiAvailable: boolean | undefined, schedules: unknown[] = []) => ({
    timeZone: "Asia/Tokyo",
    limit: 20,
    jobs: [AI_JOB, PLAIN_JOB],
    schedules,
    suggestions: [],
    ...(aiAvailable === undefined ? {} : { aiAvailable }),
});

beforeEach(() => {
    for (const fn of [listSchedules, createSchedule, updateSchedule]) fn.mockReset();
});

const openNew = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(
        await screen.findByRole("button", { name: /^(New schedule|Create your first schedule)$/ })
    );
    return screen.getByTestId("schedule-form");
};
const pickJob = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
    await user.click(screen.getByRole("combobox", { name: "Report" }));
    await user.click(await screen.findByRole("option", { name: title }));
};

describe("withoutAi", () => {
    it("drops the AI flag, the default level, the estimate and the AI switch parameter", () => {
        const job = withoutAi(AI_JOB);
        expect(job.usesAi).toBe(false);
        expect(job.effortDefault).toBeNull();
        expect(job.effortCost).toBeNull();
        expect(Object.keys(job.params)).toEqual(["changed_hours"]);
        expect(job.title).toBe(AI_JOB.title);
    });

    it("returns a job without AI as it is, and does not edit its input", () => {
        expect(withoutAi(PLAIN_JOB)).toBe(PLAIN_JOB);
        withoutAi(AI_JOB);
        expect(AI_JOB.usesAi).toBe(true);
        expect(Object.keys(AI_JOB.params)).toContain("ai_sentences");
    });
});

describe("while AI cannot run here", () => {
    it("offers no AI switch, no effort and no estimate for the AI report", async () => {
        listSchedules.mockResolvedValue(LIST(false));
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "What to do today");
        const form = screen.getByTestId("schedule-form");
        expect(screen.queryByTestId("schedule-effort")).toBeNull();
        expect(within(form).queryByRole("switch", { name: "AI sentences" })).toBeNull();
        expect(within(form).queryByText(/credits/i)).toBeNull();
        // The rest of the job is still there.
        expect(screen.getByTestId("schedule-params")).toBeTruthy();
    });

    it("creates the schedule with no effort and no AI parameter", async () => {
        listSchedules.mockResolvedValue(LIST(false));
        createSchedule.mockResolvedValue({ ok: true, schedule: AI_SCHEDULE });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "What to do today");
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        const body = createSchedule.mock.calls[0][2];
        expect(body).not.toHaveProperty("aiEffort");
        expect(body.params).not.toHaveProperty("ai_sentences");
    });

    it("shows no effort line on the list row of an AI schedule", async () => {
        listSchedules.mockResolvedValue(LIST(false, [AI_SCHEDULE]));
        render(<SchedulesSection teamId="t1" />);
        const rows = await screen.findAllByTestId("schedule-row");
        expect(within(rows[0]).queryByText(/AI effort/)).toBeNull();
    });

    it("editing a saved AI schedule sends only what changed, never its AI values", async () => {
        const saved = { ...AI_SCHEDULE, params: { ai_sentences: false }, aiEffort: "high" };
        listSchedules.mockResolvedValue(LIST(false, [saved]));
        updateSchedule.mockResolvedValue({ ok: true, schedule: saved });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        const rows = await screen.findAllByTestId("schedule-row");
        await user.click(within(rows[0]).getByRole("button", { name: /edit/i }));
        const name = screen.getByLabelText("Name");
        await user.clear(name);
        await user.type(name, "Plan");
        await user.click(screen.getByRole("button", { name: /save/i }));
        await waitFor(() => expect(updateSchedule).toHaveBeenCalledTimes(1));
        const patch = updateSchedule.mock.calls[0][3];
        expect(patch).toEqual({ name: "Plan" });
    });
});

describe("while AI can run, or the server does not say", () => {
    it.each([true, undefined])("draws the controls as before (aiAvailable=%s)", async (flag) => {
        listSchedules.mockResolvedValue(LIST(flag));
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "What to do today");
        expect(screen.getByTestId("schedule-effort")).toBeTruthy();
        expect(
            within(screen.getByTestId("schedule-params")).getByRole("switch", {
                name: "AI sentences",
            })
        ).toBeTruthy();
    });
});
