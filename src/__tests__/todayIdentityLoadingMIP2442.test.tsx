/**
 * MIP-2442: each Today list is recognisable by its look, the wait for Today is visibly moving, and
 * switching Pace between Day and Week keeps the old bars (dimmed, with their OWN labels) under a
 * loading sign. The looks themselves are judged on screenshots (see the PR): jsdom draws nothing.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskVelocitySection } from "../features/tasks/components/dashboard/TaskVelocitySection";
import type { VelocityPoint } from "../features/tasks/services/loadTaskVelocity";
import { normaliseBriefing } from "../features/today/briefingToday";
import { TodayBriefing } from "../features/today/TodayBriefing";
import { en } from "../i18n/locales/en";

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => null }));
vi.mock("../context/HashMentionDataContext", () => ({
    useHashMentionData: () => ({ allChats: [], projects: [] }),
}));

const loadMock = vi.hoisted(() => vi.fn());
vi.mock("../features/tasks/services/loadTaskVelocity", () => ({ loadTaskVelocity: loadMock }));

const copy = en.tasks.dashboard.today;

const task = (taskId: number) => ({
    taskId,
    projectId: 1,
    displayId: `WEB-${taskId}`,
    title: `Task ${taskId}`,
});

const view = (status: "loading" | "ready", data: ReturnType<typeof normaliseBriefing> | null) => ({
    status,
    data,
    since: null,
    refresh: vi.fn(),
});

const renderToday = (v: ReturnType<typeof view>) =>
    render(
        <CssVarsProvider>
            <TodayBriefing view={v} />
        </CssVarsProvider>
    );

beforeEach(() => loadMock.mockReset());

describe("Today while it loads", () => {
    it("shows moving dots beside the words over a page-shaped skeleton", () => {
        renderToday(view("loading", null));
        const status = screen.getByRole("status");
        expect(status).toHaveTextContent(copy.states.loading);
        expect(screen.getByTestId("loading-dots").children).toHaveLength(3);
        // The shapes are decoration: only the status line is announced.
        expect(
            screen.getByTestId("today-skeleton").querySelector("[aria-hidden='true']")
        ).not.toBeNull();
    });
});

describe("the Today lists", () => {
    const data = normaliseBriefing({
        window: { since: "x", until: "y", timeZone: "UTC", localDate: "2026-11-28" },
        overdue: [task(1)],
        suggestedNext: [task(2)],
        mentions: [{ source: "chat", at: "2026-11-28T00:00:00Z" }],
        changed: {
            items: [
                { type: "note", latestAt: "2026-11-28T00:00:00Z", eventsTotal: 1, latest: {} },
            ],
            total: 1,
            truncated: false,
        },
        blocked: [{ ...task(3), waitingFor: [] }],
        delegated: [task(4)],
    });

    const section = (title: string) => screen.getByRole("region", { name: title });

    it("gives every list its own icon", () => {
        renderToday(view("ready", data));
        const icons = Array.from(screen.getAllByTestId("today-section-badge")).map((b) =>
            b.querySelector("svg")?.getAttribute("data-testid")
        );
        expect(icons).toHaveLength(6);
        expect(new Set(icons).size).toBe(6);
    });

    it("draws what waits on me and what I wait on as opposites", () => {
        renderToday(view("ready", data));
        expect(section(copy.sections.waiting).getAttribute("data-court")).toBe("mine");
        expect(section(copy.sections.blocked).getAttribute("data-court")).toBe("others");
        expect(section(copy.sections.delegated).getAttribute("data-court")).toBe("others");
    });

    it("colours the due list red only when something is overdue", () => {
        const { unmount } = renderToday(view("ready", data));
        expect(section(copy.sections.due).getAttribute("data-hue")).toBe("danger");
        unmount();
        renderToday(
            view("ready", normaliseBriefing({ window: data.window, dueToday: [task(1)] }))
        );
        expect(section(copy.sections.due).getAttribute("data-hue")).toBe("warning");
    });
});

describe("Pace, Day to Week", () => {
    const DAY: VelocityPoint[] = [
        { date: "2026-07-01", created: 2, started: 1, closed: 0, updated: 3 },
    ];
    const renderPace = () =>
        render(
            <CssVarsProvider>
                <TaskVelocitySection
                    isDark={false}
                    taskIds={[1]}
                    teamId="team"
                    textMuted="#999"
                    textPrimary="#000"
                    textSecondary="#333"
                />
            </CssVarsProvider>
        );
    const press = (label: string) =>
        fireEvent.click(
            screen.getByText(label).closest(".MuiChip-root")!.querySelector("button")!
        );

    it("keeps the day bars and their labels, dimmed under a loading sign, until weeks arrive", async () => {
        let answer: (v: VelocityPoint[]) => void = () => {};
        loadMock
            .mockResolvedValueOnce(DAY)
            .mockImplementationOnce(
                () => new Promise<VelocityPoint[]>((resolve) => (answer = resolve))
            );
        renderPace();
        await screen.findByText("7/1");
        expect(screen.queryByTestId("pace-loading")).toBeNull();

        press(en.tasks.dashboard.velocity.week);

        expect(screen.getByTestId("pace-loading")).toHaveTextContent(en.common.feedback.loading);
        expect(screen.getByTestId("pace-series").getAttribute("aria-busy")).toBe("true");
        expect(screen.getByText("7/1")).toBeInTheDocument();

        await act(async () => answer([{ ...DAY[0], date: "2026-06-29" }]));
        await waitFor(() => expect(screen.queryByTestId("pace-loading")).toBeNull());
        expect(screen.queryByText("7/1")).toBeNull();
        expect(screen.getByTestId("pace-series").getAttribute("aria-busy")).toBe("false");
    });
});
