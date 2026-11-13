import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SchedulesSection } from "../components/layout/schedules/SchedulesSection";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const listSchedules = vi.fn();
const createSchedule = vi.fn();
vi.mock("../services/schedules", () => ({
    listSchedules: (...a: unknown[]) => listSchedules(...a),
    createSchedule: (...a: unknown[]) => createSchedule(...a),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    runScheduleNow: vi.fn(),
}));

const render = (ui: React.ReactElement) => rtlRender(<CssVarsProvider>{ui}</CssVarsProvider>);

const JOBS = [
    { job: "what_to_do_today", title: "What to do today", description: "d", params: {} },
    {
        job: "what_you_did",
        title: "What you did",
        description: "d",
        params: { day: { type: "string", enum: ["today", "yesterday"] } },
    },
];

const MORNING = {
    key: "morning_plan",
    name: "Morning plan",
    job: "what_to_do_today",
    params: {},
    frequency: "daily" as const,
    timeOfDay: "09:00",
};
const EVENING = {
    key: "evening_recap",
    name: "Evening recap",
    job: "what_you_did",
    params: { day: "today" },
    frequency: "daily" as const,
    timeOfDay: "17:00",
};

const LIST = (over: object = {}) => ({
    timeZone: "Asia/Tokyo",
    limit: 20,
    jobs: JOBS,
    schedules: [],
    suggestions: [MORNING, EVENING],
    ...over,
});

beforeEach(() => {
    listSchedules.mockReset();
    createSchedule.mockReset();
    listSchedules.mockResolvedValue(LIST());
});

const block = async () => screen.findByTestId("schedule-suggestions");

describe("Suggested schedules", () => {
    it("offers both, in words, with when they would run", async () => {
        render(<SchedulesSection teamId="team-9" />);
        const box = await block();
        expect(within(box).getByText("Suggested for you")).toBeInTheDocument();
        expect(within(box).getByText("Morning plan")).toBeInTheDocument();
        expect(within(box).getByText("Evening recap")).toBeInTheDocument();
        expect(within(box).getByText(/What to do today · Every day at 09:00/)).toBeInTheDocument();
        expect(
            within(box).getByText(/What you did today · Every day at 17:00/)
        ).toBeInTheDocument();
        expect(within(box).getAllByRole("button", { name: "Add" })).toHaveLength(2);
    });

    it("shows nothing when there is nothing to suggest, and tolerates an older API", async () => {
        listSchedules.mockResolvedValue(LIST({ suggestions: [] }));
        const { unmount } = render(<SchedulesSection teamId="team-9" />);
        await screen.findByText("You have no schedules yet.");
        expect(screen.queryByTestId("schedule-suggestions")).toBeNull();
        unmount();
        const { suggestions: _drop, ...older } = LIST();
        void _drop;
        listSchedules.mockResolvedValue(older);
        render(<SchedulesSection teamId="team-9" />);
        await screen.findByText("You have no schedules yet.");
        expect(screen.queryByTestId("schedule-suggestions")).toBeNull();
    });

    it("adding one is an ordinary create with push on, then the list is read again", async () => {
        createSchedule.mockResolvedValue({ ok: true, schedule: {} });
        const user = userEvent.setup();
        render(<SchedulesSection teamId="team-9" />);
        const box = await block();
        await user.click(within(box).getAllByRole("button", { name: "Add" })[1]);
        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        expect(createSchedule).toHaveBeenCalledWith("tok", "team-9", {
            name: "Evening recap",
            job: "what_you_did",
            params: { day: "today" },
            frequency: "daily",
            timeOfDay: "17:00",
            deliverPush: true,
        });
        await waitFor(() => expect(listSchedules).toHaveBeenCalledTimes(2));
    });

    it("names the schedule in the member's language, not with the server's wording", async () => {
        listSchedules.mockResolvedValue(
            LIST({ suggestions: [{ ...MORNING, name: "Server wording" }] })
        );
        createSchedule.mockResolvedValue({ ok: true, schedule: {} });
        const user = userEvent.setup();
        render(<SchedulesSection teamId="team-9" />);
        const box = await block();
        expect(within(box).queryByText("Server wording")).toBeNull();
        await user.click(within(box).getByRole("button", { name: "Add" }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalledTimes(1));
        expect(createSchedule.mock.calls[0][2].name).toBe("Morning plan");
    });

    it("says why it could not be added, in the API's own sentence", async () => {
        createSchedule.mockResolvedValue({
            ok: false,
            gone: false,
            error: "You can keep at most 20 schedules.",
        });
        const user = userEvent.setup();
        render(<SchedulesSection teamId="team-9" />);
        const box = await block();
        await user.click(within(box).getAllByRole("button", { name: "Add" })[0]);
        expect(await screen.findByText("You can keep at most 20 schedules.")).toBeInTheDocument();
    });

    it("cannot add past the limit", async () => {
        const full = Array.from({ length: 20 }, (_, i) => ({
            id: `s${i}`,
            name: `S${i}`,
            job: "what_you_did",
            jobTitle: "What you did",
            params: {},
            when: "every day at 12:00",
            frequency: "daily" as const,
            timeOfDay: "12:00",
            enabled: true,
            deliverPush: false,
            nextRun: null,
            lastRun: null,
            lastStatus: null,
        }));
        listSchedules.mockResolvedValue(LIST({ schedules: full }));
        render(<SchedulesSection teamId="team-9" />);
        const box = await block();
        for (const b of within(box).getAllByRole("button", { name: "Add" })) {
            expect(b).toBeDisabled();
        }
    });

    it("a suggestion this page has no words for shows the server's name", async () => {
        listSchedules.mockResolvedValue(
            LIST({ suggestions: [{ ...MORNING, key: "weekly_review", name: "Weekly review" }] })
        );
        render(<SchedulesSection teamId="team-9" />);
        const box = await block();
        expect(within(box).getByText("Weekly review")).toBeInTheDocument();
    });

    it("is hidden while the member is filling in a new schedule", async () => {
        const user = userEvent.setup();
        render(<SchedulesSection teamId="team-9" />);
        await block();
        await user.click(screen.getByRole("button", { name: "Create your first schedule" }));
        expect(screen.queryByTestId("schedule-suggestions")).toBeNull();
    });
});
