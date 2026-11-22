import { act } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MilestoneProgressTab } from "../features/tasks/components/dashboard/milestoneProgress/MilestoneProgressTab";
import { loadTaskProgress } from "../features/tasks/services/loadTaskProgress";
import { EffectiveTask } from "../features/tasks/utils/effectiveTasks";
import { fmt, I18nProvider, loadLocale } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";

// MIP-1187: the Milestones tab of the Tasks dashboard. Mounts the real tab with seeded
// task rows; the progress request is stubbed so the expand-to-load path is exercised.

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));
vi.mock("../features/tasks/services/loadTaskProgress", () => ({
    loadTaskProgress: vi.fn(),
}));

const NOW_ISO = new Date().toISOString();
const daysFromToday = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const row = (over: Partial<EffectiveTask> & { id: string }) =>
    ({
        title: `Task ${over.id}`,
        status: "Open",
        effectiveStatus: "Open",
        effectiveCloseDate: null,
        dueDate: null,
        milestoneId: 7,
        isMilestone: false,
        assigneeName: "Dana",
        lastProgressAt: null,
        ...over,
    }) as unknown as EffectiveTask;

const milestone = {
    milestoneId: 7,
    taskId: 700,
    projectId: 3,
    title: "Beta launch",
    status: "WIP",
    sprintId: null,
    dueDate: daysFromToday(-3),
} as never;

const tasks: EffectiveTask[] = [
    row({ id: "700", isMilestone: true, lastProgressAt: NOW_ISO }),
    row({ id: "1", effectiveStatus: "Closed", status: "Closed" }),
    row({ id: "2", effectiveStatus: "WIP", status: "WIP", dueDate: daysFromToday(-2) }),
    row({ id: "3", effectiveStatus: "Blocked", status: "Blocked" }),
    row({ id: "4", effectiveStatus: "Open", status: "Open", dueDate: daysFromToday(4) }),
];

const mount = (list: EffectiveTask[] = tasks, milestones = [milestone], loaded = true) =>
    render(
        <CssVarsProvider>
            <I18nProvider>
                <MemoryRouter>
                    <MilestoneProgressTab
                        effectiveTasks={list}
                        milestones={milestones as never}
                        milestonesLoaded={loaded}
                        sprints={[]}
                    />
                </MemoryRouter>
            </I18nProvider>
        </CssVarsProvider>
    );

const mountIn = async (locale: "fr" | "ar") => {
    await loadLocale(locale);
    window.localStorage.setItem("genos-locale", locale);
    const view = mount();
    await act(async () => {
        for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });
    return view;
};

const progressEntry = {
    activityId: 9,
    actionType: "status_changed",
    fieldName: "status",
    oldValue: null,
    newValue: "Closed",
    metadata: {},
    actor: { userId: "u1", userName: "Ken", avatarImgPath: null },
    tsCreatedAt: NOW_ISO,
    sourceTask: {
        id: "2",
        displayId: "MIP-2",
        title: "Write docs",
        isMilestone: false,
        isDeleted: false,
    },
} as never;

// A legend entry of the shared ProportionBar: the label and the count are two elements, so
// match on the entry's own text ("Blocked 1").
const legendItem = (text: string): HTMLElement | null =>
    screen
        .queryAllByRole("listitem")
        .find((li) => li.textContent?.replace(/\s+/g, "") === text.replace(/\s+/g, "")) ?? null;

