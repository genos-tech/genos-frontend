/**
 * "Remind me…" on a task comment (MIP-1437).
 *
 * A reminder about a comment is the message reminder on the comment's mirror message (the flag with
 * a time on it), so the menu item, the dialog and the service calls are the chat bubble's, pointed
 * at the mirror id the comment list carries.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskCommentBubble } from "../features/tasks/components/contents/base/sub/TaskCommentBubble";
import { BubbleActionsPreferenceProvider } from "../hooks/common/useBubbleActionsPreference";
import { DoubleClickTodoPreferenceProvider } from "../hooks/common/useDoubleClickTodoPreference";
import { en } from "../i18n/locales/en";
import { TaskCommentProps } from "../types/tasks";

const service = vi.hoisted(() => {
    const listeners = new Set<() => void>();
    const reminders = new Map<string, unknown>();
    let snapshot = {
        flagByMessageId: new Map<string, unknown>() as ReadonlyMap<string, unknown>,
        reminderByMessageId: reminders as ReadonlyMap<string, unknown>,
    };
    return {
        reminders,
        setReminder: vi.fn().mockResolvedValue({}),
        cancelReminder: vi.fn().mockResolvedValue(undefined),
        flagMessage: vi.fn().mockResolvedValue(undefined),
        unflagMessage: vi.fn().mockResolvedValue(undefined),
        completeFlag: vi.fn().mockResolvedValue(undefined),
        subscribe: (l: () => void) => {
            listeners.add(l);
            return () => listeners.delete(l);
        },
        getSnapshot: () => snapshot,
        setReminderState(messageId: string, remindAt: string | null) {
            if (remindAt) reminders.set(messageId, { id: "r1", messageId, remindAt });
            else reminders.delete(messageId);
            snapshot = { ...snapshot, reminderByMessageId: reminders };
            listeners.forEach((l) => l());
        },
    };
});
vi.mock("../services/channel/channelService", () => ({ channelService: service }));
vi.mock("../components/messageBody/MessageBody", () => ({ MessageBody: () => <div /> }));
vi.mock("../components/ui/emoji/ReactionTaskCommentEmojiDisplay", () => ({
    ReactionTaskCommentEmojiDisplay: () => <div />,
}));
vi.mock("../components/ui/emoji/TaskCommentEmojiReaction", () => ({
    TaskCommentEmojiReaction: () => <div />,
}));
vi.mock("../components/ui/emoji/EmojiPicker", () => ({ EmojiPicker: () => null }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => <div /> }));

const MIRROR = "1f23d65f-3379-5e81-985f-04a54d143ddb";
const REMIND = en.chat.messageActions.remindMe;
const FLAG = en.chat.messageActions.flagForLater;
const TODO = en.chat.messageActions.addToTodo;

const comment = (over: Partial<TaskCommentProps> = {}): TaskCommentProps => ({
    projectId: 7,
    taskId: 42,
    senderId: "u2",
    senderName: "Other",
    commentId: 3,
    commentBody: [{ type: "paragraph", content: [{ type: "text", text: "remind me" }] }],
    messageId: MIRROR,
    tsSent: "2026-07-17T00:00:00Z",
    tsUpdated: "2026-07-17T00:00:00Z",
    isEdited: false,
    ...over,
});

const mount = (c: TaskCommentProps) =>
    render(
        <CssVarsProvider>
            <BubbleActionsPreferenceProvider>
                <DoubleClickTodoPreferenceProvider>
                    <TaskCommentBubble
                        comment={c}
                        currentProjectId={7}
                        myself={{ userId: "u1", teamId: "t1" } as never}
                        setEditTargetComment={vi.fn()}
                        setIsInEdit={vi.fn()}
                        setMyself={vi.fn()}
                        socket={null}
                        useCM={{} as never}
                        useTEM={{} as never}
                        useUISM={{} as never}
                    />
                </DoubleClickTodoPreferenceProvider>
            </BubbleActionsPreferenceProvider>
        </CssVarsProvider>
    );

const hover = (container: HTMLElement) => {
    const root = container.firstElementChild;
    if (root) fireEvent.mouseEnter(root);
};
const openMenu = (container: HTMLElement) => {
    hover(container);
    fireEvent.click(screen.getByLabelText("More options"));
    return screen.getAllByRole("menuitem");
};
const labels = (items: HTMLElement[]) => items.map((el) => el.textContent as string);

beforeEach(() => {
    window.localStorage.clear();
    service.setReminderState(MIRROR, null);
    vi.clearAllMocks();
});
afterEach(cleanup);

describe("the menu item", () => {
    it("is there for a comment with a mirror message", () => {
        const { container } = mount(comment());
        expect(labels(openMenu(container))).toContain(REMIND);
    });

    it("is not there without one", () => {
        for (const messageId of [undefined, null]) {
            const { container, unmount } = mount(comment({ messageId }));
            expect(labels(openMenu(container))).not.toContain(REMIND);
            unmount();
        }
    });

    it("comes straight after the flag, and the To-Do item is set apart below", () => {
        const { container } = mount(comment());
        const items = openMenu(container);
        const l = labels(items);
        const at = l.indexOf(FLAG);
        expect(l.slice(at, at + 3)).toEqual([FLAG, REMIND, TODO]);
        expect(items[at + 2].previousElementSibling?.getAttribute("role")).toBe("separator");
    });

    it("has the bell, not the flag's or the To-Do list's glyph", () => {
        const { container } = mount(comment());
        const item = openMenu(container).find((el) => el.textContent === REMIND)!;
        expect(
            item.querySelector('[data-testid="NotificationsActiveRoundedIcon"]')
        ).not.toBeNull();
    });

    it("can be pinned to the toolbar and then leaves the menu", () => {
        window.localStorage.setItem(
            "genos-bubble-pinned-actions-v1",
            JSON.stringify(["remindMe"])
        );
        const { container } = mount(comment());
        hover(container);
        expect(screen.getByRole("button", { name: REMIND })).toBeTruthy();
        fireEvent.click(screen.getByLabelText("More options"));
        expect(labels(screen.getAllByRole("menuitem"))).not.toContain(REMIND);
    });
});

describe("the dialog", () => {
    const open = (container: HTMLElement) =>
        fireEvent.click(openMenu(container).find((el) => el.textContent === REMIND)!);

    it("says COMMENT, not message", async () => {
        const { container } = mount(comment());
        open(container);
        const dialog = await screen.findByRole("dialog");
        expect(dialog.textContent).toContain(en.chat.remindMe.descriptionComment);
        expect(dialog.textContent).not.toContain(en.chat.remindMe.description);
        expect(en.chat.remindMe.descriptionComment).toMatch(/comment/i);
    });

    it("sets the reminder on the MIRROR message, for the time picked", async () => {
        const { container } = mount(comment());
        open(container);
        const before = Date.now();
        fireEvent.click(
            await screen.findByRole("button", { name: new RegExp(en.chat.remindMe.presets.in1h) })
        );
        await waitFor(() => expect(service.setReminder).toHaveBeenCalledTimes(1));
        const [id, at] = service.setReminder.mock.calls[0] as [string, Date];
        expect(id).toBe(MIRROR);
        expect(at.getTime() - before).toBeGreaterThan(55 * 60_000);
        expect(at.getTime() - before).toBeLessThan(65 * 60_000);
    });

    it("with a reminder set: the menu says when, and the dialog can remove it", async () => {
        const at = new Date(Date.now() + 3 * 3600_000).toISOString();
        service.setReminderState(MIRROR, at);
        const { container } = mount(comment());
        const items = openMenu(container);
        const item = items.find((el) => el.textContent?.startsWith("Reminder:"))!;
        expect(item).toBeTruthy();
        expect(labels(items)).not.toContain(REMIND);
        fireEvent.click(item);
        fireEvent.click(await screen.findByRole("button", { name: en.chat.remindMe.remove }));
        await waitFor(() => expect(service.cancelReminder).toHaveBeenCalledWith(MIRROR));
    });
});
