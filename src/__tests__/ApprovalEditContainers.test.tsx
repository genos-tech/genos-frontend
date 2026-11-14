/**
 * Edit before approve, on every host of the answer turn: the Spotlight overlay
 * and the Genos page (`SpotlightContent`), the thread Ask modal and the note
 * Ask modal. One card, one `AgentTurn`: the same behaviour on each, and no
 * per-host code, which is the point of #650. These drive each host through its
 * public entry point (as `AnswerTurnContainers.test.tsx` does) with the same
 * fixtures.
 *
 * The optional reason on Reject (MIP-889) is pinned here on the same hosts.
 *
 * What differs by host and so is pinned separately: Escape. Spotlight closes on
 * a document-level Escape listener, the Joy modals on their own Escape handler;
 * an Escape that only cancels an edit must not close either.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import type { AskState, UseAgentQAReturn } from "../features/agentQA";
import { EMPTY_ASK_STATE } from "../features/agentQA/types";
import { NoteAskModal } from "../features/noteAsk/NoteAskModal";
import type { UseNoteAskReturn } from "../features/noteAsk/useNoteAsk";
import { SpotlightContent } from "../features/spotlight/SpotlightContent";
import { SpotlightOverlay } from "../features/spotlight/SpotlightOverlay";
import { useSpotlight } from "../features/spotlight/useSpotlight";
import { ThreadAskModal } from "../features/threadAsk/ThreadAskModal";
import type { UseThreadAskReturn } from "../features/threadAsk/useThreadAsk";
import { askAgentStream, decideAgent, type PendingApprovalPayload } from "../services/agentApi";

// The mention picker drags in the team/task/note stores and isn't under test.
vi.mock("../features/agentQA", async () => {
    const actual =
        await vi.importActual<typeof import("../features/agentQA")>("../features/agentQA");
    return {
        ...actual,
        AgentQAInput: () => <div data-testid="qa-input" />,
    };
});

vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));

vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return {
        ...actual,
        askAgentStream: vi.fn(async () => {}),
        decideAgent: vi.fn(async () => {}),
        fetchAgentSessionDetail: vi.fn(async () => null),
        fetchAgentSessions: vi.fn(async () => []),
        submitAgentFeedback: vi.fn(async () => true),
    };
});

vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

const PENDING: PendingApprovalPayload = {
    step: 1,
    tool_name: "update_task",
    arguments: { task_id: "PRJ-12", title: "Fix login", due_date: "2026-11-20", priority: "High" },
    editable: ["title", "due_date", "priority"],
    approval_token: "ap-1",
    run_id: "run-3",
};

const liveAsk = (over: Partial<AskState> = {}): AskState => ({
    ...EMPTY_ASK_STATE,
    askedQuery: "Rename it",
    pendingApproval: PENDING,
    ...over,
});

type Spy = Mock<(...args: unknown[]) => unknown>;

interface Handlers {
    approve: Spy;
    reject: Spy;
    close: Spy;
}

interface Surface {
    name: string;
    mount: (ask: AskState) => Handlers;
    // The host closes itself on an Escape the editor did not take.
    closesOnEscape: boolean;
}

const agentQAState = (ask: AskState, h: Handlers) =>
    ({
        query: "",
        setQuery: vi.fn(),
        ask,
        turns: [],
        sessionId: "sess-1",
        onAsk: vi.fn(),
        onCancel: vi.fn(),
        onApprove: h.approve,
        onReject: h.reject,
        clearConversation: vi.fn(),
        reset: vi.fn(),
        submitFeedback: vi.fn(),
    }) as unknown as UseAgentQAReturn;

const newHandlers = (): Handlers => ({ approve: vi.fn(), reject: vi.fn(), close: vi.fn() });

const spotlightPage: Surface = {
    name: "Spotlight (Genos page)",
    closesOnEscape: false,
    mount: (ask) => {
        const h = newHandlers();
        render(
            <CssVarsProvider>
                <SpotlightContent
                    ask={ask}
                    backToHistoryList={vi.fn()}
                    closeHistory={vi.fn()}
                    error={null}
                    filterServices={[]}
                    historyDetail={null}
                    historyIsLoading={false}
                    historyLoadFailed={false}
                    historyMode="closed"
                    historySessions={[]}
                    isLoading={false}
                    openHistory={vi.fn()}
                    query=""
                    results={[]}
                    turns={[]}
                    variant="page"
                    viewHistorySession={vi.fn()}
                    aiAnswersEnabled
                    onApprove={h.approve}
                    onAsk={vi.fn()}
                    onCancel={vi.fn()}
                    onFeedback={vi.fn()}
                    onNewConversation={vi.fn()}
                    onOpenSettings={vi.fn()}
                    onPreview={vi.fn()}
                    onQueryChange={vi.fn()}
                    onReject={h.reject}
                    onSelect={vi.fn()}
                    onToggleFilterService={vi.fn()}
                />
            </CssVarsProvider>
        );
        return h;
    },
};

const threadAsk: Surface = {
    name: "ThreadAskModal",
    closesOnEscape: true,
    mount: (ask) => {
        const h = newHandlers();
        const state = {
            isOpen: true,
            open: vi.fn(),
            close: h.close,
            threadContext: { chatType: 2, chatId: 77, threadId: 404 },
            summary: {
                text: "Ten messages about the launch.",
                lastUpdatedIso: "2026-07-29T09:00:00Z",
                fingerprint: "fp-1",
                messageCount: 10,
            },
            summaryLoading: false,
            summaryError: null,
            refreshSummary: vi.fn(),
            staleSummary: false,
            agentQA: agentQAState(ask, h),
        } as unknown as UseThreadAskReturn;
        render(
            <CssVarsProvider>
                <ThreadAskModal
                    accessToken="tok"
                    chatName="Launch"
                    myself={{ userId: "u1", teamId: "t1" } as never}
                    state={state}
                />
            </CssVarsProvider>
        );
        return h;
    },
};

const noteAsk: Surface = {
    name: "NoteAskModal",
    closesOnEscape: true,
    mount: (ask) => {
        const h = newHandlers();
        const state = {
            isOpen: true,
            open: vi.fn(),
            close: h.close,
            noteContext: { noteType: 1, noteId: 5 },
            summary: {
                text: "A note about the launch.",
                lastUpdatedIso: "2026-07-29T09:00:00Z",
                fingerprint: "fp-1",
                bodyLength: 120,
                noteTitle: "Launch",
            },
            summaryLoading: false,
            summaryError: null,
            refreshSummary: vi.fn(),
            staleSummary: false,
            agentQA: agentQAState(ask, h),
        } as unknown as UseNoteAskReturn;
        render(
            <CssVarsProvider>
                <NoteAskModal state={state} />
            </CssVarsProvider>
        );
        return h;
    },
};

const SURFACES = [spotlightPage, threadAsk, noteAsk];

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

const open = () => fireEvent.click(screen.getByRole("button", { name: "Edit" }));

describe.each(SURFACES)("$name: edit before approve", (surface) => {
    it("offers Edit on a card whose tool has editable paths", () => {
        surface.mount(liveAsk());
        expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    });

    it("offers nothing new on a tool with nothing editable", () => {
        surface.mount(
            liveAsk({ pendingApproval: { ...PENDING, tool_name: "delete_note", editable: [] } })
        );
        expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    });

    it("a plain approve reaches the host's onApprove with nothing", () => {
        const h = surface.mount(liveAsk());
        fireEvent.click(screen.getByRole("button", { name: "Approve" }));
        expect(h.approve).toHaveBeenCalledTimes(1);
        expect(h.approve.mock.calls[0]).toEqual([]);
    });

    it("an edited approve reaches the host's onApprove with ONLY the changed fields", () => {
        const h = surface.mount(liveAsk());
        open();
        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fix the login" } });
        fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-12-01" } });
        fireEvent.click(screen.getByRole("button", { name: "Approve with your changes" }));
        expect(h.approve).toHaveBeenCalledTimes(1);
        expect(h.approve.mock.calls[0]).toEqual([
            { title: "Fix the login", due_date: "2026-12-01" },
        ]);
    });

    it("a reject carries nothing, edited or not", () => {
        const h = surface.mount(liveAsk());
        open();
        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Changed" } });
        fireEvent.click(screen.getByRole("button", { name: "Reject" }));
        expect(h.reject).toHaveBeenCalledTimes(1);
        expect(h.reject.mock.calls[0]).toEqual([]);
        expect(h.approve).not.toHaveBeenCalled();
    });

    it("reopens on the refused edits, with the server's sentence beside the field", () => {
        surface.mount(
            liveAsk({
                approvalFieldErrors: { due_date: "Due date: that date is not allowed here." },
                approvalEdits: { due_date: "2026-12-25", title: "Renamed" },
            })
        );
        expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Renamed");
        expect((screen.getByLabelText("Due date") as HTMLInputElement).value).toBe("2026-12-25");
        expect(screen.getByText("Due date: that date is not allowed here.")).toBeTruthy();
        expect(screen.getByRole("alert").textContent).toContain("Nothing was approved or run");
        expect(document.activeElement).toBe(screen.getByLabelText("Due date"));
    });

    it("Escape in an editor cancels the edit and does not close the host", () => {
        const h = surface.mount(liveAsk());
        open();
        fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });
        expect(screen.queryByLabelText("Title")).toBeNull();
        expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
        expect(h.close).not.toHaveBeenCalled();
    });

    it("the same Escape, outside an edit, is still the host's to take", () => {
        const h = surface.mount(liveAsk());
        fireEvent.keyDown(screen.getByRole("button", { name: "Edit" }), { key: "Escape" });
        if (surface.closesOnEscape) expect(h.close).toHaveBeenCalledTimes(1);
        else expect(h.close).not.toHaveBeenCalled();
    });

    it("Enter in an editor approves nothing", () => {
        const h = surface.mount(liveAsk());
        open();
        fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Enter" });
        expect(h.approve).not.toHaveBeenCalled();
    });
});

// MIP-889: a reason on Reject, the same on every host (one card, one `decide`).
const REASON_ADD = "Reject with a reason";
const reasonField = () => screen.getByLabelText("Reason (optional)") as HTMLTextAreaElement;

describe.each(SURFACES)("$name: a reason on reject", (surface) => {
    it("plain Reject is still one click and reaches the host's onReject with nothing", () => {
        const h = surface.mount(liveAsk());
        fireEvent.click(screen.getByRole("button", { name: "Reject" }));
        expect(h.reject).toHaveBeenCalledTimes(1);
        expect(h.reject.mock.calls[0]).toEqual([]);
    });

    it("a typed reason reaches the host's onReject trimmed", () => {
        const h = surface.mount(liveAsk());
        fireEvent.click(screen.getByRole("button", { name: REASON_ADD }));
        fireEvent.change(reasonField(), { target: { value: "  Wrong project.  " } });
        fireEvent.click(screen.getByRole("button", { name: "Reject" }));
        expect(h.reject.mock.calls).toEqual([["Wrong project."]]);
        expect(h.approve).not.toHaveBeenCalled();
    });

    it("Escape in the reason field closes it and does not close the host", () => {
        const h = surface.mount(liveAsk());
        fireEvent.click(screen.getByRole("button", { name: REASON_ADD }));
        fireEvent.keyDown(reasonField(), { key: "Escape" });
        expect(screen.queryByLabelText("Reason (optional)")).toBeNull();
        expect(h.close).not.toHaveBeenCalled();
        expect(h.reject).not.toHaveBeenCalled();
    });

    it("Enter in the reason field rejects nothing and does not close the host", () => {
        const h = surface.mount(liveAsk());
        fireEvent.click(screen.getByRole("button", { name: REASON_ADD }));
        fireEvent.change(reasonField(), { target: { value: "Wrong project." } });
        fireEvent.keyDown(reasonField(), { key: "Enter" });
        expect(h.reject).not.toHaveBeenCalled();
        expect(h.close).not.toHaveBeenCalled();
    });
});

describe("the Spotlight overlay (the real hook, above everything at z-index 13100)", () => {
    const Harness = () => {
        const s = useSpotlight({ accessToken: "tok", teamId: "1" });
        (window as unknown as { __s: ReturnType<typeof useSpotlight> }).__s = s;
        return (
            <SpotlightOverlay
                aiAnswersEnabled={s.aiAnswersEnabled}
                ask={s.ask}
                backToHistoryList={s.backToHistoryList}
                closeHistory={s.closeHistory}
                error={s.error}
                filterProjectIds={s.filterProjectIds}
                filterServices={s.filterServices}
                historyDetail={s.historyDetail}
                historyIsLoading={s.historyIsLoading}
                historyLoadFailed={s.historyLoadFailed}
                historyMode={s.historyMode}
                historySessions={s.historySessions}
                isLoading={s.isLoading}
                isOpen={s.isOpen}
                openHistory={s.openHistory}
                query={s.query}
                results={s.results}
                turns={s.turns}
                viewHistorySession={s.viewHistorySession}
                onApprove={s.onApprove}
                onAsk={s.onAsk}
                onCancel={s.onCancel}
                onChangeFilterProjects={s.onChangeFilterProjects}
                onClose={s.close}
                onFeedback={s.submitFeedback}
                onNewConversation={s.onNewConversation}
                onOpenSettings={vi.fn()}
                onPreview={vi.fn()}
                onQueryChange={s.setQuery}
                onReject={s.onReject}
                onSelect={vi.fn()}
                onToggleFilterService={s.onToggleFilterService}
            />
        );
    };

    const spot = () => (window as unknown as { __s: ReturnType<typeof useSpotlight> }).__s;

    const openWithApproval = () => {
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onPendingApproval?.(PENDING);
        });
        render(
            <CssVarsProvider>
                <Harness />
            </CssVarsProvider>
        );
        act(() => spot().open());
        act(() => {
            spot().onAsk("rename it");
        });
    };

    const escape = (target: Element) =>
        act(() => {
            // Spotlight listens on `document`: dispatch a real, bubbling event from the target.
            target.dispatchEvent(
                new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
            );
        });

    it("Escape in an editor cancels the edit; the overlay stays open until the NEXT Escape", () => {
        openWithApproval();
        open();
        escape(screen.getByLabelText("Title"));
        expect(screen.queryByLabelText("Title")).toBeNull();
        expect(spot().isOpen).toBe(true);
        escape(screen.getByRole("button", { name: "Edit" }));
        expect(spot().isOpen).toBe(false);
    });

    it("Escape in the reason field closes it; the overlay stays open until the NEXT Escape", () => {
        openWithApproval();
        fireEvent.click(screen.getByRole("button", { name: REASON_ADD }));
        escape(reasonField());
        expect(screen.queryByLabelText("Reason (optional)")).toBeNull();
        expect(spot().isOpen).toBe(true);
        expect(decideAgent).not.toHaveBeenCalled();
        escape(screen.getByRole("button", { name: REASON_ADD }));
        expect(spot().isOpen).toBe(false);
    });

    it("a reason goes through the one decision path, once, however fast the clicks", () => {
        openWithApproval();
        fireEvent.click(screen.getByRole("button", { name: REASON_ADD }));
        fireEvent.change(reasonField(), { target: { value: " Wrong project. " } });
        const button = screen.getByRole("button", { name: "Reject" });
        fireEvent.click(button);
        fireEvent.click(button);
        expect(decideAgent).toHaveBeenCalledTimes(1);
        const call = vi.mocked(decideAgent).mock.calls[0][0];
        expect(call).toMatchObject({
            decision: "reject",
            runId: "run-3",
            approvalToken: "ap-1",
            reason: "Wrong project.",
        });
        expect(call).not.toHaveProperty("editedArgs");
        // The card is gone while the request is in flight.
        expect(screen.queryByLabelText("Reason (optional)")).toBeNull();
    });

    it("a plain Reject through the real hook sends no reason at all", () => {
        openWithApproval();
        fireEvent.click(screen.getByRole("button", { name: "Reject" }));
        expect(decideAgent).toHaveBeenCalledTimes(1);
        expect(vi.mocked(decideAgent).mock.calls[0][0]).not.toHaveProperty("reason");
    });

    it("approving an edit sends it through the one decision path, and a 422 brings the card back", async () => {
        openWithApproval();
        open();
        fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-12-25" } });
        fireEvent.click(screen.getByRole("button", { name: "Approve with your changes" }));
        expect(decideAgent).toHaveBeenCalledTimes(1);
        const call = vi.mocked(decideAgent).mock.calls[0][0];
        expect(call).toMatchObject({
            decision: "approve",
            runId: "run-3",
            editedArgs: { due_date: "2026-12-25" },
        });
        // The card is gone while the request is in flight ...
        expect(screen.queryByLabelText("Due date")).toBeNull();
        // ... and the server's 422 gives it back, on what was typed.
        act(() =>
            call.onEditsRejected?.({
                message: "Some of your changes can't be applied.",
                fieldErrors: { due_date: "Due date: that date is not allowed here." },
            })
        );
        expect((screen.getByLabelText("Due date") as HTMLInputElement).value).toBe("2026-12-25");
        expect(screen.getByText("Due date: that date is not allowed here.")).toBeTruthy();
        // Fix it and approve again: the same token, one more request.
        fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-12-24" } });
        fireEvent.click(screen.getByRole("button", { name: "Approve with your changes" }));
        expect(decideAgent).toHaveBeenCalledTimes(2);
        expect(vi.mocked(decideAgent).mock.calls[1][0]).toMatchObject({
            approvalToken: "ap-1",
            editedArgs: { due_date: "2026-12-24" },
        });
    });
});
