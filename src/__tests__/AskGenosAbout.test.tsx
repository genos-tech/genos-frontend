/**
 * The Cmd-K hand-off "Ask Genos about this" (`genos:ask-about`).
 *
 * A caller raises a window event; `useSpotlight` (App root) opens the ask with
 * the thing as a `#` mention in the draft; the input that mounts adopts the
 * structured ref, so the ask carries it whether or not it is in the
 * input's candidate pool. Nothing is sent until the person presses Ask.
 *
 * A task's and a milestone's menu item USED to use this hand-off. Since
 * MIP-1057 it opens THAT object's own conversation (`features/taskAsk`)
 * instead, so what is pinned for the menu below is that it raises the task's
 * own request and leaves this hand-off, and with it the Cmd-K conversation,
 * alone. This hand-off is still what a chat message and a calendar event use.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentMentionDraft } from "../features/agentQA/mentions/useAgentMentionDraft";
import { EMPTY_ASK_STATE } from "../features/agentQA/types";
import {
    askGenosRefForTask,
    askGenosToken,
    onAskGenosAbout,
    requestAskGenosAbout,
    takePendingAskRefs,
    withAskGenosToken,
} from "../features/spotlight/askGenosAbout";
import { askGenosMenuItem } from "../features/spotlight/askGenosMenuItem";
import { SpotlightOverlay } from "../features/spotlight/SpotlightOverlay";
import { useSpotlight } from "../features/spotlight/useSpotlight";
import {
    askGenosTaskRequest,
    onAskGenosAboutTask,
    type TaskAskRequest,
} from "../features/taskAsk/taskAskLink";
import { TaskTitleBlock } from "../features/tasks/components/contents/base/TaskTitleBlock";
import { en } from "../i18n/locales/en";

vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));
vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return { ...actual, askAgentStream: vi.fn(), fetchAgentSessions: vi.fn(async () => []) };
});
vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "t" }),
    useOptionalAccessToken: () => "t",
}));
vi.mock("../services/notifications/NotificationsContext", () => ({
    useNotificationsContext: () => ({
        isTargetMutedByKey: () => false,
        muteTarget: vi.fn(),
        unmuteTarget: vi.fn(),
    }),
}));
vi.mock("../features/tasks/diagram/components/LazyTaskDiagram", () => ({
    LazyTaskDiagram: () => <div />,
}));

const REF = { kind: "task", taskId: 42, label: "MIP-42" } as const;

beforeEach(() => {
    localStorage.clear();
    takePendingAskRefs(); // the queue is module state: start empty
});
afterEach(cleanup);

describe("askGenosRefForTask", () => {
    it("names a task by its display id, as a person types #MIP-42", () => {
        expect(askGenosRefForTask({ id: 42, displayId: "MIP-42", title: "Fix it" })).toEqual(REF);
    });

    it("falls back to the title when there is no display id", () => {
        expect(askGenosRefForTask({ id: 42, displayId: null, title: " Fix it " })).toEqual({
            kind: "task",
            taskId: 42,
            label: "Fix it",
        });
    });

    it("marks a milestone, which is its backing task to the server", () => {
        expect(
            askGenosRefForTask({ id: 7, displayId: "MIP-7", title: "M", isMilestone: true })
        ).toEqual({ kind: "task", taskId: 7, label: "MIP-7", isMilestone: true });
    });

    it("gives nothing for a task with no id or nothing to call it by", () => {
        expect(askGenosRefForTask({ id: undefined, displayId: "MIP-1", title: "x" })).toBeNull();
        expect(askGenosRefForTask({ id: 0, displayId: "MIP-1", title: "x" })).toBeNull();
        expect(askGenosRefForTask({ id: 5, displayId: " ", title: "" })).toBeNull();
    });
});

describe("withAskGenosToken", () => {
    const token = askGenosToken(REF);

    it("is the token alone for an empty draft", () => {
        expect(token).toBe("#MIP-42 ");
        expect(withAskGenosToken("", token)).toBe("#MIP-42 ");
        expect(withAskGenosToken("   ", token)).toBe("#MIP-42 ");
    });

    it("goes after what the person had already typed", () => {
        expect(withAskGenosToken("what is blocking  ", token)).toBe("what is blocking #MIP-42 ");
    });

    it("is not added twice", () => {
        expect(withAskGenosToken("#MIP-42 why", token)).toBe("#MIP-42 why");
        expect(withAskGenosToken("why #MIP-42 ", token)).toBe("why #MIP-42 ");
    });
});

describe("the hand-off", () => {
    it("tells the listener and queues the ref once, however often it is asked", () => {
        const heard = vi.fn();
        const off = onAskGenosAbout(heard);
        requestAskGenosAbout(REF);
        requestAskGenosAbout(REF);
        off();
        requestAskGenosAbout(REF);
        expect(heard).toHaveBeenCalledTimes(2);
        expect(takePendingAskRefs()).toEqual([REF]);
        expect(takePendingAskRefs()).toEqual([]); // handed over once
    });
});

describe("useAgentMentionDraft.adopt", () => {
    it("sends an adopted ref with the ask although it is not in the candidate pool", () => {
        const { result } = renderHook(() =>
            useAgentMentionDraft({
                value: "#MIP-42 why is it late",
                onChange: vi.fn(),
                members: [],
                entities: [],
            })
        );
        act(() => result.current.adopt([REF]));
        expect(result.current.consumeMentions("#MIP-42 why is it late")).toEqual([REF]);
    });

    it("drops the ref when the person deleted its token", () => {
        const { result } = renderHook(() =>
            useAgentMentionDraft({ value: "", onChange: vi.fn(), members: [], entities: [] })
        );
        act(() => result.current.adopt([REF]));
        expect(result.current.consumeMentions("why is it late")).toEqual([]);
    });
});

describe("useSpotlight", () => {
    it("opens the overlay with the task in the draft", () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1", isPageActive: false })
        );
        expect(result.current.isOpen).toBe(false);
        act(() => requestAskGenosAbout(REF));
        expect(result.current.isOpen).toBe(true);
        expect(result.current.query).toBe("#MIP-42 ");
    });

    it("appends to a draft already there", () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1", isPageActive: false })
        );
        act(() => result.current.setQuery("what changed in"));
        act(() => requestAskGenosAbout(REF));
        expect(result.current.query).toBe("what changed in #MIP-42 ");
    });

    it("does not open the overlay over the Genos page: it hands focus to the page input", () => {
        const focus = vi.fn();
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1", isPageActive: true })
        );
        act(() => result.current.registerPageInputFocus(focus));
        act(() => requestAskGenosAbout(REF));
        expect(result.current.isOpen).toBe(false);
        expect(focus).toHaveBeenCalled();
        expect(result.current.query).toBe("#MIP-42 ");
    });

    it("stops listening when the hook unmounts", () => {
        const { result, unmount } = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1", isPageActive: false })
        );
        unmount();
        requestAskGenosAbout(REF);
        expect(result.current.isOpen).toBe(false);
    });
});

const overlayProps = (query: string, onAsk = vi.fn()) => ({
    isOpen: true,
    onClose: vi.fn(),
    query,
    onQueryChange: vi.fn(),
    results: [],
    isLoading: false,
    error: null,
    filterServices: [],
    onToggleFilterService: vi.fn(),
    onSelect: vi.fn(),
    onPreview: vi.fn(),
    onAsk,
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onCancel: vi.fn(),
    onNewConversation: vi.fn(),
    ask: { ...EMPTY_ASK_STATE },
    turns: [],
    aiAnswersEnabled: true,
    historyMode: "closed" as const,
    historySessions: [],
    historyDetail: null,
    historyIsLoading: false,
    openHistory: vi.fn(),
    viewHistorySession: vi.fn(),
    backToHistoryList: vi.fn(),
    closeHistory: vi.fn(),
    onOpenSettings: vi.fn(),
});

describe("the Spotlight input", () => {
    it("takes the queued ref, so the ask carries the task and nothing is sent before Ask", () => {
        requestAskGenosAbout(REF);
        const onAsk = vi.fn();
        render(
            <CssVarsProvider>
                <SpotlightOverlay {...overlayProps("#MIP-42 ", onAsk)} />
            </CssVarsProvider>
        );
        expect(onAsk).not.toHaveBeenCalled();
        const box = screen.getByRole("textbox");
        expect(box).toHaveValue("#MIP-42 ");
        fireEvent.change(box, { target: { value: "#MIP-42 why is it late" } });
        fireEvent.keyDown(box, { key: "Enter" });
        expect(onAsk).toHaveBeenCalledTimes(1);
        expect(onAsk).toHaveBeenCalledWith("#MIP-42 why is it late", [REF]);
        expect(takePendingAskRefs()).toEqual([]);
    });

    it("sends no mention when the person removed the token before asking", () => {
        requestAskGenosAbout(REF);
        const onAsk = vi.fn();
        render(
            <CssVarsProvider>
                <SpotlightOverlay {...overlayProps("#MIP-42 ", onAsk)} />
            </CssVarsProvider>
        );
        const box = screen.getByRole("textbox");
        fireEvent.change(box, { target: { value: "something else" } });
        fireEvent.keyDown(box, { key: "Enter" });
        expect(onAsk).toHaveBeenCalledWith("something else", []);
    });

    it("an ordinary open takes no ref and asks with none", () => {
        const onAsk = vi.fn();
        render(
            <CssVarsProvider>
                <SpotlightOverlay {...overlayProps("", onAsk)} />
            </CssVarsProvider>
        );
        const box = screen.getByRole("textbox");
        fireEvent.change(box, { target: { value: "hello" } });
        fireEvent.keyDown(box, { key: "Enter" });
        expect(onAsk).toHaveBeenCalledWith("hello", []);
    });
});

const REQUEST: TaskAskRequest = {
    taskId: 42,
    projectId: 7,
    displayId: "MIP-42",
    title: "Fix it",
    isMilestone: false,
};

describe("the menu item", () => {
    it("is hidden without a request, and when the caller's gate is closed", () => {
        const label = "Ask Genos about this task";
        expect(askGenosMenuItem({ ask: null, label, visible: true }).visible).toBe(false);
        expect(askGenosMenuItem({ ask: REQUEST, label, visible: false }).visible).toBe(false);
        expect(askGenosMenuItem({ ask: REQUEST, label, visible: true }).visible).toBe(true);
    });

    it("is an askGenos item that raises the request for its task", () => {
        const item = askGenosMenuItem({ ask: REQUEST, label: "Ask", visible: true });
        expect(item.kind).toBe("askGenos");
        const heard = vi.fn();
        const off = onAskGenosAboutTask(heard);
        item.onClick();
        off();
        expect(heard).toHaveBeenCalledWith(REQUEST);
    });

    it("does not use the Cmd-K hand-off: nothing is queued, nothing opens, no draft", () => {
        const spotlight = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1", isPageActive: false })
        );
        const heardAboutRef = vi.fn();
        const off = onAskGenosAbout(heardAboutRef);
        act(() => askGenosMenuItem({ ask: REQUEST, label: "Ask", visible: true }).onClick());
        off();
        expect(heardAboutRef).not.toHaveBeenCalled();
        expect(takePendingAskRefs()).toEqual([]);
        expect(spotlight.result.current.isOpen).toBe(false);
        expect(spotlight.result.current.query).toBe("");
    });

    it("does nothing when clicked without a request", () => {
        const heard = vi.fn();
        const off = onAskGenosAboutTask(heard);
        askGenosMenuItem({ ask: null, label: "Ask", visible: true }).onClick();
        off();
        expect(heard).not.toHaveBeenCalled();
    });
});

describe("askGenosTaskRequest", () => {
    it("names the task by its own id, its display id and title, and its project", () => {
        expect(
            askGenosTaskRequest({ id: 42, projectId: 7, displayId: " MIP-42 ", title: " Fix it " })
        ).toEqual(REQUEST);
    });

    it("marks a milestone, which is its backing task to the server", () => {
        expect(
            askGenosTaskRequest({ id: 7, displayId: "MIP-7", title: "M", isMilestone: true })
        ).toEqual({
            taskId: 7,
            projectId: null,
            displayId: "MIP-7",
            title: "M",
            isMilestone: true,
        });
    });

    it("gives nothing for a task with no usable id or nothing to call it by", () => {
        for (const id of [undefined, null, 0, -1, 1.5, NaN]) {
            expect(
                askGenosTaskRequest({ id, displayId: "MIP-1", title: "x" }),
                String(id)
            ).toBeNull();
        }
        expect(askGenosTaskRequest({ id: 5, displayId: " ", title: "" })).toBeNull();
    });

    it("only a request with a real id reaches a listener", () => {
        const heard = vi.fn();
        const off = onAskGenosAboutTask(heard);
        window.dispatchEvent(
            new CustomEvent("genos:ask-about-task", { detail: { ...REQUEST, taskId: 0 } })
        );
        window.dispatchEvent(new CustomEvent("genos:ask-about-task", { detail: undefined }));
        off();
        expect(heard).not.toHaveBeenCalled();
    });
});

const renderTaskMenu = (opts: {
    id?: number;
    displayId?: string;
    hostZIndex?: number;
    creating?: boolean;
}) =>
    render(
        <MemoryRouter initialEntries={["/workspace/tasks"]}>
            <CssVarsProvider>
                <TaskTitleBlock
                    hostZIndex={opts.hostZIndex}
                    isPreviewMode={true}
                    myself={{ userId: "u1", teamId: "t1" } as never}
                    setTaskTitle={vi.fn()}
                    taskTitle="A task"
                    useCM={{} as never}
                    useNM={{ taskNoteMeta: [] } as never}
                    usePM={{} as never}
                    useTM={{ isCreatingTask: { flag: opts.creating ?? false } } as never}
                    useUISM={{} as never}
                    taskContent={
                        {
                            id: opts.id,
                            displayId: opts.displayId,
                            rootTaskId: opts.id,
                            title: "A task",
                            project: { projectId: 7 },
                            threadId: null,
                            chatType: null,
                            chatId: null,
                            status: { status: "Open" },
                        } as never
                    }
                />
            </CssVarsProvider>
        </MemoryRouter>
    );

const openMenu = () => {
    fireEvent.click(screen.getAllByLabelText("More options")[0]);
    return screen.getAllByRole("menuitem").map((el) => el.textContent);
};

describe("the task preview menu", () => {
    it("offers Ask Genos with the ways to open the task, before sharing, and asks for this task", () => {
        renderTaskMenu({ id: 42, displayId: "MIP-42" });
        const m = en.tasks.titleBlock.menu;
        const labels = openMenu();
        expect(labels.slice(0, 3)).toEqual([m.openNote, m.askGenos, m.copyTaskLink]);

        const heard = vi.fn();
        const heardAboutRef = vi.fn();
        const off = onAskGenosAboutTask(heard);
        const offRef = onAskGenosAbout(heardAboutRef);
        fireEvent.click(screen.getByRole("menuitem", { name: en.tasks.titleBlock.menu.askGenos }));
        off();
        offRef();
        // THIS task's own conversation, in the project the task is in: not the Cmd-K hand-off.
        expect(heard).toHaveBeenCalledWith({
            taskId: 42,
            projectId: 7,
            displayId: "MIP-42",
            title: "A task",
            isMilestone: false,
        });
        expect(heardAboutRef).not.toHaveBeenCalled();
    });

    it("is not offered inside the link-preview modal (the window would open behind it)", () => {
        renderTaskMenu({ id: 42, displayId: "MIP-42", hostZIndex: 10020 });
        expect(openMenu()).not.toContain(en.tasks.titleBlock.menu.askGenos);
    });

    it("is not offered for a task that has no id yet", () => {
        renderTaskMenu({ id: undefined });
        expect(openMenu()).not.toContain(en.tasks.titleBlock.menu.askGenos);
    });

    it("is not offered while the task is still being created", () => {
        renderTaskMenu({ id: 42, displayId: "MIP-42", creating: true });
        expect(openMenu()).not.toContain(en.tasks.titleBlock.menu.askGenos);
    });
});