describe("MilestoneProgressTab (MIP-1187)", () => {
    beforeEach(() => {
        vi.mocked(loadTaskProgress).mockReset();
        window.localStorage.removeItem("genos-locale");
    });

    it("shows the summary numbers and the milestone's due line", () => {
        mount();
        // Each StatTile is a value above its label ("1" with "/ 4" beside it for closed).
        const value = (label: string) =>
            screen.getAllByText(label)[0].previousElementSibling?.textContent;
        expect(value("Tasks closed")).toBe("1/ 4");
        expect(value("Overdue tasks")).toBe("1");
        expect(value("Blocked")).toBe("1");
        expect(screen.getByText("Beta launch")).toBeTruthy();
        expect(screen.getByText("Overdue by 3 days")).toBeTruthy();
        expect(screen.getByText("1 of 4 closed")).toBeTruthy();
    });

    it("reads the progress by status with an accessible bar", () => {
        mount();
        expect(screen.getByRole("img", { name: "1 of 4 closed" })).toBeTruthy();
        expect(legendItem("Blocked 1")).toBeTruthy();
        // The dashboard's word for Closed, not the stored status name.
        expect(legendItem("Completed 1")).toBeTruthy();
        expect(legendItem("In Progress 1")).toBeTruthy();
        expect(legendItem("Closed 1")).toBeNull();
    });

    it("names the legend statuses in the active locale", async () => {
        await mountIn("fr");
        const fr = await loadLocale("fr");
        expect(legendItem(`${fr.tasks.dashboard.statusLabels.blocked} 1`)).toBeTruthy();
        expect(legendItem("Blocked 1")).toBeNull();
    });

    it("shows a skeleton, not the empty text, until the milestones have loaded", () => {
        mount(tasks, [], false);
        expect(screen.queryByText("No ongoing milestones in this project.")).toBeNull();
        expect(document.querySelector('[data-skeleton="lines"]')).toBeTruthy();
    });

    it("lists what needs attention once the card is opened, and loads recent progress then", async () => {
        vi.mocked(loadTaskProgress).mockResolvedValue({
            entries: [
                {
                    activityId: 9,
                    actionType: "status_changed",
                    fieldName: "status",
                    oldValue: null,
                    newValue: "Closed",
                    metadata: {},
                    actor: { userId: "u1", userName: "Ken", avatarImgPath: null },
                    tsCreatedAt: NOW_ISO,
                    sourceTask: {
                        id: "2",
                        displayId: "MIP-2",
                        title: "Write docs",
                        isMilestone: false,
                        isDeleted: false,
                    },
                } as never,
            ],
            nextCursor: null,
        });
        mount();
        expect(loadTaskProgress).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Show details for Beta launch" }));

        expect(screen.getByText("Needs attention")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Task 2" }).getAttribute("href")).toBe(
            "/workspace/tasks/project/3/task/2"
        );
        expect(screen.getByText("Task 3")).toBeTruthy();
        await waitFor(() => expect(screen.getByText("Write docs")).toBeTruthy());
        expect(screen.getByRole("link", { name: /MIP-2/ }).getAttribute("href")).toBe(
            "/workspace/tasks/project/3/task/2"
        );
        expect(screen.getByText("by Ken")).toBeTruthy();
        expect(loadTaskProgress).toHaveBeenCalledWith(
            "test-token",
            700,
            expect.objectContaining({ minDepth: 1, limit: 5 })
        );
    });

    it("shows the empty state when the project has no ongoing milestone", () => {
        mount(tasks, []);
        expect(screen.getByText("No ongoing milestones in this project.")).toBeTruthy();
    });

    it("does not call the progress feed or show Loading for a milestone with no backing task", () => {
        mount(tasks, [{ ...(milestone as object), taskId: null } as never]);
        fireEvent.click(screen.getByRole("button", { name: "Show details for Beta launch" }));
        expect(loadTaskProgress).not.toHaveBeenCalled();
        expect(screen.queryByText("Recent progress")).toBeNull();
        expect(document.querySelector('[data-skeleton="lines"]')).toBeNull();
    });

    it("shows an error state for a failed read and Retry reads again", async () => {
        vi.mocked(loadTaskProgress).mockResolvedValueOnce(null);
        mount();
        fireEvent.click(screen.getByRole("button", { name: "Show details for Beta launch" }));
        await waitFor(() =>
            expect(screen.getByText("Couldn't load recent progress")).toBeTruthy()
        );
        expect(document.querySelector('[data-error="milestone-recent"]')).toBeTruthy();

        vi.mocked(loadTaskProgress).mockResolvedValueOnce({
            entries: [progressEntry],
            nextCursor: null,
        });
        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        await waitFor(() => expect(screen.getByText("Write docs")).toBeTruthy());
        expect(loadTaskProgress).toHaveBeenCalledTimes(2);
    });

    it("keeps the rows on screen when a later refresh fails", async () => {
        vi.mocked(loadTaskProgress).mockResolvedValueOnce({
            entries: [progressEntry],
            nextCursor: null,
        });
        mount();
        fireEvent.click(screen.getByRole("button", { name: "Show details for Beta launch" }));
        await waitFor(() => expect(screen.getByText("Write docs")).toBeTruthy());
        vi.mocked(loadTaskProgress).mockResolvedValueOnce(null);
        fireEvent.click(screen.getByRole("button", { name: "Hide details for Beta launch" }));
        fireEvent.click(screen.getByRole("button", { name: "Show details for Beta launch" }));
        await waitFor(() => expect(loadTaskProgress).toHaveBeenCalledTimes(2));
        expect(screen.getByText("Write docs")).toBeTruthy();
    });

    it("reads a never-touched milestone as stalled once it is old enough", () => {
        const old = {
            ...(milestone as object),
            tsCreatedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
        };
        mount([row({ id: "700", isMilestone: true })], [old as never]);
        expect(screen.getByText("No progress for 30 days")).toBeTruthy();
    });
});

describe("milestone progress plurals", () => {
    it("says two days in Arabic with the dual, not a plural noun", () => {
        expect(
            fmt(ar.tasks?.dashboard?.milestoneProgress?.overdueBy as string, { count: 2 }, "ar")
        ).toContain("يومين");
        expect(
            fmt(ar.tasks?.dashboard?.milestoneProgress?.dueIn as string, { count: 2 }, "ar")
        ).toContain("يومين");
        expect(fmt(en.tasks.dashboard.milestoneProgress.overdueBy, { count: 3 }, "en")).toBe(
            "Overdue by 3 days"
        );
    });
});
