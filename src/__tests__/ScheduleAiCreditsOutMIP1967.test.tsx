/**
 * MIP-1967: when the member has no AI credits left (`aiCreditsOut: true`, genos-api) the Schedules
 * form still draws the AI sentences switch, but off and disabled, says why, and offers Buy credits
 * and Upgrade plan. The effort control is not drawn. A server that predates the key, or says
 * false, draws the switch as before.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SchedulesSection } from "../components/layout/schedules/SchedulesSection";
import { HashMentionDataProvider } from "../context/HashMentionDataContext";
import { requestAppNavigate } from "../services/appNavigate";
import type { EffortCost, ScheduleJob } from "../services/schedules";

vi.setConfig({ testTimeout: 30000 });

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const listSchedules = vi.fn();
const createSchedule = vi.fn();
const updateSchedule = vi.fn();
vi.mock("../services/appNavigate", () => ({ requestAppNavigate: vi.fn() }));
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

const LIST = (aiCreditsOut: boolean | undefined, schedules: unknown[] = []) => ({
    timeZone: "Asia/Tokyo",
    limit: 20,
    jobs: [AI_JOB, PLAIN_JOB],
    schedules,
    suggestions: [],
    aiAvailable: true,
    ...(aiCreditsOut === undefined ? {} : { aiCreditsOut }),
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

describe("when the member has no AI credits", () => {
    it("shows the AI switch off and disabled, with the reason and the buy / upgrade actions", async () => {
        listSchedules.mockResolvedValue(LIST(true));
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "What to do today");
        const params = screen.getByTestId("schedule-params");
        const sw = within(params).getByRole("switch", {
            name: "AI sentences",
        }) as HTMLInputElement;
        expect(sw.disabled).toBe(true);
        expect(sw.checked).toBe(false);
        expect(within(params).getByText(/used all your AI credits/i)).toBeTruthy();
        expect(screen.queryByTestId("schedule-effort")).toBeNull();
        await user.click(within(params).getByRole("button", { name: "Buy credits" }));
        expect(requestAppNavigate).toHaveBeenCalledWith("/workspace/plans#credit-packs");
        await user.click(within(params).getByRole("button", { name: "Upgrade plan" }));
        expect(requestAppNavigate).toHaveBeenCalledWith("/workspace/plans");
    });
});

describe("when the member has credits, or the server does not say", () => {
    it.each([false, undefined])("draws the switch as usable (aiCreditsOut=%s)", async (flag) => {
        listSchedules.mockResolvedValue(LIST(flag));
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "What to do today");
        const params = screen.getByTestId("schedule-params");
        const sw = within(params).getByRole("switch", {
            name: "AI sentences",
        }) as HTMLInputElement;
        expect(sw.disabled).toBe(false);
        expect(within(params).queryByRole("button", { name: "Buy credits" })).toBeNull();
        // AI sentences are an opt-in (MIP-1969): the effort control shows once the switch is on.
        await user.click(sw);
        expect(screen.getByTestId("schedule-effort")).toBeTruthy();
    });
});
