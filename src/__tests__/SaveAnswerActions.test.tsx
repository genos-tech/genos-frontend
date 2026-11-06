/**
 * "Save as note" and "Save as task" on an answer.
 *
 * Rendered through the real `AgentTurn`, bare: no I18nProvider, no UrlLinkModalProvider,
 * no Avatar context, no AuthProvider (the token is mocked in). That is the point: the
 * Spotlight overlay mounts the turn above all of them.
 *
 * What is pinned here: where the buttons appear (a finished answer with text and a run,
 * never an error, a half-written, a cancelled or a waiting-for-approval turn), what one
 * note save sends and what the person sees after it, that two clicks are one request,
 * the failure sentences, the huge-answer refusal, the task dialog (reused from the
 * to-do pane) and that it cannot be heard by what rendered it, and the render budget.
 */

import { useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentTurn, type AgentTurnProps } from "../features/agentQA/AgentTurn";
import { buildAgentTurnLabels } from "../features/agentQA/agentTurnLabels";
import { sourceToUrl } from "../features/agentQA/citationUtils";
import { MAX_ANSWER_BYTES } from "../features/agentQA/saveAnswer/answerBlocks";
import {
    renderSaveAnswerActions,
    renderSaveAnswerStatus,
} from "../features/agentQA/saveAnswer/SaveAnswerActions";
import { resetSaveStore } from "../features/agentQA/saveAnswer/saveAnswerStore";
import { ModalCreateTaskFromTodo } from "../features/chat/components/todo/ModalCreateTaskFromTodo";
import type { SpotlightResult } from "../features/spotlight/types";
import { onTasksBulkChanged } from "../features/tasks/services/taskEvents";
import { getMessages } from "../i18n";

const parsed = vi.hoisted(() => ({ texts: [] as string[] }));

vi.mock("react-markdown", async () => {
    const actual = await vi.importActual<typeof import("react-markdown")>("react-markdown");
    const Counting = (props: React.ComponentProps<typeof actual.default>) => {
        parsed.texts.push(String(props.children));
        return <actual.default {...props} />;
    };
    return { ...actual, default: Counting };
});

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
    useOptionalAccessToken: () => "tok",
}));

// Above the providers the UrlLinkModal context is null; if it were present the save
// must still not use it (Open is the host's call).
const openModalByHref = vi.fn();
vi.mock("../hooks/common/UrlLinkModalContext", () => ({
    useUrlLinkModal: () => ({ openModalByHref }),
}));

const post = vi.fn();
vi.mock("../services/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/api")>();
    return { ...actual, authApi: () => ({ post: (...a: unknown[]) => post(...a) }) };
});

const loadTeamProjects = vi.fn();
const createQuickTask = vi.fn();
vi.mock("../features/tasks/services/loadTeamProjects", () => ({
    loadTeamProjects: (...args: unknown[]) => loadTeamProjects(...args),
}));
vi.mock("../features/tasks/services/createQuickTask", () => ({
    createQuickTask: (...args: unknown[]) => createQuickTask(...args),
}));
const loadProjectMilestones = vi.fn();
vi.mock("../features/tasks/sprint-milestone/services", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("../features/tasks/sprint-milestone/services")>();
    return {
        ...actual,
        loadProjectMilestones: (...args: unknown[]) => loadProjectMilestones(...args),
    };
});

const TASK: SpotlightResult = {
    entity_type: "task",
    entity_id: "task:12",
    title: "Fix login redirect",
    snippet: null,
    score: 1,
    keyword_rank: 1,
    vector_rank: null,
    matched_chunk_types: [],
    matched_terms: [],
    updated_at: null,
    chat_type: null,
    chat_id: null,
    thread_id: null,
    message_id: null,
    task_id: "12",
    task_display_id: "PRJ-12",
    note_id: null,
    note_type: null,
    project_id: "7",
    related_entity_ids: [],
};

const en = () => buildAgentTurnLabels(getMessages("en"), "spotlight");

