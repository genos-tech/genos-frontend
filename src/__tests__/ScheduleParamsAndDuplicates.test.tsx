/**
 * Genos Assist Schedules form (MIP-1200): plain parameter labels and pickers by
 * name instead of raw ids, and the "already have it" handling around the API's
 * duplicate refusal (MIP-1201).
 *
 * jsdom draws no layout: how it looks at phone width was checked in a browser.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SchedulesSection } from "../components/layout/schedules/SchedulesSection";
import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";

// Big dialogs rendered through Joy: slow when the whole suite shares the machine.
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

const loadProjectMilestones = vi.fn();
vi.mock("../features/tasks/sprint-milestone/services/loadProjectMilestones", () => ({
    loadProjectMilestones: (...a: unknown[]) => loadProjectMilestones(...a),
}));

const PROJECTS = [
    { projectId: 11, projectName: "Apollo", projectTags: [], isJoined: true },
    { projectId: 12, projectName: "Borealis", projectTags: [], isJoined: true },
    { projectId: 13, projectName: "Hidden one", projectTags: [], isJoined: false },
];

const mention = (over: Partial<HashMentionData> = {}): HashMentionData => ({
    tasks: [],
    teamTasks: [],
    notes: [],
    chats: [],
    allChats: [],
    projects: PROJECTS as never,
    todoGroups: [],
    myself: null,
    refresh: () => {},
    ...over,
});

const render = (ui: React.ReactElement, data: HashMentionData = mention()) =>
    rtlRender(
        <CssVarsProvider>
            <HashMentionDataProvider value={data}>{ui}</HashMentionDataProvider>
        </CssVarsProvider>
    );

const JOBS = [
    {
        job: "what_to_do_today",
        title: "What to do today",
        description: "Your plan.",
        params: {
            changed_hours: { type: "integer", minimum: 1, maximum: 168 },
            project_id: { type: "integer", minimum: 1 },
        },
    },
    {
        job: "what_you_did",
        title: "What you did",
        description: "A recap of your day.",
        params: { day: { type: "string", enum: ["today", "yesterday"] } },
    },
    {
        job: "what_is_left",
        title: "What is left",
        description: "From the past days.",
        params: { days: { type: "integer", minimum: 1, maximum: 31 } },
    },
    {
        job: "milestone_updates",
        title: "Milestone updates",
        description: "One milestone.",
        params: {
            milestone_id: { type: "integer", minimum: 1 },
            hours: { type: "integer", minimum: 1, maximum: 720 },
        },
    },
    {
        job: "future_job",
        title: "A future job",
        description: "Added on the server later.",
        params: { shiny_new_knob: { type: "integer", minimum: 1, maximum: 9 } },
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
    nextRun: null,
    lastRun: null,
    lastStatus: null,
};

const LIST = (schedules: unknown[] = [SCHEDULE], over: object = {}) => ({
    timeZone: "Asia/Tokyo",
    limit: 20,
    jobs: JOBS,
    schedules,
    suggestions: [],
    ...over,
});

beforeEach(() => {
    for (const fn of [listSchedules, createSchedule, updateSchedule, loadProjectMilestones]) {
        fn.mockReset();
    }
    listSchedules.mockResolvedValue(LIST());
    loadProjectMilestones.mockImplementation(async (projectId: number) => ({
        milestones:
            projectId === 11
                ? [
                      { milestoneId: 501, title: "Launch", status: "WIP" },
                      { milestoneId: 502, title: "Old thing", status: "Closed" },
                  ]
                : projectId === 12
                  ? [{ milestoneId: 601, title: "Beta", status: "Open" }]
                  : [],
    }));
});

const openNew = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole("button", { name: "New schedule" }));
    return screen.getByTestId("schedule-form");
};

const pickJob = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
    await user.click(screen.getByRole("combobox", { name: "Report" }));
    await user.click(await screen.findByRole("option", { name: title }));
};

describe("plain parameter labels and hints", () => {
    it("never shows the raw parameter keys", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "What to do today");
        const params = screen.getByTestId("schedule-params");
        expect(within(params).getByText("Look back (hours)")).toBeTruthy();
        expect(within(params).getByText("Project")).toBeTruthy();
        expect(within(params).queryByText("Changed hours")).toBeNull();
        expect(within(params).queryByText("Project id")).toBeNull();
        // a hint with the real range from the catalog
        expect(
            within(params).getByText(
                "Show changes from the last N hours (1 to 168). Leave empty for the last 24."
            )
        ).toBeTruthy();
    });

    it("labels the other jobs' parameters too", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "What is left");
        expect(
            within(screen.getByTestId("schedule-params")).getByText("Look back (days)")
        ).toBeTruthy();
        await pickJob(user, "Milestone updates");
        const params = screen.getByTestId("schedule-params");
        expect(within(params).getByText("Look back (hours)")).toBeTruthy();
        expect(
            within(params).getByText(
                "Show changes from the last N hours (1 to 720). Leave empty for the last 168 (one week)."
            )
        ).toBeTruthy();
    });

    it("keeps the label made from the key for a parameter it has no words for", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "A future job");
        const params = screen.getByTestId("schedule-params");
        expect(within(params).getByText("Shiny new knob")).toBeTruthy();
        // and the catalog's own range text as before
        expect(within(params).getByText("Whole number from 1 to 9")).toBeTruthy();
    });
});

describe("project picker", () => {
    it("offers All projects and the member's joined projects by name", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "What to do today");
        await user.click(screen.getByRole("combobox", { name: "Project" }));
        const names = (await screen.findAllByRole("option")).map((o) => o.textContent);
        expect(names).toEqual(["All projects", "Apollo", "Borealis"]);
    });

    it("stores the project's id", async () => {
        createSchedule.mockResolvedValue({ ok: true, schedule: SCHEDULE });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "What to do today");
        await user.type(screen.getByRole("spinbutton"), "30");
        await user.click(screen.getByRole("combobox", { name: "Project" }));
        await user.click(await screen.findByRole("option", { name: "Borealis" }));
        const name = screen.getByLabelText("Name");
        await user.clear(name);
        await user.type(name, "Borealis plan");
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        expect(createSchedule.mock.calls[0][2].params).toEqual({
            changed_hours: 30,
            project_id: 12,
        });
    });

    it("sends no project at all for All projects", async () => {
        createSchedule.mockResolvedValue({ ok: true, schedule: SCHEDULE });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "What to do today");
        await user.click(screen.getByRole("combobox", { name: "Project" }));
        await user.click(await screen.findByRole("option", { name: "Apollo" }));
        await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
        expect(screen.getByRole("combobox", { name: "Project" })).toHaveTextContent("Apollo");
        await user.click(screen.getByRole("combobox", { name: "Project" }));
        await user.click(await screen.findByRole("option", { name: "All projects" }));
        const name = screen.getByLabelText("Name");
        await user.clear(name);
        await user.type(name, "Everything");
        // 09:00 daily with no options is the existing Morning plan: pick another time
        const time = screen.getByLabelText("Time (24-hour)");
        await user.clear(time);
        await user.type(time, "10:00");
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        expect(createSchedule.mock.calls[0][2].params).toEqual({});
    });

    it("shows a stored project the member can no longer see as (unavailable), not a number", async () => {
        listSchedules.mockResolvedValue(LIST([{ ...SCHEDULE, params: { project_id: 999 } }]));
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click(await screen.findByRole("button", { name: "Edit" }));
        const picker = screen.getByRole("combobox", { name: "Project" });
        expect(picker).toHaveTextContent("(unavailable)");
        expect(picker).not.toHaveTextContent("999");
    });

    it("shows a stored project by its name", async () => {
        listSchedules.mockResolvedValue(LIST([{ ...SCHEDULE, params: { project_id: 11 } }]));
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click(await screen.findByRole("button", { name: "Edit" }));
        expect(screen.getByRole("combobox", { name: "Project" })).toHaveTextContent("Apollo");
    });
});

describe("milestone picker", () => {
    it("lists milestones by name grouped by project, leaves out finished ones, and stores the id", async () => {
        createSchedule.mockResolvedValue({ ok: true, schedule: SCHEDULE });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "Milestone updates");
        // one request per joined project, none for the project the member is not in
        await waitFor(() => expect(loadProjectMilestones).toHaveBeenCalledTimes(2));
        expect(loadProjectMilestones.mock.calls.map((c) => c[0]).sort()).toEqual([11, 12]);
        await user.click(await screen.findByRole("combobox", { name: /Milestone/ }));
        const options = await screen.findAllByRole("option");
        expect(options.map((o) => o.textContent)).toEqual(["Launch", "Beta"]);
        expect(screen.getByText("Apollo")).toBeTruthy();
        expect(screen.getByText("Borealis")).toBeTruthy();
        await user.click(screen.getByRole("option", { name: "Beta" }));
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        expect(createSchedule.mock.calls[0][2]).toMatchObject({
            job: "milestone_updates",
            params: { milestone_id: 601 },
        });
    });

    it("says the milestones could not be loaded, not that there are none, when every request fails", async () => {
        loadProjectMilestones.mockResolvedValue(undefined);
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "Milestone updates");
        await waitFor(() => expect(loadProjectMilestones).toHaveBeenCalledTimes(2));
        await user.click(await screen.findByRole("combobox", { name: /Milestone/ }));
        expect(
            await screen.findByText("Couldn't load the milestones. Close this form and try again.")
        ).toBeTruthy();
        expect(screen.queryByText("There are no milestones to choose from.")).toBeNull();
    });

    it("will not send without a milestone, and says so", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "Milestone updates");
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        expect(await screen.findByText("Choose a milestone.")).toBeTruthy();
        expect(createSchedule).not.toHaveBeenCalled();
    });

    it("shows a stored milestone that is gone as (unavailable), a visible one by name", async () => {
        listSchedules.mockResolvedValue(
            LIST([
                {
                    ...SCHEDULE,
                    id: "s2",
                    name: "Gone milestone",
                    job: "milestone_updates",
                    jobTitle: "Milestone updates",
                    params: { milestone_id: 9999 },
                },
                {
                    ...SCHEDULE,
                    id: "s3",
                    name: "Beta watch",
                    job: "milestone_updates",
                    jobTitle: "Milestone updates",
                    params: { milestone_id: 601 },
                },
            ])
        );
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        const edits = await screen.findAllByRole("button", { name: "Edit" });
        await user.click(edits[0]);
        const picker = await screen.findByRole("combobox", { name: /Milestone/ });
        await waitFor(() => expect(picker).toHaveTextContent("(unavailable)"));
        expect(picker).not.toHaveTextContent("9999");
    });
});

describe("a schedule that already exists", () => {
    it("says so on the name, and will not create it", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "What you did");
        const name = screen.getByLabelText("Name");
        await user.clear(name);
        await user.type(name, "morning PLAN");
        expect(
            await screen.findByText(
                "You already have a schedule named Morning plan. Give this one another name."
            )
        ).toBeTruthy();
        expect(screen.getByRole("button", { name: "Create schedule" })).toBeDisabled();
        expect(createSchedule).not.toHaveBeenCalled();
    });

    it("says so when the report, parameters and time are the same under another name", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickJob(user, "What to do today");
        const name = screen.getByLabelText("Name");
        await user.clear(name);
        await user.type(name, "My copy");
        expect(
            await screen.findByText(
                "You already have a schedule that does the same thing at the same time: Morning plan."
            )
        ).toBeTruthy();
        expect(screen.getByRole("button", { name: "Create schedule" })).toBeDisabled();
        // another time is a different schedule
        const time = screen.getByLabelText("Time (24-hour)");
        await user.clear(time);
        await user.type(time, "10:30");
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "Create schedule" })).toBeEnabled()
        );
    });

    it("does not flag an untouched new form, but says so when it is submitted as it is", async () => {
        // The form opens on the first report at 09:00, which is the existing Morning plan's slot.
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        // untouched: nothing yet, and Create is available
        expect(screen.queryByText(/You already have/)).toBeNull();
        const create = screen.getByRole("button", { name: "Create schedule" });
        expect(create).toBeEnabled();
        await user.click(create);
        // submitted as it is: the sentence, no call to the API
        expect(
            await screen.findByText(
                "You already have a schedule that does the same thing at the same time: Morning plan."
            )
        ).toBeTruthy();
        expect(createSchedule).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Create schedule" })).toBeDisabled();
    });

    it("keeps two look-alike schedules editable: only a change that makes the copy is blocked", async () => {
        updateSchedule.mockResolvedValue({ ok: true, schedule: SCHEDULE });
        listSchedules.mockResolvedValue(
            LIST([SCHEDULE, { ...SCHEDULE, id: "s9", name: "Morning plan" }])
        );
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
        // already alike before the edit: not flagged, push can be toggled and saved
        expect(screen.queryByText(/You already have/)).toBeNull();
        await user.click(within(screen.getByTestId("schedule-form")).getByRole("switch"));
        expect(screen.queryByText(/You already have/)).toBeNull();
        await user.click(screen.getByRole("button", { name: "Save changes" }));
        await waitFor(() => expect(updateSchedule).toHaveBeenCalledTimes(1));
    });

    it("blocks an edit that turns a schedule into a copy of another", async () => {
        listSchedules.mockResolvedValue(
            LIST([
                SCHEDULE,
                { ...SCHEDULE, id: "s2", name: "Evening", timeOfDay: "17:00", when: "17:00" },
            ])
        );
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click((await screen.findAllByRole("button", { name: "Edit" }))[1]);
        const time = screen.getByLabelText("Time (24-hour)");
        await user.clear(time);
        await user.type(time, "09:00");
        expect(
            await screen.findByText(
                "You already have a schedule that does the same thing at the same time: Morning plan."
            )
        ).toBeTruthy();
        expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    });

    it("does not call the schedule being edited a duplicate of itself", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click(await screen.findByRole("button", { name: "Edit" }));
        expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
        expect(screen.queryByText(/You already have/)).toBeNull();
    });

    it("shows the API's own sentence when it refuses a duplicate the list did not show", async () => {
        listSchedules.mockResolvedValue(LIST([]));
        createSchedule.mockResolvedValue({
            ok: false,
            gone: false,
            error: "You already have a schedule called Morning plan.",
        });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click(
            await screen.findByRole("button", { name: "Create your first schedule" })
        );
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        expect(
            await screen.findByText("You already have a schedule called Morning plan.")
        ).toBeTruthy();
        // not the generic line
        expect(screen.queryByText("Couldn't save that change. Try again.")).toBeNull();
    });

    it("drops the API's last refusal as soon as the form changes", async () => {
        listSchedules.mockResolvedValue(LIST([]));
        createSchedule.mockResolvedValue({
            ok: false,
            gone: false,
            error: "You already have a schedule called Morning plan.",
        });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click(
            await screen.findByRole("button", { name: "Create your first schedule" })
        );
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        expect(
            await screen.findByText("You already have a schedule called Morning plan.")
        ).toBeTruthy();
        await user.type(screen.getByLabelText("Name"), "!");
        expect(screen.queryByText("You already have a schedule called Morning plan.")).toBeNull();
    });

    it("shows the API's sentence for a refused edit", async () => {
        updateSchedule.mockResolvedValue({
            ok: false,
            gone: false,
            error: "Another schedule already does this.",
        });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click(await screen.findByRole("button", { name: "Edit" }));
        const time = screen.getByLabelText("Time (24-hour)");
        await user.clear(time);
        await user.type(time, "11:15");
        await user.click(screen.getByRole("button", { name: "Save changes" }));
        expect(await screen.findByText("Another schedule already does this.")).toBeTruthy();
    });
});

describe("suggestions the member already has", () => {
    const MORNING = {
        key: "morning_plan",
        name: "Morning plan",
        job: "what_to_do_today",
        params: {},
        frequency: "daily" as const,
        timeOfDay: "09:00",
    };

    it("disables Add, and says which schedule is the same, when the name is taken", async () => {
        // same name, another time: the API still offers it (it compares job and time only)
        listSchedules.mockResolvedValue(
            LIST([{ ...SCHEDULE, timeOfDay: "08:00" }], { suggestions: [MORNING] })
        );
        render(<SchedulesSection teamId="t1" />);
        const box = await screen.findByTestId("schedule-suggestions");
        expect(within(box).getByText("You already have this one: Morning plan.")).toBeTruthy();
        expect(within(box).getByRole("button", { name: "Add" })).toBeDisabled();
    });

    it("leaves Add enabled when nothing matches", async () => {
        listSchedules.mockResolvedValue(LIST([], { suggestions: [MORNING] }));
        render(<SchedulesSection teamId="t1" />);
        const box = await screen.findByTestId("schedule-suggestions");
        expect(within(box).getByRole("button", { name: "Add" })).toBeEnabled();
        expect(within(box).queryByText(/You already have/)).toBeNull();
    });

    it("shows the API's sentence when it refuses to add one", async () => {
        listSchedules.mockResolvedValue(LIST([], { suggestions: [MORNING] }));
        createSchedule.mockResolvedValue({
            ok: false,
            gone: false,
            error: "You already have a schedule called Morning plan.",
        });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        const box = await screen.findByTestId("schedule-suggestions");
        await user.click(within(box).getByRole("button", { name: "Add" }));
        expect(
            await screen.findByText("You already have a schedule called Morning plan.")
        ).toBeTruthy();
        expect(screen.queryByText("Couldn't add that schedule. Try again.")).toBeNull();
    });
});
