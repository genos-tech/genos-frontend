/**
 * MIP-2356: the "Custom dashboards by AI" tab of Task Stats.
 *
 * Pinned: the tab id is a real tab with a `?view=custom` deep link; own and shared dashboards are
 * listed separately with one row geometry; the open one is shown by the existing HTML note viewer
 * (never anything of our own); `?dashboard=<note>` opens one from a link; a dashboard that has not
 * run yet offers Run now and no viewer; Run now calls the schedule run endpoint and remounts the
 * viewer; "Open note" goes to the note; the empty, unavailable and error states are calm; nothing is
 * fetched off the Tasks route. Layout at 390 and 1440 px is checked in a real browser (see the PR).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CustomDashboardsTab } from "../features/tasks/components/dashboard/customDashboards/CustomDashboardsTab";
import {
    DASHBOARD_TABS,
    parseDashboardTab,
} from "../features/tasks/components/dashboard/dashboardTab";
import { TaskHomeTabBar } from "../features/tasks/components/dashboard/TaskHomeTabBar";
import {
    CustomDashboardsResult,
    loadCustomDashboards,
} from "../features/tasks/services/loadCustomDashboards";
import { getMessages } from "../i18n";
import { runScheduleNow } from "../services/schedules";

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/tasks/services/loadCustomDashboards", () => ({
    loadCustomDashboards: vi.fn(),
}));
vi.mock("../services/schedules", () => ({ runScheduleNow: vi.fn() }));
vi.mock("../components/ui/feedback/toastStore", () => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const viewerMounts = vi.hoisted(() => ({ n: 0 }));
vi.mock("../features/notes/common/components/HtmlNoteView", () => ({
    HtmlNoteView: (props: { noteId: number; noteType: number; title: string }) => {
        viewerMounts.n += 1;
        return (
            <div data-note={props.noteId} data-testid="note-viewer" data-type={props.noteType}>
                {props.title}
            </div>
        );
    },
}));

const load = vi.mocked(loadCustomDashboards);
const run = vi.mocked(runScheduleNow);

const READY: CustomDashboardsResult = {
    status: "ready",
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
};

const theme = createTheme({ cssVariables: true });

const Where = () => {
    const l = useLocation();
    return <div data-testid="where">{`${l.pathname}${l.search}`}</div>;
};

const renderTab = (at = "/workspace/tasks?view=custom") =>
    render(
        <ThemeProvider theme={{ [THEME_ID]: theme }}>
            <CssVarsProvider>
                <MemoryRouter initialEntries={[at]}>
                    <Where />
                    <Routes>
                        <Route element={<CustomDashboardsTab teamId="team-1" />} path="*" />
                    </Routes>
                </MemoryRouter>
            </CssVarsProvider>
        </ThemeProvider>
    );

const c = () => getMessages().tasks.dashboard.customDashboards;

beforeEach(() => {
    vi.clearAllMocks();
    viewerMounts.n = 0;
    load.mockResolvedValue(READY);
});

describe("the tab id", () => {
    it("is a dashboard tab with a ?view=custom deep link", () => {
        expect(DASHBOARD_TABS).toContain("custom");
        expect(parseDashboardTab("custom")).toBe("custom");
    });

    it("is in the strip with its own label", () => {
        const setActiveTab = vi.fn();
        render(
            <ThemeProvider theme={{ [THEME_ID]: theme }}>
                <CssVarsProvider>
                    <TaskHomeTabBar activeTab="today" setActiveTab={setActiveTab} />
                </CssVarsProvider>
            </ThemeProvider>
        );
        fireEvent.click(
            screen.getByRole("tab", { name: getMessages().tasks.dashboard.tabCustomDashboards })
        );
        expect(setActiveTab).toHaveBeenCalledWith("custom");
    });
});

describe("the lists and the viewer", () => {
    it("lists own and shared separately and opens the first own dashboard with a page", async () => {
        renderTab();
        const rows = await screen.findAllByTestId("custom-dashboard-row");
        expect(rows).toHaveLength(3);
        const own = screen.getByRole("region", { name: c().own });
        const shared = screen.getByRole("region", { name: c().shared });
        expect(within(own).getAllByTestId("custom-dashboard-row")).toHaveLength(2);
        expect(within(shared).getAllByTestId("custom-dashboard-row")).toHaveLength(1);
        expect(within(shared).getByText("Team progress")).toBeTruthy();
        expect(within(shared).getByText(/Ana/)).toBeTruthy();
        const viewer = screen.getByTestId("note-viewer");
        expect(viewer.getAttribute("data-note")).toBe("11");
        // A My Note, shown by the existing note viewer.
        expect(viewer.getAttribute("data-type")).toBe("1");
    });

    it("says a dashboard has not run yet instead of a time", async () => {
        renderTab();
        await screen.findAllByTestId("custom-dashboard-row");
        expect(screen.getByText(c().notRun)).toBeTruthy();
    });

    it("opens a shared dashboard on click and writes it to the address", async () => {
        renderTab();
        fireEvent.click(await screen.findByText("Team progress"));
        expect(screen.getByTestId("note-viewer").getAttribute("data-note")).toBe("21");
        expect(screen.getByTestId("where").textContent).toContain("dashboard=21");
        // A shared dashboard is not the member's schedule: no Run now.
        expect(screen.queryByRole("button", { name: c().runNow })).toBeNull();
        expect(screen.getByRole("button", { name: c().openNote })).toBeTruthy();
    });

    it("opens the dashboard a link names", async () => {
        renderTab("/workspace/tasks?view=custom&dashboard=21");
        await screen.findAllByTestId("custom-dashboard-row");
        expect(screen.getByTestId("note-viewer").getAttribute("data-note")).toBe("21");
    });

    it("ignores a link to a dashboard the member cannot see and falls back to the first", async () => {
        renderTab("/workspace/tasks?view=custom&dashboard=999");
        await screen.findAllByTestId("custom-dashboard-row");
        expect(screen.getByTestId("note-viewer").getAttribute("data-note")).toBe("11");
    });

    it("shows a dashboard that has not run with Run now and no viewer", async () => {
        renderTab();
        fireEvent.click(await screen.findByText("Brand new dashboard"));
        expect(screen.queryByTestId("note-viewer")).toBeNull();
        expect(screen.getByText(c().notRunTitle)).toBeTruthy();
        expect(screen.getByRole("button", { name: c().runNow })).toBeTruthy();
        expect(screen.queryByRole("button", { name: c().openNote })).toBeNull();
    });

    it("sends Open note of a shared dashboard to the shared notes", async () => {
        renderTab();
        fireEvent.click(await screen.findByText("Team progress"));
        fireEvent.click(screen.getByRole("button", { name: c().openNote }));
        expect(screen.getByTestId("where").textContent).toBe("/workspace/notes/shared/21");
    });

    it("keeps the dashboard open that was run for the first time", async () => {
        run.mockResolvedValue({
            ok: true,
            outcome: { status: "ok", error: "", title: "", items: 0 },
        });
        renderTab();
        fireEvent.click(await screen.findByText("Brand new dashboard"));
        load.mockResolvedValue({
            status: "ready",
            data: {
                ...(READY.status === "ready" ? READY.data : { own: [], shared: [] }),
                own: [
                    ...(READY.status === "ready" ? READY.data.own.slice(0, 1) : []),
                    {
                        scheduleId: "s-2",
                        name: "Brand new dashboard",
                        enabled: true,
                        lastRun: "2026-11-25T08:00:00+09:00",
                        lastStatus: "ok",
                        note: { noteId: 12, noteType: "personal", title: "Brand new page" },
                    },
                ],
            },
        });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: c().runNow }));
        });
        await waitFor(() =>
            expect(screen.getByTestId("note-viewer").getAttribute("data-note")).toBe("12")
        );
    });

    it("sends Open note to the note", async () => {
        renderTab();
        await screen.findAllByTestId("custom-dashboard-row");
        fireEvent.click(screen.getByRole("button", { name: c().openNote }));
        expect(screen.getByTestId("where").textContent).toBe("/workspace/notes/my/11");
    });
});

describe("Run now", () => {
    it("runs the schedule and remounts the viewer on success", async () => {
        run.mockResolvedValue({
            ok: true,
            outcome: { status: "ok", error: "", title: "", items: 0 },
        });
        renderTab();
        await screen.findAllByTestId("custom-dashboard-row");
        const before = viewerMounts.n;
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: c().runNow }));
        });
        expect(run).toHaveBeenCalledWith("tok", "team-1", "s-1");
        await waitFor(() => expect(viewerMounts.n).toBeGreaterThan(before));
        // The lists are read again.
        await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    });

    it("says why a run failed and keeps the viewer", async () => {
        const { toast } = await import("../components/ui/feedback/toastStore");
        run.mockResolvedValue({
            ok: true,
            outcome: { status: "failed", error: "No AI credits left.", title: "", items: 0 },
        });
        renderTab();
        await screen.findAllByTestId("custom-dashboard-row");
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: c().runNow }));
        });
        expect(toast.error).toHaveBeenCalledWith("No AI credits left.", expect.anything());
        expect(screen.getByTestId("note-viewer")).toBeTruthy();
    });
});

describe("the calm states", () => {
    it("empty", async () => {
        load.mockResolvedValue({ status: "ready", data: { own: [], shared: [] } });
        renderTab();
        expect(await screen.findByText(c().emptyTitle)).toBeTruthy();
        expect(screen.queryByTestId("note-viewer")).toBeNull();
    });

    it("an API without the endpoint", async () => {
        load.mockResolvedValue({ status: "unavailable" });
        renderTab();
        expect(await screen.findByText(c().unavailableTitle)).toBeTruthy();
    });

    it("an error has a retry that loads again", async () => {
        load.mockResolvedValueOnce({ status: "error" });
        renderTab();
        fireEvent.click(await screen.findByRole("button", { name: c().retry }));
        expect(await screen.findAllByTestId("custom-dashboard-row")).toHaveLength(3);
    });

    it("fetches nothing while another service is on screen", () => {
        renderTab("/workspace/chat");
        expect(load).not.toHaveBeenCalled();
    });
});
