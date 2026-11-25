/**
 * MIP-2357, part two: a Share icon beside Run now on an own dashboard that has a page. It opens the
 * note's EXISTING share dialog (no sharing system of our own) with a warning that the dashboard
 * checks every reader at each run, and reads that note's members as it opens.
 *
 * Pinned: the icon exists only for an own dashboard with a page, and only where the host passes the
 * notes manager; it loads THIS note's members and opens the dialog for this note as a My note, with
 * the warning; closing leaves nothing open. The dialog itself is the Notes page's, so it is stubbed
 * here; its `notice` line is pinned separately on the real dialog.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    CustomDashboardsTab,
    type DashboardShareHost,
} from "../features/tasks/components/dashboard/customDashboards/CustomDashboardsTab";
import { loadCustomDashboards } from "../features/tasks/services/loadCustomDashboards";
import { fmt, getMessages } from "../i18n";

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
vi.mock("../components/ui/feedback/toastStore", () => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock("../features/notes/common/components/HtmlNoteView", () => ({
    HtmlNoteView: () => <div data-testid="note-viewer" />,
}));
// The Notes page's dialog, stubbed: what the tab hands it is what matters here.
vi.mock("../features/notes/common/components/ModalNoteSharing", () => ({
    ModalNoteSharing: (props: {
        noteId: number;
        noteType: number;
        noteTitle: string;
        notice?: string;
        onClose: () => void;
    }) => (
        <div
            data-note={props.noteId}
            data-note-type={props.noteType}
            data-testid="share-dialog"
            data-title={props.noteTitle}
        >
            <p data-testid="share-notice">{props.notice}</p>
            <button type="button" onClick={props.onClose}>
                done
            </button>
        </div>
    ),
}));

const load = vi.mocked(loadCustomDashboards);
const loadNoteMembers = vi.fn(async () => undefined);

const host = (): DashboardShareHost =>
    ({
        myself: { userId: "u1", teamId: "team-1" },
        setMyself: vi.fn(),
        socket: null,
        teamMembers: [],
        useCM: {},
        useUISM: {},
        useNM: { loadNoteMembers, currentNoteMembers: [] },
    }) as unknown as DashboardShareHost;

const READY = {
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
};

const theme = createTheme({ cssVariables: true });
const renderTab = (share?: DashboardShareHost) =>
    render(
        <ThemeProvider theme={{ [THEME_ID]: theme }}>
            <CssVarsProvider>
                <MemoryRouter initialEntries={["/workspace/tasks?view=custom"]}>
                    <CustomDashboardsTab share={share} teamId="team-1" />
                </MemoryRouter>
            </CssVarsProvider>
        </ThemeProvider>
    );

const c = () => getMessages().tasks.dashboard.customDashboards;

beforeEach(() => {
    vi.clearAllMocks();
    load.mockResolvedValue(READY);
});

describe("the Share icon", () => {
    it("is beside Run now for an own dashboard that has a page", async () => {
        renderTab(host());
        const viewer = await screen.findByTestId("custom-dashboard-viewer");
        const share = within(viewer).getByTestId("custom-dashboard-header-share");
        expect(share).toHaveAccessibleName(fmt(c().shareNamed, { name: "Milestone X dashboard" }));
        expect(within(viewer).getByRole("button", { name: c().runNow })).toBeTruthy();
    });

    it("is not there when the host has no notes manager", async () => {
        renderTab(undefined);
        const viewer = await screen.findByTestId("custom-dashboard-viewer");
        expect(within(viewer).queryByTestId("custom-dashboard-header-share")).toBeNull();
    });

    it("is not there before the page exists, or on a shared dashboard", async () => {
        renderTab(host());
        await screen.findByTestId("custom-dashboard-viewer");
        // Rows: own with a page, own without, shared.
        fireEvent.click(screen.getAllByTestId("custom-dashboard-row")[1]);
        await waitFor(() =>
            expect(screen.getByTestId("custom-dashboard-viewer")).toHaveTextContent(
                c().notRunTitle
            )
        );
        expect(screen.queryByTestId("custom-dashboard-header-share")).toBeNull();
        fireEvent.click(screen.getAllByTestId("custom-dashboard-row")[2]);
        await waitFor(() => expect(screen.getByTestId("note-viewer")).toBeTruthy());
        expect(screen.queryByTestId("custom-dashboard-header-share")).toBeNull();
    });
});

describe("pressing it", () => {
    it("reads THIS note's members and opens the share dialog for it, with the warning", async () => {
        renderTab(host());
        fireEvent.click(await screen.findByTestId("custom-dashboard-header-share"));
        const dialog = await screen.findByTestId("share-dialog");
        expect(dialog).toHaveAttribute("data-note", "11");
        // A My note (type 1): team-folder notes are the same slot.
        expect(dialog).toHaveAttribute("data-note-type", "1");
        expect(dialog).toHaveAttribute("data-title", "Milestone X dashboard");
        expect(screen.getByTestId("share-notice")).toHaveTextContent(c().shareNotice);
        expect(loadNoteMembers).toHaveBeenCalledWith(1, 11);
    });

    it("closes with nothing left open", async () => {
        renderTab(host());
        fireEvent.click(await screen.findByTestId("custom-dashboard-header-share"));
        fireEvent.click(await screen.findByRole("button", { name: "done" }));
        await waitFor(() => expect(screen.queryByTestId("share-dialog")).toBeNull());
    });
});