const baseProps = (over: Partial<AgentTurnProps> = {}): AgentTurnProps => ({
    askedQuery: "What shipped last week?",
    answer: "## Result\n\nShipped [the fix](task:12).",
    answerSources: [TASK],
    askError: null,
    isCurrent: false,
    isDark: false,
    labels: en(),
    toolEvents: [],
    runId: "run-1",
    onPreview: vi.fn(),
    renderExtraActions: renderSaveAnswerActions,
    renderAnswerStatus: renderSaveAnswerStatus,
    ...over,
});

const renderTurn = (over: Partial<AgentTurnProps> = {}) => {
    const props = baseProps(over);
    const view = render(
        <CssVarsProvider>
            <AgentTurn {...props} />
        </CssVarsProvider>
    );
    return { ...view, props };
};

const noteButton = () => screen.queryByRole("button", { name: "Save as note" });
const taskButton = () => screen.queryByRole("button", { name: "Save as task" });

const axiosError = (status: number, data: unknown) =>
    new AxiosError("fail", "ERR_BAD_REQUEST", undefined, undefined, {
        status,
        data,
    } as AxiosResponse);

beforeEach(() => {
    resetSaveStore();
    parsed.texts.length = 0;
    localStorage.clear();
    localStorage.setItem("teamId", "t1");
    localStorage.setItem("userId", "u1");
    post.mockResolvedValue({ data: { noteId: 77 } });
    loadTeamProjects.mockResolvedValue([
        { projectId: 42, projectName: "Platform" },
        { projectId: 7, projectName: "Marketing" },
    ]);
    createQuickTask.mockResolvedValue({ taskId: 101, displayId: "PLT-1" });
    loadProjectMilestones.mockResolvedValue({ milestones: [] });
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("where the buttons are", () => {
    it("offers both on a finished answer, without any provider", () => {
        renderTurn();
        expect(noteButton()).toBeTruthy();
        expect(taskButton()).toBeTruthy();
    });

    it("says exactly what each click does", () => {
        renderTurn();
        // The tooltip is the button's description; assert the copy the person gets.
        const en = getMessages("en").agentSave;
        expect(en.note.tooltip).toBe("Save this answer as a note in My Notes");
        expect(en.task.tooltip).toBe("Create a task from this answer");
    });

    it.each([
        ["an error turn", { askError: "The agent failed." }],
        ["a turn with no answer", { answer: "" }],
        ["a whitespace-only answer", { answer: "  \n " }],
        ["a streaming in-flight turn", { isCurrent: true, isStreaming: true }],
        ["a turn cancelled before done (no run)", { runId: null }],
    ] as const)("offers neither on %s", (_name, over) => {
        renderTurn(over as Partial<AgentTurnProps>);
        expect(noteButton()).toBeNull();
        expect(taskButton()).toBeNull();
    });

    it("offers neither while a write waits for a decision (the text is not final)", () => {
        renderTurn({
            isCurrent: true,
            pendingApproval: {
                step: 1,
                tool_name: "update_task",
                arguments: { task_id: 12 },
                approval_token: "ap-1",
                run_id: "run-1",
            },
            onApprove: vi.fn(),
            onReject: vi.fn(),
        });
        expect(noteButton()).toBeNull();
    });

    it("offers them on the in-flight turn once it has finished", () => {
        renderTurn({ isCurrent: true, isStreaming: false });
        expect(noteButton()).toBeTruthy();
    });
});

describe("Save as note", () => {
    it("sends the full answer as blocks, with the question on top, to My Notes", async () => {
        renderTurn();
        fireEvent.click(noteButton()!);
        await screen.findByText("Saved to My Notes");

        expect(post).toHaveBeenCalledTimes(1);
        const [url, payload] = post.mock.calls[0];
        expect(url).toBe("/note/personal/");
        expect(payload).toMatchObject({
            team_id: "t1",
            user_id: "u1",
            parent_note_id: null,
            folder_id: null,
            title: "What shipped last week?",
        });
        const body = payload.body as Array<{
            type: string;
            content: Array<Record<string, unknown>>;
        }>;
        // The question line first, small and italic.
        expect(body[0].type).toBe("paragraph");
        expect(body[0].content[0]).toMatchObject({
            text: "Genos answer to: What shipped last week?",
            styles: { italic: true },
        });
        // Then the answer as real blocks, the citation as a link to what it cites.
        expect(body[1].type).toBe("heading");
        expect(JSON.stringify(body)).toContain("Shipped");
        expect(JSON.stringify(body)).toContain(sourceToUrl(TASK));
    });

    it("resolves a citation from the host's conversation-wide lookup (the Ask modals)", async () => {
        renderTurn({
            answerSources: [],
            sourcesById: new Map([["task:12", TASK]]),
        });
        fireEvent.click(noteButton()!);
        await screen.findByText("Saved to My Notes");
        expect(JSON.stringify(post.mock.calls[0][1].body)).toContain(sourceToUrl(TASK));
    });

    it("titles a question-less answer with the fallback and caps a long question", async () => {
        const long = `${"Why ".repeat(60)}?`;
        renderTurn({ askedQuery: long });
        fireEvent.click(noteButton()!);
        await screen.findByText("Saved to My Notes");
        const title = post.mock.calls[0][1].title as string;
        expect(Array.from(title).length).toBeLessThanOrEqual(80);
        expect(title.endsWith("…")).toBe(true);

        cleanup();
        resetSaveStore();
        post.mockClear();
        renderTurn({ askedQuery: "", runId: "run-2" });
        fireEvent.click(noteButton()!);
        await screen.findByText("Saved to My Notes");
        expect(post.mock.calls[0][1].title).toBe("Genos answer");
    });

    it("shows the result under the answer, outside the hover-revealed bar, and Open uses the host", async () => {
        const { container, props } = renderTurn();
        fireEvent.click(noteButton()!);
        const saved = await screen.findByText("Saved to My Notes");

        expect(container.querySelector(".turn-actions")?.contains(saved)).toBe(false);
        fireEvent.click(
            within(saved.parentElement as HTMLElement).getByRole("button", { name: "Open" })
        );
        expect(props.onPreview).toHaveBeenCalledTimes(1);
        expect(props.onPreview).toHaveBeenCalledWith(
            expect.objectContaining({
                entity_type: "note",
                entity_id: "note:personal:77",
                note_id: "77",
                note_type: "personal",
                title: "What shipped last week?",
            })
        );
        // It never navigates by itself.
        expect(openModalByHref).not.toHaveBeenCalled();
    });

    it("tells the notes sidebar a note was made", async () => {
        const seen: unknown[] = [];
        const listener = (e: Event) => seen.push((e as CustomEvent).detail);
        window.addEventListener("noteChanged", listener);
        try {
            renderTurn();
            fireEvent.click(noteButton()!);
            await screen.findByText("Saved to My Notes");
            expect(seen).toEqual([
                {
                    note: { note_id: 77, note_type: "personal", title: "What shipped last week?" },
                    noteFolder: undefined,
                },
            ]);
        } finally {
            window.removeEventListener("noteChanged", listener);
        }
    });

    it("turns the saved button into a check and offers no second save", async () => {
        renderTurn();
        fireEvent.click(noteButton()!);
        await screen.findByText("Saved to My Notes");
        expect(noteButton()).toBeNull();
        const done = screen.getAllByRole("button", {
            name: "Saved to My Notes",
        })[0] as HTMLButtonElement;
        expect(done.disabled).toBe(true);
    });

    it("sends ONE request for two clicks", async () => {
        let resolve!: (v: unknown) => void;
        post.mockReturnValueOnce(new Promise((r) => (resolve = r)));
        renderTurn();
        const button = noteButton()!;
        fireEvent.click(button);
        fireEvent.click(button);
        fireEvent.click(button);
        expect(post).toHaveBeenCalledTimes(1);
        await screen.findByText("Saving to My Notes…");
        await act(async () => resolve({ data: { noteId: 5 } }));
        await screen.findByText("Saved to My Notes");
        expect(post).toHaveBeenCalledTimes(1);
    });

    it("says it failed, keeps the button armed, and Try again saves", async () => {
        post.mockRejectedValueOnce(new Error("network"));
        renderTurn();
        fireEvent.click(noteButton()!);
        await screen.findByText("Couldn't save the note. Please try again.");
        // The button in the bar is the armed one again.
        expect(noteButton()).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        await screen.findByText("Saved to My Notes");
        expect(post).toHaveBeenCalledTimes(2);
        expect(screen.queryByText("Couldn't save the note. Please try again.")).toBeNull();
    });

    it("also retries from the bar's own button", async () => {
        post.mockRejectedValueOnce(new Error("network"));
        renderTurn();
        fireEvent.click(noteButton()!);
        await screen.findByText("Couldn't save the note. Please try again.");
        fireEvent.click(noteButton()!);
        await screen.findByText("Saved to My Notes");
    });

    it("says a plan limit is a plan limit, not a failure", async () => {
        post.mockRejectedValueOnce(axiosError(429, { limit_reached: true, error: "Upgrade" }));
        renderTurn();
        fireEvent.click(noteButton()!);
        await screen.findByText(/reached your plan's limit for notes/);
        expect(screen.queryByText("Couldn't save the note. Please try again.")).toBeNull();
    });

    it("does not call a non-limit 429 a plan limit", async () => {
        post.mockRejectedValueOnce(axiosError(429, { detail: "slow down" }));
        renderTurn();
        fireEvent.click(noteButton()!);
        await screen.findByText("Couldn't save the note. Please try again.");
    });

    it("refuses an answer over the size cap with a sentence and sends nothing", async () => {
        renderTurn({ answer: "x".repeat(MAX_ANSWER_BYTES + 1), answerSources: [] });
        fireEvent.click(noteButton()!);
        await screen.findByText("This answer is too long to save as a note.");
        expect(post).not.toHaveBeenCalled();
        // No pointless retry for something that will not change.
        expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    });

    it("counts the cap in bytes, not characters", async () => {
        // 3 bytes per character: under the cap as characters, over it as bytes.
        renderTurn({
            answer: "あ".repeat(Math.floor(MAX_ANSWER_BYTES / 3) + 1),
            answerSources: [],
        });
        fireEvent.click(noteButton()!);
        await screen.findByText("This answer is too long to save as a note.");
        expect(post).not.toHaveBeenCalled();
    });

    it("is signed-out safe: no team or user in storage fails with the sentence", async () => {
        localStorage.clear();
        renderTurn();
        fireEvent.click(noteButton()!);
        await screen.findByText("Couldn't save the note. Please try again.");
        expect(post).not.toHaveBeenCalled();
    });

    it("keeps one state for one answer shown in two places", async () => {
        const first = renderTurn();
        const second = render(
            <CssVarsProvider>
                <AgentTurn {...baseProps()} />
            </CssVarsProvider>
        );
        const buttons = screen.getAllByRole("button", { name: "Save as note" });
        expect(buttons).toHaveLength(2);
        fireEvent.click(buttons[0]);
        await waitFor(() => expect(screen.getAllByText("Saved to My Notes")).toHaveLength(2));
        expect(noteButton()).toBeNull();
        expect(post).toHaveBeenCalledTimes(1);
        first.unmount();
        second.unmount();
    });
});

describe("Save as task", () => {
    it("opens the to-do pane's dialog with the answer's wording, seeded from the question", async () => {
        renderTurn();
        fireEvent.click(taskButton()!);
        await screen.findByText("Create a task from this answer");
        expect(
            screen.getByText(
                "Copies the answer into the new task's description. The answer stays where it is."
            )
        ).toBeTruthy();
        const title = (await screen.findByPlaceholderText(
            "What needs doing?"
        )) as HTMLInputElement;
        expect(title.value).toBe("What shipped last week?");
        expect(screen.getByText("Project")).toBeTruthy();
        await waitFor(() => expect(loadTeamProjects).toHaveBeenCalled());
        // The identity above the providers is what sign-in left in storage.
        expect(loadTeamProjects.mock.calls[0][0]).toEqual({ teamId: "t1", userId: "u1" });
    });

    it("creates the task with the answer as its body, refreshes the task lists, and links to it", async () => {
        const refreshed: Array<number | null | undefined> = [];
        const off = onTasksBulkChanged((detail) => refreshed.push(detail.projectId));
        const { props } = renderTurn();
        fireEvent.click(taskButton()!);
        await screen.findByPlaceholderText("What needs doing?");
        await waitFor(() => expect(loadTeamProjects).toHaveBeenCalled());
        fireEvent.click(await screen.findByRole("button", { name: "Create task" }));

        await waitFor(() => expect(createQuickTask).toHaveBeenCalledTimes(1));
        const arg = createQuickTask.mock.calls[0][0];
        expect(arg).toMatchObject({
            myself: { teamId: "t1", userId: "u1" },
            projectId: 42,
            title: "What shipped last week?",
            parentTaskId: null,
            rootTaskId: null,
        });
        // The same blocks a note gets: the question line, then the answer.
        expect(arg.content[0].content[0]).toMatchObject({
            text: "Genos answer to: What shipped last week?",
        });
        expect(JSON.stringify(arg.content)).toContain(sourceToUrl(TASK));
        expect(refreshed).toContain(42);
        off();

        const saved = await screen.findByText("Task created");
        fireEvent.click(
            within(saved.parentElement as HTMLElement).getByRole("button", { name: "Open" })
        );
        expect(props.onPreview).toHaveBeenCalledWith(
            expect.objectContaining({
                entity_type: "task",
                entity_id: "task:101",
                task_id: "101",
                task_display_id: "PLT-1",
                project_id: "42",
            })
        );
        // The dialog's own "open the task" is off: Open is the host's call.
        expect(openModalByHref).not.toHaveBeenCalled();
        // The dialog is gone, and there is no second task from this answer.
        expect(screen.queryByPlaceholderText("What needs doing?")).toBeNull();
        expect(taskButton()).toBeNull();
    });

    it("creates nothing when the dialog is cancelled, and the button stays armed", async () => {
        renderTurn();
        fireEvent.click(taskButton()!);
        await screen.findByPlaceholderText("What needs doing?");
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        await waitFor(() => expect(screen.queryByPlaceholderText("What needs doing?")).toBeNull());
        expect(createQuickTask).not.toHaveBeenCalled();
        expect(taskButton()).toBeTruthy();
        expect(screen.queryByText("Task created")).toBeNull();
    });

    it("says a refused create is a plan limit, inside the dialog, and leaves it open", async () => {
        const { LimitReachedError } = await import("../services/limitErrors");
        createQuickTask.mockRejectedValueOnce(new LimitReachedError("Task limit reached (50)."));
        renderTurn();
        fireEvent.click(taskButton()!);
        await screen.findByPlaceholderText("What needs doing?");
        await waitFor(() => expect(loadTeamProjects).toHaveBeenCalled());
        fireEvent.click(await screen.findByRole("button", { name: "Create task" }));
        await screen.findByText("Task limit reached (50).");
        expect(screen.getByPlaceholderText("What needs doing?")).toBeTruthy();
        expect(screen.queryByText("Task created")).toBeNull();
    });

    it("refuses an answer over the size cap before opening anything", async () => {
        renderTurn({ answer: "x".repeat(MAX_ANSWER_BYTES + 1), answerSources: [] });
        fireEvent.click(taskButton()!);
        await screen.findByText("This answer is too long to turn into a task.");
        expect(screen.queryByPlaceholderText("What needs doing?")).toBeNull();
        expect(loadTeamProjects).not.toHaveBeenCalled();
    });

    it("opens above the Spotlight overlay", async () => {
        renderTurn();
        fireEvent.click(taskButton()!);
        await screen.findByPlaceholderText("What needs doing?");
        const root = document.querySelector('[role="presentation"]') as HTMLElement;
        expect(getComputedStyle(root).zIndex).toBe("13200");
    });
});

// What renders the dialog must not hear it. A portal's events reach the components
// that rendered it through the React tree, so a dialog opened from the overlay or from
// another modal would otherwise be heard by them.
describe("the task dialog cannot be heard by what rendered it", () => {
    const Host = ({
        onKeyDown,
        onClick,
        onMouseDown,
        isolate,
    }: {
        onKeyDown: (e: React.KeyboardEvent) => void;
        onClick: () => void;
        onMouseDown: () => void;
        isolate: boolean;
    }) => {
        const [open, setOpen] = useState(true);
        return (
            // A stand-in for the overlay: it listens to keys, clicks and mousedowns.
            <div onClick={onClick} onKeyDown={onKeyDown} onMouseDown={onMouseDown}>
                <ModalCreateTaskFromTodo
                    isolateEvents={isolate}
                    myself={{ teamId: "t1", userId: "u1" }}
                    open={open}
                    todoNotes={null}
                    todoTitle="Ship it"
                    onClose={() => setOpen(false)}
                />
            </div>
        );
    };

    const mount = (isolate: boolean) => {
        const spies = { key: vi.fn(), click: vi.fn(), down: vi.fn() };
        const docKeys: string[] = [];
        const docListener = (e: KeyboardEvent) => docKeys.push(e.key);
        document.addEventListener("keydown", docListener);
        render(
            <CssVarsProvider>
                <Host
                    isolate={isolate}
                    onClick={spies.click}
                    onKeyDown={spies.key}
                    onMouseDown={spies.down}
                />
            </CssVarsProvider>
        );
        return { spies, docKeys, off: () => document.removeEventListener("keydown", docListener) };
    };

    it("hears nothing from typing, Enter, clicks or mousedown inside it", async () => {
        const { spies, docKeys, off } = mount(true);
        const title = (await screen.findByPlaceholderText(
            "What needs doing?"
        )) as HTMLInputElement;
        await waitFor(() => expect(loadTeamProjects).toHaveBeenCalled());
        await screen.findByRole("button", { name: "Create task" });

        fireEvent.keyDown(title, { key: "a" });
        fireEvent.mouseDown(title);
        fireEvent.click(title);
        fireEvent.click(screen.getByText("Project"));
        fireEvent.keyDown(title, { key: "Enter" });
        await waitFor(() => expect(createQuickTask).toHaveBeenCalledTimes(1));

        expect(spies.key).not.toHaveBeenCalled();
        expect(spies.click).not.toHaveBeenCalled();
        expect(spies.down).not.toHaveBeenCalled();
        expect(docKeys).not.toContain("Enter");
        off();
    });

    it("closes on Escape by itself, and the host hears no Escape", async () => {
        const { spies, off } = mount(true);
        const title = await screen.findByPlaceholderText("What needs doing?");
        fireEvent.keyDown(title, { key: "Escape" });
        await waitFor(() => expect(screen.queryByPlaceholderText("What needs doing?")).toBeNull());
        expect(spies.key).not.toHaveBeenCalled();
        off();
    });

    it("control: without isolation the host DOES hear it (the test can fail)", async () => {
        const { spies, off } = mount(false);
        const title = await screen.findByPlaceholderText("What needs doing?");
        fireEvent.keyDown(title, { key: "a" });
        fireEvent.click(title);
        expect(spies.key).toHaveBeenCalled();
        expect(spies.click).toHaveBeenCalled();
        off();
    });
});

describe("the render budget", () => {
    it("re-parses nothing and re-renders the turn for nothing when a save happens", async () => {
        const extra = vi.fn(renderSaveAnswerActions);
        const status = vi.fn(renderSaveAnswerStatus);
        renderTurn({ renderExtraActions: extra, renderAnswerStatus: status });
        const parsesBefore = parsed.texts.length;
        const callsBefore = extra.mock.calls.length;
        expect(callsBefore).toBeGreaterThan(0);

        fireEvent.click(noteButton()!);
        await screen.findByText("Saved to My Notes");

        // The save re-rendered the two small controls through the store, not the turn.
        expect(extra.mock.calls.length).toBe(callsBefore);
        expect(status.mock.calls.length).toBe(callsBefore);
        expect(parsed.texts.length).toBe(parsesBefore);
    });

    it("does not re-render a finished turn when the host re-renders with the same props", () => {
        const props = baseProps();
        const view = render(
            <CssVarsProvider>
                <AgentTurn {...props} />
            </CssVarsProvider>
        );
        const parses = parsed.texts.length;
        for (let i = 0; i < 5; i++) {
            view.rerender(
                <CssVarsProvider>
                    <AgentTurn {...props} />
                </CssVarsProvider>
            );
        }
        expect(parsed.texts.length).toBe(parses);
    });

    it("hands every host the same two functions for ever (module-level)", async () => {
        const again = await import("../features/agentQA/saveAnswer/SaveAnswerActions");
        expect(again.renderSaveAnswerActions).toBe(renderSaveAnswerActions);
        expect(again.renderSaveAnswerStatus).toBe(renderSaveAnswerStatus);
    });
});
