/**
 * MIP-2349: a job that can use AI offers a Mode dropdown, "Scheduled job" (the default) or
 * "Scheduled job by Genos AI", instead of the per-parameter switch. The effort control and its
 * cost estimate exist only in AI mode. A job that is always AI (a skill run) or never AI (What you
 * did) has no Mode control.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SchedulesSection } from "../components/layout/schedules/SchedulesSection";
import { HashMentionDataProvider } from "../context/HashMentionDataContext";
import type { EffortCost, ScheduleJob } from "../services/schedules";
import { chooseMode, modeBox, queryModeBox } from "./helpers/scheduleMode";

vi.setConfig({ testTimeout: 30000 });

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const listSchedules = vi.fn();
const createSchedule = vi.fn();
vi.mock("../services/appNavigate", () => ({ requestAppNavigate: vi.fn() }));
vi.mock("../services/schedules", () => ({
    listSchedules: (...a: unknown[]) => listSchedules(...a),
    createSchedule: (...a: unknown[]) => createSchedule(...a),
    updateSchedule: vi.fn(),
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
    params: { ai_sentences: { type: "boolean", description: "One short AI-written sentence." } },
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
const SKILL_JOB: ScheduleJob = {
    job: "run_skill",
    title: "Run a skill",
    description: "Runs a skill.",
    params: {},
    usesAi: true,
    effortDefault: "medium" as const,
    effortCost: null,
};

beforeEach(() => {
    listSchedules.mockReset();
    createSchedule.mockReset();
    listSchedules.mockResolvedValue({
        timeZone: "Asia/Tokyo",
        limit: 20,
        jobs: [AI_JOB, PLAIN_JOB, SKILL_JOB],
        schedules: [],
        suggestions: [],
        aiAvailable: true,
        aiCreditsOut: false,
    });
});

const openNew = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(
        await screen.findByRole("button", { name: /^(New schedule|Create your first schedule)$/ })
    );
};
const pickJob = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
    await user.click(screen.getByRole("combobox", { name: "Report" }));
    await user.click(await screen.findByRole("option", { name: title }));
};

describe("the Mode dropdown", () => {
    it("offers two options, plain first and by default, with no effort control", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        expect(modeBox().textContent).toBe("Scheduled job");
        expect(screen.queryByTestId("schedule-effort")).toBeNull();
        expect(within(screen.getByTestId("schedule-params")).queryByRole("switch")).toBeNull();
        await user.click(modeBox());
        const options = within(await screen.findByRole("listbox")).getAllByRole("option");
        expect(options.map((o) => o.textContent)).toEqual([
            "Scheduled job",
            "Scheduled job by Genos AI",
        ]);
    });

    it("shows the effort and its cost estimate only in AI mode", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await chooseMode(user, "ai");
        expect(screen.getByTestId("schedule-effort")).toBeTruthy();
        expect(screen.getByText(/credits per run/)).toBeTruthy();
        await chooseMode(user, "plain");
        expect(screen.queryByTestId("schedule-effort")).toBeNull();
        expect(screen.queryByText(/credits per run/)).toBeNull();
    });

    it("saves plain as no AI and AI mode as ai_sentences true", async () => {
        createSchedule.mockResolvedValue({ ok: true, schedule: null });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        expect(createSchedule.mock.calls[0][2].params).toEqual({});
        createSchedule.mockClear();
        await openNew(user);
        await chooseMode(user, "ai");
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        expect(createSchedule.mock.calls[0][2].params).toEqual({ ai_sentences: true });
    });

    it("is not drawn for a job that never uses AI or is always AI", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "What you did");
        expect(queryModeBox()).toBeNull();
        await pickJob(user, "Run a skill");
        expect(queryModeBox()).toBeNull();
    });
});
