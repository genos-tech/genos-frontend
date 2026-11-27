/**
 * MIP-2397: Edit and Delete on a scheduled dashboard of the "Custom dashboards by AI" tab.
 *
 * Pinned: every OWN row has an Edit and a Delete icon button (a shared row has none) and the header
 * has Edit beside Run now for an own dashboard; Edit opens the EXISTING schedule form with the saved
 * values; once the page exists, where it is saved is shown but cannot be changed, with one sentence
 * why; a save sends only what changed, and when the options change it sends ALL of them (the API
 * replaces them as a whole, so the place must not be dropped); nothing changed asks nothing; Delete
 * asks once, says the page stays, and deletes only on yes; a failure stays in the dialog; a schedule
 * already gone refreshes the list. The hover and focus reveal of the row icons is CSS and is checked
 * in a real browser (see the PR).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CustomDashboardsTab } from "../features/tasks/components/dashboard/customDashboards/CustomDashboardsTab";
import { loadCustomDashboards } from "../features/tasks/services/loadCustomDashboards";
import { fmt, getMessages } from "../i18n";
import {
    deleteSchedule,
    listSchedules,
    updateSchedule,
    type Schedule,
    type ScheduleJob,
} from "../services/schedules";

vi.setConfig({ testTimeout: 30000 });

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/tasks/services/loadCustomDashboards", () => ({
    loadCustomDashboards: vi.fn(),
}));
vi.mock("../services/schedules", () => ({
    runScheduleNow: vi.fn(),
    listSchedules: vi.fn(),
    createSchedule: vi.fn(),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
}));
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("../components/ui/feedback/toastStore", () => ({
    toast: {
        success: (...a: unknown[]) => toastSuccess(...a),
        error: (...a: unknown[]) => toastError(...a),
        warning: vi.fn(),
    },
}));
vi.mock("../components/layout/schedules/scheduleParamHooks", () => ({
    // The folders the "Save to" picker offers: one personal folder, the one s-1 is saved in.
    useNoteFolders: () => ({
        mine: [{ folderId: 5, name: "Reports", parentFolderId: null }],
        team: [],
        loading: false,
        failed: false,
    }),
    useJoinedProjects: () => [],
    useProjectAvatars: () => new Map(),
    useProjectMilestones: () => ({ groups: [], loading: false, failed: false }),
}));
vi.mock("../features/notes/common/components/HtmlNoteView", () => ({
    HtmlNoteView: () => <div data-testid="note-viewer" />,
}));

const load = vi.mocked(loadCustomDashboards);
const list = vi.mocked(listSchedules);
const update = vi.mocked(updateSchedule);
const remove = vi.mocked(deleteSchedule);

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
        save_to: { type: "string", enum: ["me", "personal_folder", "team_folder"] },
        folder_id: { type: "integer", minimum: 1 },
    },
};

const schedule = (over: Partial<Schedule>): Schedule =>
    ({
        id: "s-1",
        name: "Monday milestone",
        job: "ai_dashboard",
        jobTitle: "Dashboard page",
        params: { kind: "mine", period: "month", save_to: "personal_folder", folder_id: 5 },
        when: "every day at 09:00",
        frequency: "daily",
        timeOfDay: "09:00",
        enabled: true,
        deliverPush: true,
        nextRun: null,
        lastRun: null,
        lastStatus: null,
        lastError: null,
        lastResult: null,
        deliverChannelId: null,
        deliverChannel: null,
        ...over,
    }) as Schedule;

// s-1 has its page (so its place is locked); s-2 has not run yet (so it is not).
const SAVED_1 = schedule({ id: "s-1", name: "Monday milestone" });
const SAVED_2 = schedule({
    id: "s-2",
    name: "Brand new dashboard",
    params: { kind: "mine", period: "week" },
    timeOfDay: "10:00",
});

const READY = () => ({
    status: "ready" as const,
    data: {
        own: [
            {
                scheduleId: "s-1",
                name: "Monday milestone",
                enabled: true,
                lastRun: "2026-11-24T08:00:00+09:00",
                lastStatus: "ok",
                note: { noteId: 11, noteType: "personal", title: "Milestone X dashboard" },
            },
            {
                scheduleId: "s-2",
                name: "Brand new dashboard",
                enabled: true,
                lastRun: null,
                lastStatus: "",
                note: null,
            },
        ],
        shared: [{ noteId: 21, noteType: "personal", title: "Team progress", ownerName: "Ana" }],
    },
});

const catalog = () =>
    ({
        schedules: [SAVED_1, SAVED_2],
        jobs: [DASHBOARD],
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
const actions = () => getMessages().common.actions;
const ok = { ok: true as const };
const editLabel = (name: string) => fmt(c().editNamed, { name });
const deleteLabel = (name: string) => fmt(c().deleteNamed, { name });

beforeEach(() => {
    vi.clearAllMocks();
    load.mockImplementation(async () => READY());
    list.mockResolvedValue(catalog());
    update.mockResolvedValue({ ...ok, schedule: SAVED_1 });
    remove.mockResolvedValue(ok);
});

describe("the row and header actions", () => {
    it("gives every own row Edit and Delete, named after it, and a shared row none", async () => {
        renderTab();
        const rows = await screen.findAllByTestId("custom-dashboard-row");
        expect(rows).toHaveLength(3);
        expect(screen.getAllByTestId("custom-dashboard-row-edit")).toHaveLength(2);
        expect(screen.getAllByTestId("custom-dashboard-row-delete")).toHaveLength(2);
        const own = screen.getByRole("region", { name: c().own });
        expect(
            within(own).getByRole("button", { name: editLabel("Milestone X dashboard") })
        ).toBeTruthy();
        expect(
            within(own).getByRole("button", { name: deleteLabel("Brand new dashboard") })
        ).toBeTruthy();
        const shared = screen.getByRole("region", { name: c().shared });
        expect(within(shared).queryAllByRole("button", { name: /Edit|Delete/ })).toHaveLength(0);
        expect(within(shared).queryByTestId("custom-dashboard-row-edit")).toBeNull();
        expect(within(shared).queryByTestId("custom-dashboard-row-delete")).toBeNull();
    });

    it("puts Edit beside Run now for an own dashboard, and not for a shared one", async () => {
        renderTab();
        const viewer = await screen.findByTestId("custom-dashboard-viewer");
        expect(within(viewer).getByTestId("custom-dashboard-header-edit")).toBeTruthy();
        expect(within(viewer).getByRole("button", { name: c().runNow })).toBeTruthy();
        // The shared row: open it, and the header has neither Run now nor Edit.
        fireEvent.click(screen.getByRole("button", { name: /Team progress/ }));
        const shared = await screen.findByTestId("custom-dashboard-viewer");
        expect(within(shared).queryByTestId("custom-dashboard-header-edit")).toBeNull();
        expect(within(shared).queryByRole("button", { name: c().runNow })).toBeNull();
    });
});

// MIP-2410: the room was written as `pe`, which `sx` does not know, so no rule was emitted and a
// long title ran under the icons. jsdom lays nothing out, so this reads the emitted CSS; the
// layout itself is checked in a real browser.
describe("room for the row icons", () => {
    const cssOf = (el: Element) =>
        Array.from(document.styleSheets)
            .flatMap((sheet) => Array.from(sheet.cssRules))
            .filter((rule) =>
                Array.from(el.classList).some((name) => rule.cssText.startsWith(`.${name} {`))
            )
            .map((rule) => rule.cssText)
            .join("\n");

    it("ends an own row's text before the icons, and leaves a shared row its full width", async () => {
        renderTab();
        const own = await screen.findByRole("region", { name: c().own });
        const shared = screen.getByRole("region", { name: c().shared });
        const [ownRow] = within(own).getAllByTestId("custom-dashboard-row");
        const sharedRow = within(shared).getByTestId("custom-dashboard-row");
        expect(cssOf(ownRow)).toMatch(/padding-inline-end:\s*calc\(.*4rem/);
        expect(cssOf(sharedRow)).toContain("padding: 6px 10px");
        expect(cssOf(sharedRow)).not.toContain("padding-inline-end");
    });
});

describe("Edit", () => {
    const openEdit = async (name: string) => {
        renderTab();
        const user = userEvent.setup();
        // The row's icon, not the header's (same words). It is hidden until hover and jsdom has no
        // hover, so the click is dispatched as an event.
        const own = await screen.findByRole("region", { name: c().own });
        fireEvent.click(within(own).getByRole("button", { name: editLabel(name) }));
        return { user, form: await screen.findByTestId("schedule-form") };
    };

    it("opens the form for that dashboard with its saved values", async () => {
        const { form } = await openEdit("Milestone X dashboard");
        expect(screen.getByText(c().editTitle)).toBeTruthy();
        expect((within(form).getByLabelText(/^Name/) as HTMLInputElement).value).toBe(
            "Monday milestone"
        );
        expect(within(form).getByLabelText("Time (24-hour)")).toHaveValue("09:00");
        // Editing, not creating: no intro sentence, and the button saves.
        expect(screen.queryByText(c().newDashboardIntro)).toBeNull();
        expect(within(form).getByRole("button", { name: "Save changes" })).toBeTruthy();
    });

    it("the header Edit opens the same form for the open dashboard", async () => {
        renderTab();
        const user = userEvent.setup();
        await user.click(await screen.findByTestId("custom-dashboard-header-edit"));
        const form = await screen.findByTestId("schedule-form");
        expect((within(form).getByLabelText(/^Name/) as HTMLInputElement).value).toBe(
            "Monday milestone"
        );
    });

    it("locks where the page is saved once the page exists, and says why once", async () => {
        const { form } = await openEdit("Milestone X dashboard");
        const params = within(form).getByTestId("schedule-params");
        // ONE picker for the place, showing the folder by name; it is the only thing locked.
        const place = within(params).getByRole("combobox", { name: /Save to/i });
        expect(place).toBeDisabled();
        expect(place).toHaveValue("Reports");
        expect(within(params).queryByRole("spinbutton")).toBeNull();
        expect(within(params).getAllByText(c().editLockedHint)).toHaveLength(1);
        // The other options stay editable.
        expect(within(params).getByRole("combobox", { name: /Period/i })).not.toBeDisabled();
    });

    it("leaves the place editable while no page exists yet", async () => {
        const { form } = await openEdit("Brand new dashboard");
        const params = within(form).getByTestId("schedule-params");
        expect(within(params).getByRole("combobox", { name: /Save to/i })).not.toBeDisabled();
        expect(within(params).queryByText(c().editLockedHint)).toBeNull();
    });

    it("saves only the name when only the name changed, and tells the list to refresh", async () => {
        const { user, form } = await openEdit("Milestone X dashboard");
        const name = within(form).getByLabelText(/^Name/);
        await user.clear(name);
        await user.type(name, "Monday, renamed");
        await user.click(within(form).getByRole("button", { name: "Save changes" }));
        await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
        expect(update).toHaveBeenCalledWith("tok", "team-1", "s-1", { name: "Monday, renamed" });
        await waitFor(() =>
            expect(toastSuccess).toHaveBeenCalledWith(c().editSaved, expect.anything())
        );
        // Closed, and the lists are read again.
        await waitFor(() => expect(screen.queryByTestId("schedule-form")).toBeNull());
        expect(load.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("sends ALL the options when one changes, so the saved place is not dropped", async () => {
        const { user, form } = await openEdit("Milestone X dashboard");
        await user.type(within(form).getByLabelText(/^Focus/i), "blockers");
        await user.click(within(form).getByRole("button", { name: "Save changes" }));
        await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
        expect(update).toHaveBeenCalledWith("tok", "team-1", "s-1", {
            params: {
                kind: "mine",
                period: "month",
                focus: "blockers",
                save_to: "personal_folder",
                folder_id: 5,
            },
        });
    });

    it("asks the server nothing when nothing changed, and closes", async () => {
        const { user, form } = await openEdit("Milestone X dashboard");
        await user.click(within(form).getByRole("button", { name: "Save changes" }));
        await waitFor(() => expect(screen.queryByTestId("schedule-form")).toBeNull());
        expect(update).not.toHaveBeenCalled();
    });

    it("keeps the form open with the server's sentence when the save is refused", async () => {
        update.mockResolvedValue({
            ok: false,
            gone: false,
            error: "That folder opens the page to people off the project.",
            planRequired: false,
            limitReached: false,
        });
        const { user, form } = await openEdit("Milestone X dashboard");
        const name = within(form).getByLabelText(/^Name/);
        await user.clear(name);
        await user.type(name, "Other");
        await user.click(within(form).getByRole("button", { name: "Save changes" }));
        expect((await screen.findByRole("alert")).textContent).toContain("off the project");
        expect(screen.getByTestId("schedule-form")).toBeTruthy();
        expect(toastSuccess).not.toHaveBeenCalled();
    });
});

describe("Delete", () => {
    const askDelete = async (name: string) => {
        renderTab();
        const user = userEvent.setup();
        const own = await screen.findByRole("region", { name: c().own });
        fireEvent.click(within(own).getByRole("button", { name: deleteLabel(name) }));
        return { user, dialog: await screen.findByRole("alertdialog") };
    };

    it("asks first, says the page stays, and deletes nothing until yes", async () => {
        const { user, dialog } = await askDelete("Milestone X dashboard");
        expect(within(dialog).getByText(c().deleteTitle)).toBeTruthy();
        expect(
            within(dialog).getByText(fmt(c().deleteBody, { name: "Milestone X dashboard" }))
        ).toBeTruthy();
        expect(remove).not.toHaveBeenCalled();
        await user.click(within(dialog).getByRole("button", { name: actions().cancel }));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
        expect(remove).not.toHaveBeenCalled();
    });

    it("deletes the schedule on yes, says so, and reads the lists again", async () => {
        const { user, dialog } = await askDelete("Brand new dashboard");
        await user.click(within(dialog).getByRole("button", { name: actions().delete }));
        await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
        expect(remove).toHaveBeenCalledWith("tok", "team-1", "s-2");
        await waitFor(() =>
            expect(toastSuccess).toHaveBeenCalledWith(c().deleteDone, expect.anything())
        );
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
        expect(load.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("stays open with the reason when the delete fails", async () => {
        remove.mockResolvedValue({
            ok: false,
            gone: false,
            error: "Not allowed right now.",
            planRequired: false,
            limitReached: false,
        });
        const { user, dialog } = await askDelete("Brand new dashboard");
        await user.click(within(dialog).getByRole("button", { name: actions().delete }));
        expect(await within(dialog).findByText("Not allowed right now.")).toBeTruthy();
        expect(screen.getByRole("alertdialog")).toBeTruthy();
        expect(toastSuccess).not.toHaveBeenCalled();
    });

    it("treats a schedule that is already gone as done: closes and refreshes", async () => {
        remove.mockResolvedValue({
            ok: false,
            gone: true,
            error: null,
            planRequired: false,
            limitReached: false,
        });
        const { user, dialog } = await askDelete("Brand new dashboard");
        await user.click(within(dialog).getByRole("button", { name: actions().delete }));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
        expect(toastSuccess).not.toHaveBeenCalled();
        expect(load.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
});
