/**
 * A schedule can post its report in a chat instead of the Inbox (MIP-1420): the picker in the
 * existing form, what goes on the wire, the row that says where it posts, and the server's
 * refusal sentence shown as written.
 *
 * jsdom draws no layout: how the form looks at phone width was checked in a browser.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SchedulesSection } from "../components/layout/schedules/SchedulesSection";
import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";
import { findDuplicate } from "../features/schedules/scheduleDuplicates";
import {
    buildCreate,
    buildPatch,
    emptyForm,
    formFromSchedule,
} from "../features/schedules/scheduleForm";
import type { Schedule, ScheduleJob } from "../services/schedules";

vi.setConfig({ testTimeout: 30000 });

vi.mock("../context/authState", () => ({
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

const PROJECTS = [{ projectId: 11, projectName: "Apollo", projectTags: [], isJoined: true }];

const mention = (): HashMentionData => ({
    tasks: [],
    notes: [],
    chats: [],
    allChats: [],
    projects: PROJECTS as never,
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

const PROJECT_JOB: ScheduleJob = {
    job: "project_updates",
    title: "Project updates",
    description: "One project.",
    params: {
        project_id: { type: "integer", minimum: 1, required: true },
        hours: { type: "integer", minimum: 1, maximum: 720 },
    },
    shareable: true,
};

const CHATS = [
    { id: "c-squad", title: "Squad", kind: "group" as const, projectId: null },
    { id: "c-apollo", title: "Apollo", kind: "project" as const, projectId: 11 },
];

const SCHEDULE: Schedule = {
    id: "s1",
    name: "Apollo news",
    job: "project_updates",
    jobTitle: "Project updates",
    params: { project_id: 11 },
    when: "every day at 09:00",
    frequency: "daily",
    timeOfDay: "09:00",
    enabled: true,
    deliverPush: true,
    nextRun: null,
    lastRun: null,
    lastStatus: null,
};

const IN_CHAT: Schedule = {
    ...SCHEDULE,
    deliverChannelId: "c-apollo",
    deliverChannel: { id: "c-apollo", title: "Apollo", kind: "project" },
};

const LIST = (schedules: Schedule[] = [], over: object = {}) => ({
    timeZone: "Asia/Tokyo",
    limit: 20,
    jobs: [PROJECT_JOB],
    schedules,
    suggestions: [],
    chatTargets: CHATS,
    ...over,
});

beforeEach(() => {
    for (const fn of [listSchedules, createSchedule, updateSchedule]) fn.mockReset();
    listSchedules.mockResolvedValue(LIST());
});

const openNew = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(
        await screen.findByRole("button", { name: /^(New schedule|Create your first)/ })
    );
    return screen.getByTestId("schedule-form");
};

const pickProject = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("combobox", { name: "Project" }));
    await user.click(await screen.findByRole("option", { name: "Apollo" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
};

describe("the picker", () => {
    it("is not drawn when there is no chat to choose, and the form is what it was", async () => {
        listSchedules.mockResolvedValue(LIST([], { chatTargets: [] }));
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        expect(screen.queryByTestId("schedule-deliver")).toBeNull();
        expect(screen.getByRole("switch")).toBeTruthy(); // the push switch is still there
    });

    it("offers the Inbox first, then the chats, a project chat marked as one", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        const box = within(screen.getByTestId("schedule-deliver"));
        expect(box.getByRole("combobox")).toHaveValue("My Inbox");
        await user.click(box.getByRole("combobox"));
        const names = (await screen.findAllByRole("option")).map((o) => o.textContent);
        expect(names).toEqual(["My Inbox", "SquadGroup chat", "ApolloProject chat"]);
    });

    it("sends the chat's id on create, and no push switch is shown for it", async () => {
        createSchedule.mockResolvedValue({ ok: true, schedule: IN_CHAT });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickProject(user);
        await user.click(within(screen.getByTestId("schedule-deliver")).getByRole("combobox"));
        await user.click(await screen.findByRole("option", { name: /^Apollo/ }));
        expect(screen.queryByRole("switch")).toBeNull();
        expect(
            within(screen.getByTestId("schedule-deliver")).getByText(
                /Everyone in the chat can read it/
            )
        ).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        expect(createSchedule.mock.calls[0][2].deliverChannelId).toBe("c-apollo");
    });

    it("sends nothing about a chat for the Inbox", async () => {
        createSchedule.mockResolvedValue({ ok: true, schedule: SCHEDULE });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickProject(user);
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        expect("deliverChannelId" in createSchedule.mock.calls[0][2]).toBe(false);
    });

    it("shows the server's refusal as written", async () => {
        const said = "Not everyone in that chat is on the project, so not everyone could read it.";
        createSchedule.mockResolvedValue({
            ok: false,
            gone: false,
            error: said,
            planRequired: false,
            limitReached: false,
        });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openNew(user);
        await pickProject(user);
        await user.click(within(screen.getByTestId("schedule-deliver")).getByRole("combobox"));
        await user.click(await screen.findByRole("option", { name: /^Squad/ }));
        await user.click(screen.getByRole("button", { name: "Create schedule" }));
        expect((await screen.findByRole("alert")).textContent).toContain(said);
    });
});

describe("a schedule that posts in a chat", () => {
    it("says where, in its row", async () => {
        listSchedules.mockResolvedValue(LIST([IN_CHAT]));
        render(<SchedulesSection teamId="t1" />);
        expect((await screen.findByTestId("schedule-row-deliver")).textContent).toBe(
            "Posts in: Apollo"
        );
    });

    it("an Inbox schedule's row says nothing about a chat", async () => {
        listSchedules.mockResolvedValue(LIST([SCHEDULE]));
        render(<SchedulesSection teamId="t1" />);
        await screen.findByText("Apollo news");
        expect(screen.queryByTestId("schedule-row-deliver")).toBeNull();
    });

    it("opens with its chat chosen and goes back to the Inbox with null", async () => {
        listSchedules.mockResolvedValue(LIST([IN_CHAT]));
        updateSchedule.mockResolvedValue({ ok: true, schedule: SCHEDULE });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click(await screen.findByRole("button", { name: /^Edit/ }));
        const box = within(screen.getByTestId("schedule-deliver"));
        expect(box.getByRole("combobox")).toHaveValue("Apollo (project chat)");
        await user.click(box.getByRole("combobox"));
        await user.click(await screen.findByRole("option", { name: /^My Inbox/ }));
        await user.click(screen.getByRole("button", { name: "Save changes" }));
        await waitFor(() => expect(updateSchedule).toHaveBeenCalledTimes(1));
        expect(updateSchedule.mock.calls[0][3]).toEqual({ deliverChannelId: null });
    });

    it("keeps a chat that is no longer offered selectable instead of showing a blank", async () => {
        listSchedules.mockResolvedValue(LIST([IN_CHAT], { chatTargets: [CHATS[0]] }));
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click(await screen.findByRole("button", { name: /^Edit/ }));
        expect(within(screen.getByTestId("schedule-deliver")).getByRole("combobox")).toHaveValue(
            "Apollo (project chat)"
        );
    });
});

describe("the wire shape", () => {
    it("create carries the chat only when one is chosen", () => {
        const form = { ...emptyForm([PROJECT_JOB]), name: "x", params: { project_id: "11" } };
        expect("deliverChannelId" in buildCreate(form, PROJECT_JOB)).toBe(false);
        expect(
            buildCreate({ ...form, deliverChannelId: "c-apollo" }, PROJECT_JOB).deliverChannelId
        ).toBe("c-apollo");
    });

    it("an edit sends the chat only when it changed, and null for the Inbox", () => {
        const same = formFromSchedule(IN_CHAT, [PROJECT_JOB]);
        expect(buildPatch(IN_CHAT, same, PROJECT_JOB)).toEqual({});
        expect(buildPatch(IN_CHAT, { ...same, deliverChannelId: "" }, PROJECT_JOB)).toEqual({
            deliverChannelId: null,
        });
        const inbox = formFromSchedule(SCHEDULE, [PROJECT_JOB]);
        expect(
            buildPatch(SCHEDULE, { ...inbox, deliverChannelId: "c-squad" }, PROJECT_JOB)
        ).toEqual({
            deliverChannelId: "c-squad",
        });
    });

    it("the same report at the same time for two places is not a duplicate", () => {
        const base = buildCreate(
            { ...emptyForm([PROJECT_JOB]), name: "other", params: { project_id: "11" } },
            PROJECT_JOB
        );
        expect(findDuplicate(base, [SCHEDULE])?.kind).toBe("same");
        expect(findDuplicate({ ...base, deliverChannelId: "c-apollo" }, [SCHEDULE])).toBeNull();
        expect(findDuplicate({ ...base, deliverChannelId: "c-apollo" }, [IN_CHAT])?.kind).toBe(
            "same"
        );
    });
});
