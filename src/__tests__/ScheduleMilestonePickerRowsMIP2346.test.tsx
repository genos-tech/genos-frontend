/**
 * The schedule form's milestone dropdown follows the Project updates picker (MIP-2346):
 * each row says what a milestone IS (status, id, due date, progress), the closed field
 * carries the chosen milestone's status, and the unavailable / loading rows still work.
 *
 * jsdom draws no layout: how it looks was checked in a browser (see the PR).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MilestoneParamSelect } from "../components/layout/schedules/ScheduleParamPickers";
import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";

vi.setConfig({ testTimeout: 30000 });

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const loadProjectMilestones = vi.fn();
vi.mock("../features/tasks/sprint-milestone/services/loadProjectMilestones", () => ({
    loadProjectMilestones: (...a: unknown[]) => loadProjectMilestones(...a),
}));

const PROJECTS = [
    { projectId: 11, projectName: "Apollo", projectTags: [], isJoined: true },
    { projectId: 12, projectName: "Borealis", projectTags: [], isJoined: true },
];

const MILESTONES = {
    11: [
        {
            milestoneId: 501,
            title: "Launch",
            status: "WIP",
            displayId: "APO-7",
            dueDate: "2020-01-05",
            tasksTotal: 8,
            tasksClosed: 3,
        },
        { milestoneId: 502, title: "Old thing", status: "Closed", displayId: "APO-2" },
    ],
    12: [
        // nothing optional: no due date, no tasks counted
        { milestoneId: 601, title: "Beta", status: "Open", displayId: "BOR-1" },
        {
            milestoneId: 602,
            title: "Later",
            status: "Pending",
            displayId: "BOR-4",
            dueDate: "2099-12-31",
            tasksTotal: 4,
            tasksClosed: 4,
        },
    ],
} as Record<number, unknown[]>;

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

const renderPicker = (value: string, onChange = vi.fn()) =>
    rtlRender(
        <CssVarsProvider>
            <HashMentionDataProvider value={mention()}>
                <MilestoneParamSelect value={value} onChange={onChange} />
            </HashMentionDataProvider>
        </CssVarsProvider>
    );

const row = (name: string) =>
    screen.getAllByRole("option").find((o) => within(o).queryByText(name) !== null) as HTMLElement;

beforeEach(() => {
    loadProjectMilestones.mockReset();
    loadProjectMilestones.mockImplementation(async (projectId: number) => ({
        milestones: MILESTONES[projectId] ?? [],
    }));
});

const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await waitFor(() => expect(loadProjectMilestones).toHaveBeenCalledTimes(2));
    await user.click(await screen.findByRole("combobox"));
    await screen.findAllByRole("option");
};

describe("milestone dropdown rows (MIP-2346)", () => {
    it("shows a status chip and the id on every row", async () => {
        renderPicker("");
        const user = userEvent.setup();
        await open(user);
        for (const [title, status, id] of [
            ["Launch", "WIP", "APO-7"],
            ["Beta", "Open", "BOR-1"],
            ["Later", "Pending", "BOR-4"],
        ]) {
            const r = row(title);
            expect(within(r).getByText(status), `${title} status`).toBeTruthy();
            expect(within(r).getByText(id), `${title} id`).toBeTruthy();
        }
    });

    it("shows the due date (overdue marked in words) and progress only when present", async () => {
        renderPicker("");
        const user = userEvent.setup();
        await open(user);
        const launch = row("Launch");
        expect(within(launch).getByText(/^Overdue/)).toBeTruthy();
        expect(within(launch).getByText("3/8 done")).toBeTruthy();
        const later = row("Later");
        expect(within(later).getByText(/^Due/)).toBeTruthy();
        expect(within(later).queryByText(/^Overdue/)).toBeNull();
        expect(within(later).getByText("4/4 done")).toBeTruthy();
        const beta = row("Beta");
        expect(within(beta).queryByText(/^Due|^Overdue/)).toBeNull();
        expect(within(beta).queryByText(/done$/)).toBeNull();
    });

    it("hides finished milestones unless already chosen, and the chosen one keeps its row", async () => {
        const first = renderPicker("");
        const user = userEvent.setup();
        await open(user);
        expect(screen.queryByText("Old thing")).toBeNull();
        first.unmount();

        renderPicker("502");
        await waitFor(() => expect(loadProjectMilestones).toHaveBeenCalledTimes(4));
        await user.click(await screen.findByRole("combobox"));
        const r = row("Old thing");
        expect(within(r).getByText("Closed")).toBeTruthy();
        expect(within(r).queryByText(/^Overdue/)).toBeNull();
    });

    it("carries the chosen milestone's status in the closed field", async () => {
        renderPicker("601");
        await waitFor(() => expect(loadProjectMilestones).toHaveBeenCalledTimes(2));
        const input = await screen.findByRole("combobox");
        await waitFor(() => expect((input as HTMLInputElement).value).toBe("Borealis / Beta"));
        expect(screen.getByRole("img", { name: "Open" })).toBeTruthy();
    });

    it("finds a milestone by its id as well as its title", async () => {
        renderPicker("");
        const user = userEvent.setup();
        await open(user);
        await user.type(screen.getByRole("combobox"), "BOR-4");
        const rows = screen.getAllByRole("option");
        expect(rows).toHaveLength(1);
        expect(within(rows[0]).getByText("Later")).toBeTruthy();
    });

    it("still shows a lost milestone as (unavailable), without chips", async () => {
        renderPicker("9999");
        await waitFor(() => expect(loadProjectMilestones).toHaveBeenCalledTimes(2));
        const input = await screen.findByRole("combobox");
        await waitFor(() => expect((input as HTMLInputElement).value).toBe("(unavailable)"));
        expect(screen.queryByRole("img")).toBeNull();
    });

    it("says it is loading while the lists are on their way", async () => {
        loadProjectMilestones.mockImplementation(() => new Promise(() => {}));
        renderPicker("9999");
        const input = await screen.findByRole("combobox");
        expect((input as HTMLInputElement).value).toBe("Loading milestones…");
    });
});
