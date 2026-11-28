/**
 * The scheduled message in the schedule form (MIP-2482): the job is offered only where the chat
 * editor can be drawn; picking it shows the editor and a chat picker with no Inbox row; what is
 * saved is the editor's blocks and the chat; a saved one opens with its message and shows its
 * first line in the list. The editor itself is a stand-in here (it is BlockNote, checked in the
 * browser); its `/` menu is checked for what it must not offer.
 */
import type { ReactNode } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { messagePreview } from "../components/layout/schedules/messagePreview";
import { SchedulesSection } from "../components/layout/schedules/SchedulesSection";
import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";
import type { SkillsHost } from "../features/genos/skills/skillsHost";
import { emptyForm, validateForm } from "../features/schedules/scheduleForm";
import type { Schedule, ScheduleJob } from "../services/schedules";

vi.setConfig({ testTimeout: 30000 });

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const listSchedules = vi.fn();
const createSchedule = vi.fn();
const updateSchedule = vi.fn();
vi.mock("../services/schedules", () => ({
    listSchedules: (...a: unknown[]) => listSchedules(...a),
    createSchedule: (...a: unknown[]) => createSchedule(...a),
    updateSchedule: (...a: unknown[]) => updateSchedule(...a),
    deleteSchedule: vi.fn(),
    runScheduleNow: vi.fn(),
}));

vi.mock("../hooks/common/personalGMTagsState", () => ({
    usePersonalGMTags: () => ({
        loaded: true,
        failed: false,
        tags: [],
        assignmentsByChannelId: {},
        defaultVisibleTagIds: [],
    }),
}));

const para = (text: string) => ({
    id: text || "blank",
    type: "paragraph",
    content: text ? [{ type: "text", text, styles: {} }] : [],
    children: [],
});

// The editor stand-in: one text box whose value becomes a paragraph plus the trailing blank line.
vi.mock("../components/layout/schedules/ScheduleMessageEditor", () => ({
    default: ({
        initialBody,
        onChange,
    }: {
        initialBody: { content?: { text?: string }[] }[];
        onChange: (body: unknown[]) => void;
    }) => (
        <textarea
            aria-label="message editor"
            defaultValue={initialBody[0]?.content?.[0]?.text ?? ""}
            onChange={(e) => onChange([para(e.target.value), para("")])}
        />
    ),
}));

