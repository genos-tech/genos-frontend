/**
 * The group chat catch-up's `channel_id` parameter is a chat picker (MIP-2348): the same dropdown
 * rows as "Send the report to", with "All busy chats" as the empty row, group chats only, and a
 * saved chat that is no longer listed kept as "(unavailable)". The value sent is the chat's id.
 */
import type { ReactNode } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SchedulesSection } from "../components/layout/schedules/SchedulesSection";
import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";
import { knownParam } from "../features/schedules/scheduleParams";
import type { Schedule, ScheduleJob } from "../services/schedules";

vi.setConfig({ testTimeout: 30000 });

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const listSchedules = vi.fn();
const createSchedule = vi.fn();
vi.mock("../services/schedules", () => ({
    listSchedules: (...a: unknown[]) => listSchedules(...a),
    createSchedule: (...a: unknown[]) => createSchedule(...a),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    runScheduleNow: vi.fn(),
}));

vi.mock("../hooks/common/personalGMTagsState", () => ({
    usePersonalGMTags: () => ({
        loaded: true,
        failed: false,
        tags: [{ tagId: 1, name: "Ops", color: "#2563eb", textColor: "#fff", sortOrder: 1 }],
        assignmentsByChannelId: { "c-squad": [1] },
        defaultVisibleTagIds: [],
    }),
}));

const mention = (): HashMentionData => ({
    tasks: [],
    notes: [],
    chats: [],
    allChats: [
        { chatId: "c-squad", chatType: 2, chatName: "Squad" },
        { chatId: "c-design", chatType: 2, chatName: "Design" },
        { chatId: "c-ext", chatType: 2, chatName: "Shared with others", isExternal: true },
        { chatId: "pm-apollo", chatType: 3, chatName: "Apollo", project: { projectId: 11 } },
        { chatId: "dm-1", chatType: 1, chatName: "Someone" },
    ] as never,
    projects: [],
    todoGroups: [],
    myself: null,
    refresh: () => {},
});

const Wrap = ({ children }: { children: ReactNode }) => (
    <CssVarsProvider>
        <HashMentionDataProvider value={mention()}>{children}</HashMentionDataProvider>
    </CssVarsProvider>
);
const render = (ui: React.ReactElement) => rtlRender(<Wrap>{ui}</Wrap>);

const JOB: ScheduleJob = {
    job: "chat_catch_up",
    title: "Group chat catch-up",
    description: "Which group chats are busy.",
    params: {
        hours: { type: "integer", minimum: 1, maximum: 168 },
        channel_id: { type: "string" },
    },
    shareable: true,
};
const SCHEDULE: Schedule = {
    id: "s1",
    name: "Catch up",
    job: "chat_catch_up",
    jobTitle: "Group chat catch-up",
    params: { channel_id: "c-gone" },
    when: "every day at 09:00",
    frequency: "daily",
    timeOfDay: "09:00",
    enabled: true,
    deliverPush: true,
    nextRun: null,
    lastRun: null,
    lastStatus: null,
};
const LIST = (schedules: Schedule[] = []) => ({
    timeZone: "Asia/Tokyo",
    limit: 20,
    jobs: [JOB],
    schedules,
    suggestions: [],
    chatTargets: [],
});

beforeEach(() => {
    listSchedules.mockReset();
    createSchedule.mockReset();
    listSchedules.mockResolvedValue(LIST());
});

describe("the parameter registry", () => {
    it("channel_id is drawn by the chat picker, with words of its own", () => {
        expect(knownParam("channel_id")?.picker).toBe("chat");
    });
});

describe("the catch-up's chat picker", () => {
    const openPicker = async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(
            await screen.findByRole("button", { name: /^(New schedule|Create your first)/ })
        );
        const field = (await screen.findByText("Group chat", { selector: "label" })).closest(
            "div"
        )!;
        return within(field as HTMLElement).getByRole("combobox");
    };

    it("starts on All busy chats and lists group chats only", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        const box = await openPicker(user);
        expect(box).toHaveValue("All busy chats");
        await user.click(box);
        const rows = (await screen.findAllByRole("option")).map((o) => o.textContent ?? "");
        expect(rows[0]).toBe("All busy chats");
        expect(rows.some((r) => r.includes("Squad"))).toBe(true);
        expect(rows.some((r) => r.includes("Design"))).toBe(true);
        expect(rows.some((r) => r.includes("Apollo"))).toBe(false);
        expect(rows.some((r) => r.includes("Shared with others"))).toBe(false);
        expect(rows.some((r) => r.includes("Someone"))).toBe(false);
    });

    it("a group chat row carries the kind and the member's own tags, as the other picker", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        const box = await openPicker(user);
        await user.click(box);
        const row = (await screen.findAllByRole("option")).find((o) =>
            /Squad/.test(o.textContent ?? "")
        )!;
        expect(row.textContent).toContain("Ops");
        expect(row.textContent).toContain("Group chat");
    });

    it("sends the chosen chat's id", async () => {
        createSchedule.mockResolvedValue({ ...SCHEDULE, params: { channel_id: "c-design" } });
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        const box = await openPicker(user);
        await user.click(box);
        await user.click(await screen.findByRole("option", { name: /Design/ }));
        await user.click(screen.getByRole("button", { name: /^(Save|Create)/ }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalled());
        expect(JSON.stringify(createSchedule.mock.calls[0])).toContain('"channel_id":"c-design"');
    });

    it("sends no chat when it is left on All busy chats", async () => {
        createSchedule.mockResolvedValue(SCHEDULE);
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openPicker(user);
        await user.click(screen.getByRole("button", { name: /^(Save|Create)/ }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalled());
        expect(JSON.stringify(createSchedule.mock.calls[0])).not.toMatch(/"channel_id":"[^"]/);
    });

    it("keeps a saved chat that is no longer listed, as (unavailable)", async () => {
        listSchedules.mockResolvedValue(LIST([SCHEDULE]));
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click(await screen.findByRole("button", { name: /^Edit/ }));
        const field = (await screen.findByText("Group chat", { selector: "label" })).closest(
            "div"
        )!;
        expect(within(field as HTMLElement).getByRole("combobox")).toHaveValue("(unavailable)");
    });
});
