/**
 * A schedule runs a skill (MIP-2045): the skill is a choice in the EXISTING schedule editor.
 *
 * What is pinned:
 *   - the "Run a skill" job draws a skill picker (the `/` menu's own list, by name) and a free
 *     input; no other job asks for the skills list at all;
 *   - a skill that was never published is listed but cannot be chosen, with the reason;
 *   - the version the server pinned (`version_no`) is carried untouched and never drawn: renaming
 *     the schedule sends only the name, and picking another skill drops the old version;
 *   - a stored skill that is no longer in the list reads "(unavailable)"; saving without a skill
 *     says so.
 *
 * jsdom draws no layout: how it looks at phone width was checked in a browser.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SchedulesSection } from "../components/layout/schedules/SchedulesSection";
import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";

vi.setConfig({ testTimeout: 30000 });

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
    useOptionalAccessToken: () => "tok",
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

const fetchRunnableSkills = vi.fn();
vi.mock("../features/genos/skills/skillsApi", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/genos/skills/skillsApi")>()),
    fetchRunnableSkills: (...a: unknown[]) => fetchRunnableSkills(...a),
}));

const mention = (): HashMentionData => ({
    tasks: [],
    notes: [],
    chats: [],
    allChats: [],
    projects: [],
    todoGroups: [],
    myself: { teamId: "t1" } as never,
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
        params: {
            skill_id: { type: "string", required: true },
            version_no: { type: "integer", minimum: 1 },
            input: { type: "string" },
        },
    },
];

const SKILLS = [
    {
        id: "k1",
        slug: "weekly-review",
        title: "Weekly review",
        description: "",
        group: "mine",
        ownerName: "",
        publishedVersionNo: 2,
    },
    {
        id: "k2",
        slug: "draft-only",
        title: "Draft only",
        description: "",
        group: "mine",
        ownerName: "",
        publishedVersionNo: 0,
    },
    {
        id: "k3",
        slug: "triage",
        title: "Triage",
        description: "",
        group: "team",
        ownerName: "aiko",
        publishedVersionNo: 1,
    },
];

const SKILL_SCHEDULE = {
    id: "s1",
    name: "Monday review",
    job: "run_skill",
    jobTitle: "Run a skill",
    params: { skill_id: "k1", version_no: 2, input: "for Q3" },
    when: "every day at 08:30",
    frequency: "daily" as const,
    timeOfDay: "08:30",
    enabled: true,
    deliverPush: false,
    nextRun: null,
    lastRun: null,
    lastStatus: null,
};

const LIST = (schedules: unknown[] = [], over: object = {}) => ({
    timeZone: "Asia/Tokyo",
    limit: 20,
    jobs: JOBS,
    schedules,
    suggestions: [],
    ...over,
});

beforeEach(() => {
    for (const fn of [listSchedules, createSchedule, updateSchedule, fetchRunnableSkills]) {
        fn.mockReset();
    }
    listSchedules.mockResolvedValue(LIST());
    fetchRunnableSkills.mockResolvedValue({ ok: true, data: SKILLS });
});

const openNew = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(
        await screen.findByRole("button", { name: /New schedule|Create your first schedule/ })
    );
    return screen.getByTestId("schedule-form");
};

const pickJob = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
    await user.click(screen.getByRole("combobox", { name: "Report" }));
    await user.click(await screen.findByRole("option", { name: title }));
};

describe("the skill choice in the schedule editor", () => {
    it("draws a skill picker and an input for Run a skill, and asks for the skills only then", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "What you did");
        expect(fetchRunnableSkills).not.toHaveBeenCalled();
        expect(screen.queryByRole("combobox", { name: "Skill" })).toBeNull();

        await pickJob(user, "Run a skill");
        const params = screen.getByTestId("schedule-params");
        expect(within(params).getByText("Skill")).toBeTruthy();
        expect(within(params).getByText("What to give it")).toBeTruthy();
        // The pinned version is the server's bookkeeping: it has no field.
        expect(within(params).queryByText("Version no")).toBeNull();
        expect(within(params).queryByRole("spinbutton")).toBeNull();
        await waitFor(() => expect(fetchRunnableSkills).toHaveBeenCalledWith("tok", "t1"));
    });

    it("lists what the member may run and does not let a never-published skill be chosen", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "Run a skill");
        await waitFor(() => expect(fetchRunnableSkills).toHaveBeenCalled());
        await user.click(await screen.findByRole("combobox", { name: "Skill" }));
        const options = await screen.findAllByRole("option");
        expect(options.map((o) => o.textContent)).toEqual([
            "Weekly review",
            "Draft only (share it with your team to publish a version first)",
            "Triage",
        ]);
        expect(options[1].getAttribute("aria-disabled")).toBe("true");
        expect(options[0].getAttribute("aria-disabled")).not.toBe("true");
    });

    it("sends the skill and its input, and no version: the server pins it", async () => {
        createSchedule.mockResolvedValue({ ok: true, schedule: SKILL_SCHEDULE });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "Run a skill");
        await waitFor(() => expect(fetchRunnableSkills).toHaveBeenCalled());
        await user.click(await screen.findByRole("combobox", { name: "Skill" }));
        await user.click(await screen.findByRole("option", { name: "Triage" }));
        await user.type(screen.getByLabelText("What to give it"), "the inbox");
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        const sent = createSchedule.mock.calls[0][2];
        expect(sent.job).toBe("run_skill");
        expect(sent.params).toEqual({ skill_id: "k3", input: "the inbox" });
    });

    it("says so when no skill is chosen, and sends nothing", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "Run a skill");
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        expect(await screen.findByText("Choose a skill.")).toBeTruthy();
        expect(createSchedule).not.toHaveBeenCalled();
    });
});

describe("editing a schedule that runs a skill", () => {
    const openEdit = async (user: ReturnType<typeof userEvent.setup>) => {
        listSchedules.mockResolvedValue(LIST([SKILL_SCHEDULE]));
        render(<SchedulesSection teamId="t1" />);
        await user.click(await screen.findByRole("button", { name: /Edit/ }));
        return screen.getByTestId("schedule-form");
    };

    it("a rename sends only the name: the pinned version is not touched", async () => {
        updateSchedule.mockResolvedValue({ ok: true, schedule: SKILL_SCHEDULE });
        const user = userEvent.setup();
        await openEdit(user);
        const name = screen.getByLabelText("Name");
        await user.clear(name);
        await user.type(name, "Tuesday review");
        await user.click(screen.getByRole("button", { name: "Save changes" }));
        await waitFor(() => expect(updateSchedule).toHaveBeenCalledTimes(1));
        expect(updateSchedule.mock.calls[0][3]).toEqual({ name: "Tuesday review" });
    });

    it("another skill drops the old version, so the server pins the new one", async () => {
        updateSchedule.mockResolvedValue({ ok: true, schedule: SKILL_SCHEDULE });
        const user = userEvent.setup();
        await openEdit(user);
        await waitFor(() => expect(fetchRunnableSkills).toHaveBeenCalled());
        await user.click(await screen.findByRole("combobox", { name: "Skill" }));
        await user.click(await screen.findByRole("option", { name: "Triage" }));
        await user.click(screen.getByRole("button", { name: "Save changes" }));
        await waitFor(() => expect(updateSchedule).toHaveBeenCalledTimes(1));
        expect(updateSchedule.mock.calls[0][3]).toEqual({
            params: { skill_id: "k3", input: "for Q3" },
        });
    });

    it("a stored skill that is no longer listed reads unavailable", async () => {
        fetchRunnableSkills.mockResolvedValue({ ok: true, data: [SKILLS[2]] });
        const user = userEvent.setup();
        await openEdit(user);
        await waitFor(() => expect(fetchRunnableSkills).toHaveBeenCalled());
        await waitFor(() =>
            expect(screen.getByRole("combobox", { name: "Skill" }).textContent).toContain(
                "(unavailable)"
            )
        );
    });
});
