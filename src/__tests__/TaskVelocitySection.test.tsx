/**
 * TaskVelocitySection — the dashboard "Velocity" card.
 *
 * Covers the wiring the pure backend test can't: the loader is called
 * with the right args, the Day/Week toggle refetches with the new
 * granularity, the chart renders legend + bars from the fixture, the
 * totals line sums the series, and the empty-task-ids case short-circuits
 * without a fetch.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskVelocitySection } from "../features/tasks/components/dashboard/TaskVelocitySection";
import type { VelocityPoint } from "../features/tasks/services/loadTaskVelocity";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));

const loadMock = vi.hoisted(() => vi.fn());
vi.mock("../features/tasks/services/loadTaskVelocity", () => ({
    loadTaskVelocity: loadMock,
}));

const FIXTURE: VelocityPoint[] = [
    { date: "2026-07-01", created: 2, started: 1, closed: 0, updated: 3 },
    { date: "2026-07-02", created: 0, started: 2, closed: 1, updated: 4 },
];

const baseProps = {
    taskIds: [1, 2, 3],
    teamId: "team-1",
    isDark: false,
    textPrimary: "#000",
    textSecondary: "#333",
    textMuted: "#999",
};

const renderSection = (props: Partial<React.ComponentProps<typeof TaskVelocitySection>> = {}) =>
    render(
        <CssVarsProvider>
            <TaskVelocitySection {...baseProps} {...props} />
        </CssVarsProvider>
    );

beforeEach(() => {
    loadMock.mockReset();
    loadMock.mockResolvedValue(FIXTURE);
});

describe("TaskVelocitySection", () => {
    it("fetches on mount and renders the legend + bars + totals", async () => {
        renderSection();

        await waitFor(() => expect(loadMock).toHaveBeenCalledTimes(1));
        // Loader args: (taskIds, start, end, granularity, teamId, token)
        const call = loadMock.mock.calls[0];
        expect(call[0]).toEqual([1, 2, 3]);
        expect(call[3]).toBe("day");
        expect(call[4]).toBe("team-1");
        expect(call[5]).toBe("test-token");

        // Legend labels for all four series.
        await screen.findByText("Created");
        expect(screen.getByText("Started")).toBeInTheDocument();
        expect(screen.getByText("Closed")).toBeInTheDocument();
        expect(screen.getByText("Updated")).toBeInTheDocument();

        // One <rect> per non-zero (bucket, series) cell — zeros are
        // skipped. Bucket1 has 3 non-zero (created/started/updated),
        // bucket2 has 3 (started/closed/updated) → 6.
        const bars = document.querySelectorAll("rect");
        expect(bars.length).toBe(6);

        // Totals: created 2, started 3, closed 1, updated 7.
        expect(screen.getByText(/2 created, 3 started, 1 closed, 7 updated/)).toBeInTheDocument();
    });

    it("passes the sprint window when provided", async () => {
        renderSection({ windowStart: "2026-06-01", windowEnd: "2026-06-14" });
        await waitFor(() => expect(loadMock).toHaveBeenCalled());
        const call = loadMock.mock.calls[0];
        expect(call[1]).toBe("2026-06-01");
        expect(call[2]).toBe("2026-06-14");
    });

    it("refetches with week granularity when the Week toggle is clicked", async () => {
        renderSection();
        await waitFor(() => expect(loadMock).toHaveBeenCalledTimes(1));

        // MUI Joy Chip puts its onClick on an inner action <button>, not
        // the label span — click that so the toggle actually fires.
        const weekChip = screen.getByText("Week").closest(".MuiChip-root");
        const weekButton = weekChip?.querySelector("button");
        fireEvent.click(weekButton as HTMLElement);

        await waitFor(() => expect(loadMock).toHaveBeenCalledTimes(2));
        expect(loadMock.mock.calls[1][3]).toBe("week");
    });

    it("shows the empty state and does not fetch when there are no tasks", async () => {
        renderSection({ taskIds: [] });
        // Empty state copy from the chart.
        await screen.findByText(/No task activity in this window/);
        expect(loadMock).not.toHaveBeenCalled();
    });

    it("scopes the fetch to a member's task subset when one is picked", async () => {
        const members = [
            { id: "u1", name: "Alice", taskIds: [1, 2] },
            { id: "u2", name: "Bob", taskIds: [3] },
        ];
        renderSection({ taskIds: [1, 2, 3], members });

        // First fetch = all sprint tasks.
        await waitFor(() => expect(loadMock).toHaveBeenCalledTimes(1));
        expect(loadMock.mock.calls[0][0]).toEqual([1, 2, 3]);

        // Pick Bob from the assignee Select (Joy Select renders an
        // options listbox on open).
        fireEvent.mouseDown(screen.getByRole("combobox"));
        fireEvent.click(await screen.findByText("Bob"));

        await waitFor(() => expect(loadMock).toHaveBeenCalledTimes(2));
        expect(loadMock.mock.calls[1][0]).toEqual([3]);
    });

    it("does not render the member picker when no members are provided", () => {
        renderSection();
        expect(screen.queryByText("Member")).not.toBeInTheDocument();
    });
});
