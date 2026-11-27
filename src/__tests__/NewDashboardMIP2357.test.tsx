/**
 * MIP-2357: "New dashboard" on the Custom dashboards tab opens the EXISTING schedule form with the
 * dashboard job as the only report.
 *
 * Pinned: the button opens `ScheduleFormPanel` (no form of our own) with the dashboard job; kind,
 * period and focus are drawn with words; a milestone or project field shows only for its kind and is
 * required then; what the kind does not use is never sent; the API's refusal (the audience rule) is
 * shown on save and keeps the dialog open; a saved schedule closes the dialog and refreshes the lists;
 * a server without the job says so. Layout at 390 and 1440 px is checked in a real browser (see the PR).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "../components/ui/feedback/toastStore";
import { buildCreate, validateForm } from "../features/schedules/scheduleForm";
import { paramApplies, paramRequiredNow } from "../features/schedules/scheduleParams";
import { CustomDashboardsTab } from "../features/tasks/components/dashboard/customDashboards/CustomDashboardsTab";
import { loadCustomDashboards } from "../features/tasks/services/loadCustomDashboards";
import { fmt, getMessages } from "../i18n";
import {
    createSchedule,
    listSchedules,
    runScheduleNow,
    type ScheduleJob,
} from "../services/schedules";

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/tasks/services/loadCustomDashboards", () => ({
    loadCustomDashboards: vi.fn(),
}));
vi.mock("../services/schedules", () => ({
    runScheduleNow: vi.fn(),
    listSchedules: vi.fn(),
    createSchedule: vi.fn(),
}));
vi.mock("../components/ui/feedback/toastStore", () => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
const requestInboxResync = vi.fn(async (_reason: string) => undefined);
vi.mock("../features/inbox/inboxResyncEvent", () => ({
    requestInboxResync: (reason: string) => requestInboxResync(reason),
}));
vi.mock("../components/layout/schedules/scheduleParamHooks", () => ({
    useJoinedProjects: () => [],
    useProjectAvatars: () => new Map(),
    useProjectMilestones: () => ({ groups: [], loading: false, failed: false }),
}));
vi.mock("../features/notes/common/components/HtmlNoteView", () => ({
    HtmlNoteView: () => <div data-testid="note-viewer" />,
}));

const load = vi.mocked(loadCustomDashboards);
const list = vi.mocked(listSchedules);
const create = vi.mocked(createSchedule);
type CreateResult = Awaited<ReturnType<typeof createSchedule>>;

const DASHBOARD: ScheduleJob = {
    job: "ai_dashboard",
    title: "Dashboard page",
    description: "One living dashboard page.",
    params: {
        kind: { type: "string", enum: ["milestone", "project", "mine"], required: true },
        milestone_id: { type: "integer", minimum: 1 },
        project_id: { type: "integer", minimum: 1 },
        period: { type: "string", enum: ["week", "month", "quarter", "year"] },
        focus: { type: "string" },
    },
};
const OTHER: ScheduleJob = {
    job: "morning_plan",
    title: "What to do today",
    description: "",
    params: { project_id: { type: "integer", minimum: 1 } },
};

const catalog = (jobs: ScheduleJob[]) =>
    ({
        schedules: [],
        jobs,
        chatTargets: [],
        suggestions: [],
        limit: 10,
        timeZone: "Asia/Tokyo",
    }) as unknown as NonNullable<Awaited<ReturnType<typeof listSchedules>>>;

const theme = createTheme({ cssVariables: true });
const renderTab = () =>
    render(
        <ThemeProvider theme={{ [THEME_ID]: theme }}>
            <CssVarsProvider>
                <MemoryRouter initialEntries={["/workspace/tasks?view=custom"]}>
                    <CustomDashboardsTab teamId="team-1" />
                </MemoryRouter>
            </CssVarsProvider>
        </ThemeProvider>
    );

const c = () => getMessages().tasks.dashboard.customDashboards;
const s = () => getMessages().settings.schedules;

beforeEach(() => {
    vi.clearAllMocks();
    load.mockResolvedValue({ status: "ready", data: { own: [], shared: [] } });
    list.mockResolvedValue(catalog([OTHER, DASHBOARD]));
});

const openDialog = async () => {
    renderTab();
    fireEvent.click(await screen.findByTestId("new-dashboard"));
    return screen.findByTestId("schedule-form");
};

describe("which parameters apply", () => {
    const typed = (kind: string) => ({ kind });
    it("gates the milestone and project to their kind, only for a job that has a kind", () => {
        expect(paramApplies(DASHBOARD, "milestone_id", typed("milestone"))).toBe(true);
        expect(paramApplies(DASHBOARD, "milestone_id", typed("project"))).toBe(false);
        expect(paramApplies(DASHBOARD, "project_id", typed("project"))).toBe(true);
        expect(paramApplies(DASHBOARD, "project_id", typed("mine"))).toBe(false);
        // The project reports have no `kind`: their project is never gated.
        expect(paramApplies(OTHER, "project_id", {})).toBe(true);
        expect(paramRequiredNow(OTHER, "project_id", OTHER.params.project_id, {})).toBe(false);
    });

    it("requires the project of a project dashboard and sends nothing the kind does not use", () => {
        const form = {
            name: "D",
            job: "ai_dashboard",
            params: { kind: "mine", period: "quarter", project_id: "7", milestone_id: "3" },
            frequency: "weekly" as const,
            timeOfDay: "08:00",
            weekdays: [0],
            monthDay: "1",
            runDate: "",
            runRightAway: false,
            deliverPush: true,
            aiEffort: "",
            deliverChannelId: "",
            messageBody: [],
        };
        expect(validateForm(form, DASHBOARD).params).toEqual({});
        expect(buildCreate(form, DASHBOARD).params).toEqual({ kind: "mine", period: "quarter" });
        const noProject = { ...form, params: { kind: "project" } };
        expect(validateForm(noProject, DASHBOARD).params).toEqual({ project_id: "required" });
        const noMilestone = { ...form, params: { kind: "milestone" } };
        expect(validateForm(noMilestone, DASHBOARD).params).toEqual({ milestone_id: "required" });
    });
});

describe("New dashboard", () => {
    it("opens the existing schedule form with the dashboard job alone", async () => {
        const form = await openDialog();
        expect(within(form).getAllByRole("combobox")[0]).toHaveTextContent(DASHBOARD.title);
        const params = within(form).getByTestId("schedule-params");
        expect(within(params).getByText(s().paramKind)).toBeTruthy();
        expect(within(params).getByText(s().paramPeriod)).toBeTruthy();
        expect(within(params).getByText(s().paramFocus)).toBeTruthy();
        // No kind chosen yet: neither the milestone nor the project is asked for.
        expect(within(params).queryByText(s().paramMilestone)).toBeNull();
        expect(within(params).queryByText(s().paramProject)).toBeNull();
    });

    it("shows the project only for a project dashboard", async () => {
        const form = await openDialog();
        const params = within(form).getByTestId("schedule-params");
        fireEvent.click(within(params).getAllByRole("combobox")[0]);
        fireEvent.click(await screen.findByRole("option", { name: s().kindProject }));
        expect(await within(params).findByText(s().paramProject)).toBeTruthy();
        expect(within(params).queryByText(s().paramMilestone)).toBeNull();
    });

    it("shows the API's refusal on save and keeps the dialog open", async () => {
        create.mockResolvedValue({
            ok: false,
            gone: false,
            error: "A chat everyone can join cannot get this report.",
        } as unknown as CreateResult);
        const form = await openDialog();
        const params = within(form).getByTestId("schedule-params");
        fireEvent.click(within(params).getAllByRole("combobox")[0]);
        fireEvent.click(await screen.findByRole("option", { name: s().kindMine }));
        fireEvent.submit(form);
        expect(await screen.findByText(/cannot get this report/)).toBeTruthy();
        expect(create).toHaveBeenCalledTimes(1);
        expect(create.mock.calls[0][2]).toMatchObject({
            job: "ai_dashboard",
            params: { kind: "mine" },
        });
        expect(screen.getByTestId("schedule-form")).toBeTruthy();
    });

    it("closes and reads the lists again once it is saved", async () => {
        create.mockResolvedValue({ ok: true } as unknown as CreateResult);
        const form = await openDialog();
        const params = within(form).getByTestId("schedule-params");
        fireEvent.click(within(params).getAllByRole("combobox")[0]);
        fireEvent.click(await screen.findByRole("option", { name: s().kindMine }));
        const before = load.mock.calls.length;
        fireEvent.submit(form);
        await waitFor(() => expect(screen.queryByTestId("schedule-form")).toBeNull());
        await waitFor(() => expect(load.mock.calls.length).toBeGreaterThan(before));
    });

    // MIP-2425: the create already ran it, so "Run it now" would be a second (billed) run.
    const runRightAway = async (deliverChannel: unknown) => {
        create.mockResolvedValue({
            ok: true,
            schedule: { id: "new1", deliverChannel },
            outcome: { status: "ok", error: "", title: "My progress", items: 3 },
        } as unknown as CreateResult);
        const form = await openDialog();
        const params = within(form).getByTestId("schedule-params");
        fireEvent.click(within(params).getAllByRole("combobox")[0]);
        fireEvent.click(await screen.findByRole("option", { name: s().kindMine }));
        fireEvent.click(within(form).getByRole("combobox", { name: s().frequency }));
        fireEvent.click(await screen.findByRole("option", { name: s().frequencyOnce }));
        fireEvent.click(within(form).getByRole("radio", { name: s().onceRightAway }));
        fireEvent.submit(form);
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        expect(create).toHaveBeenCalledTimes(1);
        expect(create.mock.calls[0][2]).toMatchObject({ runNow: true });
        expect(runScheduleNow).not.toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByTestId("schedule-form")).toBeNull());
        return vi.mocked(toast.success).mock.calls[0][0];
    };

    it("announces the run of Run right away instead of asking to run it", async () => {
        const said = await runRightAway(null);
        expect(said).toBe(fmt(s().reportReadyTitled, { title: "My progress" }));
        expect(said).not.toBe(c().newDashboardSaved);
        expect(requestInboxResync).toHaveBeenCalledWith("schedule-run");
    });

    it("says which chat a Run right away posted to", async () => {
        const said = await runRightAway({ id: "c1", title: "Team room", kind: "group" });
        expect(said).toBe(fmt(s().reportPosted, { chat: "Team room" }));
        expect(requestInboxResync).not.toHaveBeenCalled();
    });

    it("keeps the usual toast for a create that did not run", async () => {
        create.mockResolvedValue({
            ok: true,
            schedule: { id: "new2" },
        } as unknown as CreateResult);
        const form = await openDialog();
        const params = within(form).getByTestId("schedule-params");
        fireEvent.click(within(params).getAllByRole("combobox")[0]);
        fireEvent.click(await screen.findByRole("option", { name: s().kindMine }));
        fireEvent.submit(form);
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
        expect(vi.mocked(toast.success).mock.calls[0][0]).toBe(c().newDashboardSaved);
        expect(requestInboxResync).not.toHaveBeenCalled();
    });

    it("says so when the server has no dashboard job", async () => {
        list.mockResolvedValue(catalog([OTHER]));
        renderTab();
        fireEvent.click(await screen.findByTestId("new-dashboard"));
        expect(await screen.findByText(c().newDashboardNoJob)).toBeTruthy();
        expect(screen.queryByTestId("schedule-form")).toBeNull();
    });
});
