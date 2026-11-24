/**
 * The schedule form's chat hint (MIP-2224): a skill report may now be posted in a chat only the
 * owner is in, with an AI cost line, so it must not say "no AI". Built-in reports keep the old
 * sentence. Same hint line, no new element.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SchedulesSection } from "../components/layout/schedules/SchedulesSection";
import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";
import { settings as enSettings } from "../i18n/locales/en/settings";

vi.setConfig({ testTimeout: 30000 });

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
    useOptionalAccessToken: () => "tok",
}));

const listSchedules = vi.fn();
vi.mock("../services/schedules", () => ({
    listSchedules: (...a: unknown[]) => listSchedules(...a),
    createSchedule: vi.fn(),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    runScheduleNow: vi.fn(),
}));
vi.mock("../features/genos/skills/skillsApi", async (orig) => ({
    ...(await orig<object>()),
    fetchRunnableSkills: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

const mention = (): HashMentionData => ({
    tasks: [],
    notes: [],
    chats: [],
    allChats: [],
    projects: [],
    todoGroups: [],
    myself: null,
    refresh: () => {},
});

const render = (ui: React.ReactElement) =>
    rtlRender(
        <CssVarsProvider>
            <HashMentionDataProvider value={mention()}>{ui}</HashMentionDataProvider>
        </CssVarsProvider>
    );

const JOBS = [
    {
        job: "what_you_did",
        title: "What you did",
        description: "A recap of your day.",
        params: { day: { type: "string", enum: ["today", "yesterday"] } },
    },
    {
        job: "run_skill",
        title: "Run a skill",
        description: "Runs one of your skills on this schedule.",
        usesAi: true,
        effortDefault: "medium",
        effortCost: null,
        params: { skill_id: { type: "string", required: true }, input: { type: "string" } },
    },
];

beforeEach(() => {
    listSchedules.mockReset();
    listSchedules.mockResolvedValue({
        timeZone: "Asia/Tokyo",
        limit: 20,
        jobs: JOBS,
        schedules: [],
        suggestions: [],
        chatTargets: [{ id: "c-solo", title: "Just me", kind: "group", projectId: null }],
    });
});

const chooseJob = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
    await user.click(screen.getByRole("combobox", { name: "Report" }));
    await user.click(await screen.findByRole("option", { name: title }));
};

const chooseChat = async (user: ReturnType<typeof userEvent.setup>) => {
    const box = within(screen.getByTestId("schedule-deliver"));
    await user.click(box.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Just me" }));
};

describe("the chat hint", () => {
    it("says the skill report uses AI, and the built-in report keeps the old sentence", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click(
            await screen.findByRole("button", { name: /^(New schedule|Create your first)/ })
        );

        await chooseJob(user, "What you did");
        await chooseChat(user);
        expect(screen.getByText(enSettings.schedules.deliverChatHint)).toBeTruthy();
        expect(screen.queryByText(enSettings.schedules.deliverChatHintAi)).toBeNull();

        await chooseJob(user, "Run a skill");
        await waitFor(() =>
            expect(screen.getByText(enSettings.schedules.deliverChatHintAi)).toBeTruthy()
        );
        expect(screen.queryByText(enSettings.schedules.deliverChatHint)).toBeNull();
        expect(enSettings.schedules.deliverChatHintAi).not.toMatch(/no AI/i);
    });
});
