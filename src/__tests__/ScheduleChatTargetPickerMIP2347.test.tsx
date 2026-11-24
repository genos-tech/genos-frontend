/**
 * "Send the report to" is drawn like the Project updates picker (MIP-2347): each place shows its
 * picture, its kind and its tags, the closed field keeps the picture, and a saved place that is
 * no longer offered stays shown (muted). The wire is the one MIP-1420 tests: unchanged.
 *
 * jsdom never loads an image, so the picture is checked by its fallback glyph and, for the url,
 * through the hook that resolves it. How the open dropdown looks was checked in a browser.
 */
import type { ReactNode } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { renderHook, render as rtlRender, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChatTargetAvatar } from "../components/layout/schedules/chatTarget";
import { SchedulesSection } from "../components/layout/schedules/SchedulesSection";
import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";
import type { Schedule, ScheduleJob } from "../services/schedules";

vi.setConfig({ testTimeout: 30000 });

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const listSchedules = vi.fn();
vi.mock("../services/schedules", () => ({
    listSchedules: (...a: unknown[]) => listSchedules(...a),
    createSchedule: vi.fn(),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    runScheduleNow: vi.fn(),
}));

const TAG = (tagId: number, name: string) => ({
    tagId,
    name,
    color: "#2563eb",
    textColor: "#fff",
    isDefaultVisible: false,
    sortOrder: tagId,
});
vi.mock("../hooks/common/personalGMTagsState", () => ({
    usePersonalGMTags: () => ({
        loaded: true,
        failed: false,
        tags: [TAG(1, "Ops"), TAG(2, "Weekly"), TAG(3, "Hidden")],
        assignmentsByChannelId: { "c-squad": [1, 2, 3] },
        defaultVisibleTagIds: [],
    }),
}));

const LABEL = (labelId: number, name: string) => ({
    labelId,
    name,
    color: "#0d9488",
    textColor: "#fff",
});
const PROJECTS = [
    {
        projectId: 11,
        projectName: "Apollo",
        projectTags: [],
        isJoined: true,
        projectLabels: [LABEL(1, "Alpha"), LABEL(2, "Beta"), LABEL(3, "Gamma")],
    },
];

const mention = (): HashMentionData => ({
    tasks: [],
    notes: [],
    chats: [],
    allChats: [
        {
            chatId: "c-squad",
            chatType: 2,
            profileImagePath: "https://img.test/squad.png",
        },
        {
            chatId: "pm-apollo",
            chatType: 3,
            project: { projectId: 11 },
            profileImagePath: "https://img.test/apollo.png",
        },
    ] as never,
    projects: PROJECTS as never,
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
    job: "project_updates",
    title: "Project updates",
    description: "One project.",
    params: { project_id: { type: "integer", minimum: 1, required: true } },
    shareable: true,
};
const CHATS = [
    { id: "c-squad", title: "Squad", kind: "group" as const, projectId: null },
    { id: "c-apollo", title: "Apollo", kind: "project" as const, projectId: 11 },
];
const SCHEDULE: Schedule = {
    id: "s1",
    name: "Apollo news",
    job: "project_updates",
    jobTitle: "Project updates",
    params: { project_id: 11 },
    when: "every day at 09:00",
    frequency: "daily",
    timeOfDay: "09:00",
    enabled: true,
    deliverPush: true,
    nextRun: null,
    lastRun: null,
    lastStatus: null,
};
const LIST = (schedules: Schedule[] = [], chatTargets = CHATS) => ({
    timeZone: "Asia/Tokyo",
    limit: 20,
    jobs: [JOB],
    schedules,
    suggestions: [],
    chatTargets,
});

beforeEach(() => {
    listSchedules.mockReset();
    listSchedules.mockResolvedValue(LIST());
});

const openNew = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(
        await screen.findByRole("button", { name: /^(New schedule|Create your first)/ })
    );
    return within(screen.getByTestId("schedule-deliver"));
};

describe("the rows", () => {
    it("a group chat row shows its kind and the member's own tags, two and a +N", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        const box = await openNew(user);
        await user.click(box.getByRole("combobox"));
        const row = (await screen.findAllByRole("option")).find((o) =>
            /^Ops/.test(o.textContent ?? "")
        )!;
        expect(row).toBeTruthy();
        const text = row.textContent ?? "";
        expect(text).toContain("Ops");
        expect(text).toContain("Weekly");
        expect(text).not.toContain("Hidden");
        expect(text).toContain("+1");
        expect(text).toContain("Squad");
        expect(text).toContain("Group chat");
    });

    it("a project chat row shows the project's labels (two and a +N) and its kind", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        const box = await openNew(user);
        await user.click(box.getByRole("combobox"));
        const row = (await screen.findAllByRole("option")).find((o) =>
            /Apollo/.test(o.textContent ?? "")
        )!;
        const text = row.textContent ?? "";
        expect(text).toContain("Alpha");
        expect(text).toContain("Beta");
        expect(text).not.toContain("Gamma");
        expect(text).toContain("+1");
        expect(text).toContain("Project chat");
    });

    it("the Inbox row has an inbox glyph and no kind", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        const box = await openNew(user);
        await user.click(box.getByRole("combobox"));
        const row = (await screen.findAllByRole("option"))[0];
        expect(row.textContent).toBe("My Inbox");
        expect(row.querySelector("[data-testid='InboxOutlinedIcon']")).toBeTruthy();
    });
});

describe("the closed field", () => {
    it("shows the Inbox glyph, then the chat's glyph once one is chosen", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        const box = await openNew(user);
        const field = () => box.getByRole("combobox").closest(".MuiAutocomplete-root")!;
        expect(field().querySelector("[data-testid='InboxOutlinedIcon']")).toBeTruthy();
        await user.click(box.getByRole("combobox"));
        await user.click(await screen.findByRole("option", { name: /Squad/ }));
        expect(field().querySelector("img[src='https://img.test/squad.png']")).toBeTruthy();
        expect(field().querySelector("[data-testid='InboxOutlinedIcon']")).toBeNull();
        expect(box.getByRole("combobox")).toHaveValue("Squad");
    });
});

describe("a saved place that is no longer offered", () => {
    it("stays chosen, and its row is shown without kind or tags", async () => {
        const saved: Schedule = {
            ...SCHEDULE,
            deliverChannelId: "c-gone",
            deliverChannel: { id: "c-gone", title: "Old room", kind: "group" },
        };
        listSchedules.mockResolvedValue(LIST([saved], [CHATS[1]]));
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await user.click(await screen.findByRole("button", { name: /^Edit/ }));
        const box = within(screen.getByTestId("schedule-deliver"));
        expect(box.getByRole("combobox")).toHaveValue("Old room");
        await user.click(box.getByRole("combobox"));
        const row = (await screen.findAllByRole("option")).find((o) =>
            /Old room/.test(o.textContent ?? "")
        )!;
        expect(row.textContent).toBe("Old room");
    });
});

describe("the picture", () => {
    it("is the group chat's image and the project's own chat image", () => {
        const wrapper = ({ children }: { children: ReactNode }) => <Wrap>{children}</Wrap>;
        expect(renderHook(() => useChatTargetAvatar(CHATS[0]), { wrapper }).result.current).toBe(
            "https://img.test/squad.png"
        );
        expect(renderHook(() => useChatTargetAvatar(CHATS[1]), { wrapper }).result.current).toBe(
            "https://img.test/apollo.png"
        );
    });
});
