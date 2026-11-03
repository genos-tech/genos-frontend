/**
 * AgentTurn, the one answer turn every agent surface renders.
 *
 * Rendered bare, with props only: no I18nProvider, no UrlLinkModalProvider, no
 * Avatar context. That is the point, Spotlight mounts above all of them.
 * Labels come from the real catalog through `buildAgentTurnLabels`, in
 * English and Japanese, so a label that was dropped from the contract shows up
 * here as English text in a Japanese turn.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
    AgentTurn,
    type AgentTurnActionContext,
    type AgentTurnProps,
} from "../features/agentQA/AgentTurn";
import { buildAgentTurnLabels } from "../features/agentQA/agentTurnLabels";
import { sourceChipLabel } from "../features/agentQA/sourceChipLabel";
import type { SpotlightResult } from "../features/spotlight/types";
import { getMessages, loadLocale } from "../i18n";
import type { PendingApprovalPayload } from "../services/agentApi";

const parsed = vi.hoisted(() => ({ texts: [] as string[] }));
const cardProps = vi.hoisted(() => ({ seen: [] as Array<Record<string, unknown>> }));

// The real card, with its props recorded: the mount must be a passthrough.
vi.mock("../features/agentQA/ApprovalCard", async () => {
    const actual = await vi.importActual<typeof import("../features/agentQA/ApprovalCard")>(
        "../features/agentQA/ApprovalCard"
    );
    return {
        ...actual,
        ApprovalCard: (props: React.ComponentProps<typeof actual.ApprovalCard>) => {
            cardProps.seen.push(props as unknown as Record<string, unknown>);
            return <actual.ApprovalCard {...props} />;
        },
    };
});

vi.mock("react-markdown", async () => {
    const actual = await vi.importActual<typeof import("react-markdown")>("react-markdown");
    const Counting = (props: React.ComponentProps<typeof actual.default>) => {
        parsed.texts.push(String(props.children));
        return <actual.default {...props} />;
    };
    return { ...actual, default: Counting };
});

const source = (over: Partial<SpotlightResult> = {}): SpotlightResult => ({
    entity_type: "task",
    entity_id: "task:12",
    title: "Fix login redirect",
    snippet: null,
    score: 1,
    keyword_rank: 1,
    vector_rank: null,
    matched_chunk_types: ["task_title_body"],
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
    ...over,
});

const TASK = source();
const NOTE = source({
    entity_type: "note",
    entity_id: "note:personal:42",
    title: "Release notes",
    task_id: null,
    task_display_id: null,
    note_id: "42",
    note_type: "personal",
});
const MILESTONE = source({
    entity_type: "milestone",
    entity_id: "milestone:9",
    title: "Beta launch",
    task_id: "9",
    task_display_id: "PRJ-9",
});

// Six distinct tasks, all cited: the chip row must collapse at four.
const MANY = Array.from({ length: 6 }, (_, i) =>
    source({
        entity_id: `task:${100 + i}`,
        task_id: String(100 + i),
        task_display_id: `PRJ-${100 + i}`,
        title: `Spike ${i + 1}`,
    })
);
const citeAll = (sources: SpotlightResult[]) => sources.map((s) => `[${s.entity_id}]`).join(" ");

const PENDING: PendingApprovalPayload = {
    step: 1,
    tool_name: "update_task",
    arguments: { task_id: 12, status: "Done" },
    approval_token: "ap-1",
    run_id: "run-9",
};

beforeAll(async () => {
    await loadLocale("ja");
});

afterEach(() => {
    parsed.texts.length = 0;
    cardProps.seen.length = 0;
    localStorage.clear();
    vi.restoreAllMocks();
});

const en = () => buildAgentTurnLabels(getMessages("en"), "spotlight");
const ja = () => buildAgentTurnLabels(getMessages("ja"), "spotlight");

const baseProps = (over: Partial<AgentTurnProps> = {}): AgentTurnProps => ({
    askedQuery: "What shipped last week?",
    answer: "Shipped.",
    answerSources: [],
    askError: null,
    isCurrent: false,
    isDark: false,
    labels: en(),
    toolEvents: [],
    onPreview: vi.fn(),
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

describe("answer markdown and citations", () => {
    it("renders markdown", () => {
        renderTurn({ answer: "A **bold** claim.\n\n- first\n- second" });
        expect(screen.getByText("bold").tagName).toBe("STRONG");
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("turns a resolved inline citation into a button that opens that source", () => {
        const { props } = renderTurn({
            answer: "Done in [the fix](task:12).",
            answerSources: [TASK],
        });
        fireEvent.click(screen.getByRole("button", { name: "the fix" }));
        expect(props.onPreview).toHaveBeenCalledWith(TASK);
    });

    it("leaves an unresolved citation as plain prose, not a dead link", () => {
        renderTurn({ answer: "Done in [the fix](task:99).", answerSources: [TASK] });
        expect(screen.queryByRole("button", { name: "the fix" })).toBeNull();
        expect(screen.getByText(/Done in the fix\./)).toBeTruthy();
    });

    it("strips a bare token from the prose and chips the source", () => {
        const { props } = renderTurn({
            answer: "See [note:personal:42].",
            answerSources: [NOTE],
        });
        expect(screen.queryByText(/note:personal/)).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: /Release notes/ }));
        expect(props.onPreview).toHaveBeenCalledWith(NOTE);
    });

    it("keeps an external link out of the citation path and says where it goes", () => {
        renderTurn({ answer: "Read [the doc](https://example.org/x)." });
        const link = screen.getByRole("link", { name: /the doc/ });
        expect(link.getAttribute("href")).toBe("https://example.org/x");
        expect(link.textContent).toContain("example.org");
    });

    it("resolves per turn by default and across turns when the host passes a lookup", () => {
        const answer = "As before, [the fix](task:12) is done.";
        const first = renderTurn({ answer, answerSources: [] });
        expect(screen.queryByRole("button", { name: "the fix" })).toBeNull();
        first.unmount();

        const lookup = new Map([["task:12", TASK]]);
        const { props } = renderTurn({ answer, answerSources: [], sourcesById: lookup });
        fireEvent.click(screen.getByRole("button", { name: "the fix" }));
        expect(props.onPreview).toHaveBeenCalledWith(TASK);
        // The chip row is still per turn: nothing was retrieved here.
        expect(screen.queryByRole("button", { name: /Fix login redirect/ })).toBeNull();
    });

    it.each([
        ["en", en, "Task"],
        ["ja", ja, "タスク"],
    ])(
        "%s: a raw-token label on a title-less source reads as the localized kind",
        (_l, labels, word) => {
            // A weak model emits `[task:12](task:12)`; with no title and no id to
            // show, the link text falls back to the kind word, in the viewer's language.
            renderTurn({
                answer: "Per [task:12](task:12).",
                answerSources: [source({ title: "", task_display_id: null })],
                labels: labels(),
            });
            expect(screen.getByRole("button", { name: word })).toBeTruthy();
        }
    );
});

describe("source chips", () => {
    it("shows the first four, then +N more, and expands and collapses", () => {
        renderTurn({ answer: citeAll(MANY), answerSources: MANY });
        const chips = () => screen.getAllByRole("button", { name: /Spike/ });
        expect(chips()).toHaveLength(4);
        fireEvent.click(screen.getByRole("button", { name: "+2 more" }));
        expect(chips()).toHaveLength(6);
        expect(screen.queryByRole("button", { name: "+2 more" })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Show less" }));
        expect(chips()).toHaveLength(4);
    });

    it("does not offer to expand at exactly four", () => {
        renderTurn({ answer: citeAll(MANY.slice(0, 4)), answerSources: MANY.slice(0, 4) });
        expect(screen.getAllByRole("button", { name: /Spike/ })).toHaveLength(4);
        expect(screen.queryByRole("button", { name: /more/ })).toBeNull();
    });

    it("reads in Japanese: chip text, the +N more and Show less", () => {
        const labels = ja();
        renderTurn({ answer: citeAll(MANY), answerSources: MANY, labels });
        const t = getMessages("ja").spotlight;
        // The chip is the catalog's template filled in, not English.
        expect(
            screen.getByRole("button", { name: sourceChipLabel(MANY[0], labels) })
        ).toBeTruthy();
        expect(sourceChipLabel(MANY[0], labels)).not.toMatch(/^Task /);
        fireEvent.click(
            screen.getByRole("button", { name: t.actions.moreCount.replace("{count}", "2") })
        );
        expect(screen.getByRole("button", { name: t.actions.showLess })).toBeTruthy();
    });

    it("labels chips with the Spotlight vocabulary (kind, id, title)", () => {
        renderTurn({ answer: citeAll([TASK, NOTE]), answerSources: [TASK, NOTE] });
        expect(
            screen.getByRole("button", { name: "Task PRJ-12: Fix login redirect" })
        ).toBeTruthy();
        expect(screen.getByRole("button", { name: "My note: Release notes" })).toBeTruthy();
    });

    it("lets a cited team note read as Team note when the host knows the scopes", () => {
        renderTurn({
            answer: "[note:personal:42]",
            answerSources: [NOTE],
            noteScopes: new Map([[42, "team" as const]]),
        });
        expect(screen.getByRole("button", { name: "Team note: Release notes" })).toBeTruthy();
    });

    it("gives a milestone the flag icon and a task the clipboard", () => {
        renderTurn({
            answer: citeAll([MILESTONE, TASK]),
            answerSources: [MILESTONE, TASK],
        });
        const milestone = screen.getByRole("button", { name: /Beta launch/ });
        const task = screen.getByRole("button", { name: /Fix login redirect/ });
        expect(within(milestone.parentElement!).getByTestId("FlagRoundedIcon")).toBeTruthy();
        expect(within(task.parentElement!).getByTestId("AssignmentRoundedIcon")).toBeTruthy();
    });

    it("picks the words of the question out in bold", () => {
        renderTurn({
            askedQuery: "login redirect",
            answer: "[task:12]",
            answerSources: [TASK],
        });
        const chip = screen.getByRole("button", { name: /Fix login redirect/ }).parentElement!;
        // HighlightedText wraps each matched word in its own leaf <span>.
        const bold = Array.from(chip.querySelectorAll("span")).filter(
            (el) => el.children.length === 0 && el.textContent !== el.closest("div")?.textContent
        );
        expect(bold.map((el) => el.textContent)).toEqual(["login", "redirect"]);
    });

    it("shows only the sources the answer cited", () => {
        renderTurn({ answer: "[task:12]", answerSources: [TASK, NOTE] });
        expect(screen.queryByRole("button", { name: /Release notes/ })).toBeNull();
    });
});

describe("the approval card mount", () => {
    it("shows the card and the awaiting line, with Approve and Reject wired through", () => {
        const onApprove = vi.fn();
        const onReject = vi.fn();
        renderTurn({
            isCurrent: true,
            isStreaming: true,
            pendingApproval: PENDING,
            answer: "I can mark it done.",
            onApprove,
            onReject,
        });
        expect(screen.getByText("awaiting your approval")).toBeTruthy();
        expect(
            screen.getByText(
                `Approval required: ${getMessages("en").agentApproval.toolNames.update_task}`
            )
        ).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Approve" }));
        fireEvent.click(screen.getByRole("button", { name: "Reject" }));
        expect(onApprove).toHaveBeenCalledTimes(1);
        expect(onReject).toHaveBeenCalledTimes(1);
    });

    it("hands the host's own onApprove and onReject to the card, unwrapped", () => {
        // The card's signature is the contract: a later change gives it an
        // edited payload, and that only flows through if this mount adds no
        // wrapper of its own.
        const onApprove = vi.fn();
        const onReject = vi.fn();
        renderTurn({
            isCurrent: true,
            isStreaming: true,
            pendingApproval: PENDING,
            onApprove,
            onReject,
        });
        const props = cardProps.seen[cardProps.seen.length - 1];
        expect(props.onApprove).toBe(onApprove);
        expect(props.onReject).toBe(onReject);
        expect(props.pending).toBe(PENDING);
    });

    it("names the tool in the host's language", () => {
        renderTurn({
            isCurrent: true,
            isStreaming: true,
            pendingApproval: PENDING,
            labels: ja(),
            onApprove: vi.fn(),
            onReject: vi.fn(),
        });
        const jaMessages = getMessages("ja");
        const tool = jaMessages.agentApproval.toolNames.update_task;
        expect(
            screen.getByText(
                jaMessages.spotlight.approval.titleWithTool.replace("{toolName}", tool)
            )
        ).toBeTruthy();
        expect(screen.getByText(jaMessages.spotlight.states.awaitingApproval)).toBeTruthy();
    });

    it("does not offer approval on a finished turn", () => {
        renderTurn({
            isCurrent: false,
            pendingApproval: PENDING,
            onApprove: vi.fn(),
            onReject: vi.fn(),
        });
        expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    });

    it("shows no spinner and no Thinking while the user is the one being waited on", () => {
        renderTurn({
            isCurrent: true,
            isStreaming: true,
            pendingApproval: PENDING,
            answer: "",
            onApprove: vi.fn(),
            onReject: vi.fn(),
        });
        expect(screen.queryByText("streaming…")).toBeNull();
        expect(screen.queryByText("Thinking…")).toBeNull();
    });
});

describe("an error turn", () => {
    const failed = { answer: "", askError: "stub failure", runId: "run-1", elapsedMs: 900 };

    it("shows the error, and no answer, thumbs, copy or timing", () => {
        renderTurn({ ...failed, onFeedback: vi.fn(), onRetry: vi.fn() });
        expect(screen.getByText("stub failure")).toBeTruthy();
        expect(screen.queryByText("(no answer)")).toBeNull();
        expect(screen.queryByRole("button", { name: "Good answer" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Copy answer" })).toBeNull();
        expect(screen.queryByText(/Answered in/)).toBeNull();
    });

    it("offers Ask again", () => {
        const onRetry = vi.fn();
        renderTurn({ ...failed, onRetry });
        fireEvent.click(screen.getByRole("button", { name: "Ask again" }));
        expect(onRetry).toHaveBeenCalledWith("What shipped last week?", undefined);
    });

    it("offers Ask again on the in-flight turn once it has errored, not while it streams", () => {
        const onRetry = vi.fn();
        const live = renderTurn({
            isCurrent: true,
            isStreaming: true,
            answer: "partial",
            onRetry,
        });
        expect(screen.queryByRole("button", { name: "Ask again" })).toBeNull();
        live.unmount();
        renderTurn({ isCurrent: true, isStreaming: false, answer: "", askError: "boom", onRetry });
        expect(screen.getByRole("button", { name: "Ask again" })).toBeTruthy();
    });
});

describe("a cancelled turn", () => {
    // Promoted with whatever arrived: partial text, or only tool steps, with no
    // run id and no timing.
    it("keeps the partial answer, with copy and Ask again but no thumbs or timing", () => {
        renderTurn({
            answer: "Half an ans",
            runId: null,
            elapsedMs: null,
            onFeedback: vi.fn(),
            onRetry: vi.fn(),
        });
        expect(screen.getByText(/Half an ans/)).toBeTruthy();
        expect(screen.getByRole("button", { name: "Copy answer" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Ask again" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Good answer" })).toBeNull();
        expect(screen.queryByText(/Answered in/)).toBeNull();
    });

    it.each([
        ["en", en],
        ["ja", ja],
    ])("%s: says there is no answer when a finished turn has none", (_l, labels) => {
        renderTurn({
            answer: "",
            labels: labels(),
            toolEvents: [
                { step: 1, tool_name: "search_workspace", arguments: {}, status: "done" },
            ],
        });
        expect(screen.getByText(labels().states.noAnswer)).toBeTruthy();
    });

    it("does not say it for the in-flight turn", () => {
        renderTurn({ isCurrent: true, isStreaming: true, answer: "" });
        expect(screen.queryByText("(no answer)")).toBeNull();
    });
});

describe("streaming vs completed", () => {
    it("streaming: spinner caption, no thumbs, no timing, no Ask again", () => {
        renderTurn({
            isCurrent: true,
            isStreaming: true,
            answer: "Partial answer so far",
            runId: "run-live",
            elapsedMs: 5,
            onFeedback: vi.fn(),
            onRetry: vi.fn(),
        });
        expect(screen.getByText("streaming…")).toBeTruthy();
        expect(screen.getByText(/Partial answer so far/)).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Good answer" })).toBeNull();
        expect(screen.queryByText(/Answered in/)).toBeNull();
        expect(screen.queryByRole("button", { name: "Ask again" })).toBeNull();
    });

    it("streaming with nothing yet: says Thinking", () => {
        renderTurn({ isCurrent: true, isStreaming: true, answer: "" });
        expect(screen.getByText("Thinking…")).toBeTruthy();
    });

    it("completed: timing, thumbs, copy and Ask again; no spinner", () => {
        renderTurn({
            answer: "Done.",
            runId: "run-1",
            elapsedMs: 1800,
            onFeedback: vi.fn(),
            onRetry: vi.fn(),
        });
        expect(screen.getByText("Answered in 1.8s")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Good answer" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Copy answer" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Ask again" })).toBeTruthy();
        expect(screen.queryByText("streaming…")).toBeNull();
    });

    it("reads 'Answered in' from the label contract, in Japanese", () => {
        renderTurn({ answer: "Done.", elapsedMs: 1800, labels: ja() });
        const template = getMessages("ja").spotlight.conversation.answeredIn;
        expect(screen.getByText(template.replace("{duration}", "1.8s"))).toBeTruthy();
        expect(screen.queryByText(/Answered in/)).toBeNull();
    });

    it("shows the query, with the host's Q and A letters, and the tool steps", () => {
        renderTurn({
            askedQuery: "Why?",
            toolEvents: [
                { step: 1, tool_name: "search_workspace", arguments: {}, status: "done" },
            ],
        });
        expect(screen.getByText("Why?")).toBeTruthy();
        expect(screen.getByText("Q")).toBeTruthy();
        expect(screen.getByText("A")).toBeTruthy();
    });
});

describe("the action bar", () => {
    it("copies the answer, flips the tooltip to Copied, and flips back", async () => {
        vi.useFakeTimers();
        const writeText = vi.fn(async () => {});
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText },
        });
        renderTurn({ answer: "Copy me." });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Copy answer" }));
        });
        expect(writeText).toHaveBeenCalledWith("Copy me.");
        expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
        await act(async () => {
            vi.advanceTimersByTime(2100);
        });
        expect(screen.getByRole("button", { name: "Copy answer" })).toBeTruthy();
        vi.useRealTimers();
    });

    it("copies the model's text, not the rewritten citation markup", () => {
        const writeText = vi.fn(async () => {});
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText },
        });
        const answer = "See [the fix](task:12).";
        renderTurn({ answer, answerSources: [TASK] });
        fireEvent.click(screen.getByRole("button", { name: "Copy answer" }));
        expect(writeText).toHaveBeenCalledWith(answer);
    });

    it("disables Ask again while the host is busy, and enables it when it is not", () => {
        const onRetry = vi.fn();
        const busy = renderTurn({ askDisabled: true, onRetry });
        const button = screen.getByRole("button", { name: "Ask again" });
        expect((button as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(button);
        expect(onRetry).not.toHaveBeenCalled();
        busy.unmount();

        renderTurn({
            askDisabled: false,
            onRetry,
            mentions: [{ kind: "user", userId: "u2", label: "Bob" }],
        });
        fireEvent.click(screen.getByRole("button", { name: "Ask again" }));
        expect(onRetry).toHaveBeenCalledWith("What shipped last week?", [
            { kind: "user", userId: "u2", label: "Bob" },
        ]);
    });

    it("rates through the run id, once", () => {
        const onFeedback = vi.fn();
        renderTurn({ runId: "run-7", onFeedback });
        fireEvent.click(screen.getByRole("button", { name: "Good answer" }));
        fireEvent.click(screen.getByRole("button", { name: "Needs work" }));
        expect(onFeedback).toHaveBeenCalledTimes(1);
        expect(onFeedback).toHaveBeenCalledWith("run-7", 1);
    });

    it("labels the thumbs in the host's language", () => {
        renderTurn({ runId: "run-8", onFeedback: vi.fn(), labels: ja() });
        const t = getMessages("ja").spotlight.actions;
        expect(screen.getByRole("button", { name: t.feedbackUp })).toBeTruthy();
        expect(screen.getByRole("button", { name: t.feedbackDown })).toBeTruthy();
    });

    it("has no bar at all when there is nothing to do", () => {
        const { container } = renderTurn({ answer: "", askError: null });
        expect(container.querySelector(".turn-actions")).toBeNull();
    });

    describe("the extra-actions slot", () => {
        it("renders the host's actions in the bar, before the built-ins, with the turn's facts", () => {
            const seen: AgentTurnActionContext[] = [];
            const { container } = renderTurn({
                answer: "Done.",
                runId: "run-1",
                answerSources: [TASK],
                onFeedback: vi.fn(),
                onRetry: vi.fn(),
                renderExtraActions: (ctx) => {
                    seen.push(ctx);
                    return <button type="button">Save as note</button>;
                },
            });
            const bar = container.querySelector(".turn-actions") as HTMLElement;
            const names = within(bar)
                .getAllByRole("button")
                .map((b) => b.getAttribute("aria-label") ?? b.textContent);
            expect(names).toEqual([
                "Save as note",
                "Good answer",
                "Needs work",
                "Copy answer",
                "Ask again",
            ]);
            expect(seen[seen.length - 1]).toMatchObject({
                askedQuery: "What shipped last week?",
                answer: "Done.",
                runId: "run-1",
                isCurrent: false,
                isStreaming: false,
                hasError: false,
                askDisabled: false,
            });
            expect(seen[seen.length - 1].answerSources).toEqual([TASK]);
        });

        it("makes the bar appear even when no built-in action applies", () => {
            renderTurn({
                answer: "",
                isCurrent: true,
                isStreaming: true,
                renderExtraActions: () => <button type="button">Undo</button>,
            });
            expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
        });

        it("adds nothing when the slot returns nothing", () => {
            const { container } = renderTurn({ answer: "", renderExtraActions: () => null });
            expect(container.querySelector(".turn-actions")).toBeNull();
        });
    });
});

describe("one turn, with or without the providers", () => {
    it("renders the same DOM bare as inside the thread modal's providers", async () => {
        const { UrlLinkModalProvider } = await import("../hooks/common/UrlLinkModalContext");
        const { I18nProvider } = await import("../i18n");
        const props = baseProps({
            answer: "Shipped [the fix](task:12). [note:personal:42]",
            answerSources: [TASK, NOTE],
            runId: "run-1",
            elapsedMs: 1800,
            onFeedback: vi.fn(),
            onRetry: vi.fn(),
        });
        const bare = render(
            <CssVarsProvider>
                <AgentTurn {...props} />
            </CssVarsProvider>
        );
        // React's generated ids (`aria-labelledby` on a chip) differ per mount.
        const stable = (html: string) => html.replace(/«r\w+»/g, "«id»");
        const bareHtml = stable(bare.container.innerHTML);
        bare.unmount();
        const wrapped = render(
            <CssVarsProvider>
                <I18nProvider>
                    <UrlLinkModalProvider value={{ openModalByHref: vi.fn() }}>
                        <AgentTurn {...props} />
                    </UrlLinkModalProvider>
                </I18nProvider>
            </CssVarsProvider>
        );
        expect(stable(wrapped.container.innerHTML)).toBe(bareHtml);
    });
});

describe("render budget", () => {
    it("does not re-render, or re-parse, when the host re-renders with the same props", () => {
        const props = baseProps({
            answer: "Parse me once.",
            runId: "run-1",
            onFeedback: vi.fn(),
            onRetry: vi.fn(),
        });
        const view = render(
            <CssVarsProvider>
                <AgentTurn {...props} />
            </CssVarsProvider>
        );
        const before = parsed.texts.length;
        for (let i = 0; i < 5; i += 1) {
            view.rerender(
                <CssVarsProvider>
                    <AgentTurn {...props} />
                </CssVarsProvider>
            );
        }
        expect(parsed.texts.length - before).toBe(0);
    });

    it("does not re-parse the answer when only a non-answer prop changes", () => {
        const props = baseProps({ answer: "Parse me once.", onRetry: vi.fn() });
        const view = render(
            <CssVarsProvider>
                <AgentTurn {...props} askDisabled={false} />
            </CssVarsProvider>
        );
        const before = parsed.texts.length;
        // A host's stream start and end flip `askDisabled` on every finished turn.
        for (const askDisabled of [true, false, true, false]) {
            view.rerender(
                <CssVarsProvider>
                    <AgentTurn {...props} askDisabled={askDisabled} />
                </CssVarsProvider>
            );
        }
        expect(parsed.texts.length - before).toBe(0);
    });

    it("re-parses once per streamed delta", () => {
        const props = baseProps({ isCurrent: true, isStreaming: true });
        const view = render(
            <CssVarsProvider>
                <AgentTurn {...props} answer="live 0" />
            </CssVarsProvider>
        );
        const before = parsed.texts.length;
        for (let i = 1; i <= 10; i += 1) {
            view.rerender(
                <CssVarsProvider>
                    <AgentTurn {...props} answer={`live ${i}`} />
                </CssVarsProvider>
            );
        }
        expect(parsed.texts.length - before).toBe(10);
    });
});