const mention = (): HashMentionData => ({
    tasks: [],
    notes: [],
    chats: [],
    allChats: [] as never,
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

const HOST = {} as SkillsHost;

const JOB: ScheduleJob = {
    job: "scheduled_message",
    title: "Scheduled message",
    description: "Sends a message.",
    params: {},
    postsAsOwner: true,
};
const OTHER: ScheduleJob = {
    job: "what_you_did",
    title: "What you did",
    description: "Your day.",
    params: {},
};

const SAVED: Schedule = {
    id: "s1",
    name: "Stand-up",
    job: "scheduled_message",
    jobTitle: "Scheduled message",
    params: { body: [para("Stand-up in five"), para("")] },
    when: "every day at 09:00",
    frequency: "daily",
    timeOfDay: "09:00",
    enabled: true,
    deliverPush: true,
    deliverChannelId: "c-open",
    deliverChannel: { id: "c-open", title: "Everyone", kind: "group" },
    nextRun: null,
    lastRun: null,
    lastStatus: null,
};

const LIST = (schedules: Schedule[] = []) => ({
    timeZone: "Asia/Tokyo",
    limit: 20,
    jobs: [OTHER, JOB],
    schedules,
    suggestions: [],
    chatTargets: [{ id: "c-squad", title: "Squad", kind: "group", projectId: null }],
    messageChatTargets: [
        { id: "c-squad", title: "Squad", kind: "group", projectId: null },
        { id: "c-open", title: "Everyone", kind: "group", projectId: null },
    ],
});

beforeEach(() => {
    listSchedules.mockReset();
    createSchedule.mockReset();
    updateSchedule.mockReset();
    listSchedules.mockResolvedValue(LIST());
});

const openForm = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(
        await screen.findByRole("button", { name: /^(New schedule|Create your first)/ })
    );
};
const pickJob = async (user: ReturnType<typeof userEvent.setup>) => {
    const form = screen.getByTestId("schedule-form");
    await user.click(within(form).getByRole("combobox", { name: /Report/ }));
    await user.click(await screen.findByRole("option", { name: "Scheduled message" }));
};
const chatBox = () => within(screen.getByTestId("schedule-deliver")).getByRole("combobox");

describe("the scheduled message form", () => {
    it("is offered only where the editor can be drawn", async () => {
        render(<SchedulesSection teamId="t1" />);
        const user = userEvent.setup();
        await openForm(user);
        await user.click(
            within(screen.getByTestId("schedule-form")).getByRole("combobox", { name: /Report/ })
        );
        const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
        expect(options).toEqual(["What you did"]);
    });

    it("shows the editor and a chat picker with no Inbox and no push switch", async () => {
        render(<SchedulesSection editorHost={HOST} teamId="t1" />);
        const user = userEvent.setup();
        await openForm(user);
        await pickJob(user);
        expect(await screen.findByRole("textbox", { name: "message editor" })).toBeInTheDocument();
        expect(chatBox()).toHaveValue("");
        await user.click(chatBox());
        const rows = (await screen.findAllByRole("option")).map((o) => o.textContent ?? "");
        expect(rows).toHaveLength(2);
        expect(rows.some((r) => r.includes("My Inbox"))).toBe(false);
        expect(screen.queryByText(/push/i)).not.toBeInTheDocument();
    });

    it("asks for the message and the chat before saving", async () => {
        render(<SchedulesSection editorHost={HOST} teamId="t1" />);
        const user = userEvent.setup();
        await openForm(user);
        await pickJob(user);
        await user.click(screen.getByRole("button", { name: /^(Save|Create)/ }));
        expect(await screen.findByText("Write the message to send.")).toBeInTheDocument();
        expect(screen.getByText("Choose a group chat or project chat.")).toBeInTheDocument();
        expect(createSchedule).not.toHaveBeenCalled();
    });

    it("sends the blocks and the chat", async () => {
        createSchedule.mockResolvedValue({ ok: true, schedule: SAVED });
        render(<SchedulesSection editorHost={HOST} teamId="t1" />);
        const user = userEvent.setup();
        await openForm(user);
        await pickJob(user);
        await user.type(await screen.findByRole("textbox", { name: "message editor" }), "Hello");
        await user.click(chatBox());
        await user.click(await screen.findByRole("option", { name: /Everyone/ }));
        await user.click(screen.getByRole("button", { name: /^(Save|Create)/ }));
        await waitFor(() => expect(createSchedule).toHaveBeenCalled());
        const sent = createSchedule.mock.calls[0][2];
        expect(sent.job).toBe("scheduled_message");
        expect(sent.deliverChannelId).toBe("c-open");
        expect(sent.params).toEqual({ body: [para("Hello"), para("")] });
        expect(sent).not.toHaveProperty("aiEffort");
    });

    it("lists the first line and opens a saved message for editing", async () => {
        listSchedules.mockResolvedValue(LIST([SAVED]));
        updateSchedule.mockResolvedValue({ ok: true, schedule: SAVED });
        render(<SchedulesSection editorHost={HOST} teamId="t1" />);
        const user = userEvent.setup();
        expect(await screen.findByTestId("schedule-row-message")).toHaveTextContent(
            "Message: Stand-up in five"
        );
        expect(screen.getByTestId("schedule-row-deliver")).toHaveTextContent("Sends to: Everyone");
        await user.click(screen.getByRole("button", { name: /^Edit/ }));
        const editor = await screen.findByRole("textbox", { name: "message editor" });
        expect(editor).toHaveValue("Stand-up in five");
        // Renaming sends the name only: the message is left as it is stored.
        const name = screen.getByRole("textbox", { name: /Name/ });
        await user.clear(name);
        await user.type(name, "Morning");
        await user.click(screen.getByRole("button", { name: /^Save/ }));
        await waitFor(() => expect(updateSchedule).toHaveBeenCalled());
        expect(updateSchedule.mock.calls[0][3]).toEqual({ name: "Morning" });
    });
});

describe("what the form refuses", () => {
    const form = (messageBody: unknown[]) => ({
        ...emptyForm([JOB]),
        name: "x",
        deliverChannelId: "c-squad",
        messageBody,
    });

    it("an empty message and a pasted image", () => {
        expect(validateForm(form([para("  ")]), JOB).message).toBe("required");
        const image = { type: "image", props: { url: "https://x.test/a.png" } };
        expect(validateForm(form([{ ...para("hi"), children: [image] }]), JOB).message).toBe(
            "files"
        );
        expect(validateForm(form([para("hi")]), JOB).message).toBeUndefined();
    });

    it("words the preview from the first line that says something", () => {
        expect(messagePreview([para(""), para("Second")])).toBe("Second");
        expect(messagePreview(undefined)).toBe("");
    });
});
