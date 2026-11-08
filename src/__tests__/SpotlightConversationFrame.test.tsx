/**
 * Spotlight's conversation panel (MIP-1176): what is around the turns.
 *
 *  - the read-only archive (History detail) frames its turns in the same
 *    `Bubble` as the live ones, and keeps its one action (the thumbs) in the
 *    frame's bottom row;
 *  - the first turn sits right under the sticky header, so its top divider is
 *    dropped (the header already separates it);
 *  - in the compact look the panel adds no horizontal padding of its own (the
 *    rows carry theirs), and the header takes the rows' inset instead.
 *
 * jsdom evaluates the stylesheet Emotion writes, so computed `border-top-color`
 * and `padding` of the panel are real values here; real layout is not, and was
 * checked in a browser (see the MIP-1176 evidence).
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_ASK_STATE, type CompletedTurn } from "../features/agentQA/types";
import { SpotlightOverlay } from "../features/spotlight/SpotlightOverlay";
import type { AgentSessionDetail } from "../services/agentApi";

vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

const TURNS: CompletedTurn[] = [
    {
        id: 1,
        askedQuery: "What is blocked?",
        answer: "Two tasks.",
        answerSources: [],
        toolEvents: [],
        askError: null,
        runId: "run-1",
        elapsedMs: 1200,
    },
    {
        id: 2,
        askedQuery: "And who owns them?",
        answer: "Ken.",
        answerSources: [],
        toolEvents: [],
        askError: null,
        runId: "run-2",
        elapsedMs: 900,
    },
];

const DETAIL: AgentSessionDetail = {
    session_id: "s-1",
    created_at: "2026-11-08T10:00:00Z",
    last_active_at: "2026-11-08T10:30:00Z",
    turns: [
        {
            run_id: "r1",
            query: "What is blocked?",
            answer: "Two tasks are blocked.",
            status: "done",
            error: null,
            started_at: "2026-11-08T10:00:00Z",
            sources: [],
        },
        {
            run_id: "r2",
            query: "And who owns them?",
            answer: "",
            status: "error",
            error: "The agent stopped.",
            started_at: "2026-11-08T10:05:00Z",
            sources: [],
        },
    ],
};

const renderOverlay = (
    over: Partial<{
        turns: CompletedTurn[];
        historyMode: "closed" | "list" | "detail";
        historyDetail: AgentSessionDetail | null;
    }> = {}
) =>
    render(
        <CssVarsProvider>
            <SpotlightOverlay
                aiAnswersEnabled={true}
                ask={{ ...EMPTY_ASK_STATE }}
                backToHistoryList={vi.fn()}
                closeHistory={vi.fn()}
                error={null}
                filterServices={[]}
                historyDetail={over.historyDetail ?? null}
                historyIsLoading={false}
                historyMode={over.historyMode ?? "closed"}
                historySessions={[]}
                isLoading={false}
                isOpen={true}
                openHistory={vi.fn()}
                query=""
                results={[]}
                turns={over.turns ?? []}
                viewHistorySession={vi.fn()}
                onApprove={vi.fn()}
                onAsk={vi.fn()}
                onCancel={vi.fn()}
                onClose={vi.fn()}
                onFeedback={vi.fn()}
                onNewConversation={vi.fn()}
                onOpenSettings={vi.fn()}
                onPreview={vi.fn()}
                onQueryChange={vi.fn()}
                onReject={vi.fn()}
                onSelect={vi.fn()}
                onToggleFilterService={vi.fn()}
                onUndo={vi.fn()}
            />
        </CssVarsProvider>
    );

const header = () => document.querySelector("[data-conversation-header]") as HTMLElement;
const rows = () => [...document.querySelectorAll<HTMLElement>("[data-bubble-layout]")];

beforeEach(() => {
    localStorage.clear();
});

describe("the live conversation", () => {
    it("drops the first turn's top divider and keeps the others'", () => {
        renderOverlay({ turns: TURNS });
        const [first, second] = rows();
        expect(first, "two answer rows").toBeTruthy();
        // The first row is the header's next sibling: that is what the rule selects.
        expect(header().nextElementSibling).toBe(first);
        // jsdom reports `transparent` as rgba(0, 0, 0, 0).
        const CLEAR = "rgba(0, 0, 0, 0)";
        expect(getComputedStyle(first).borderTopColor).toBe(CLEAR);
        expect(getComputedStyle(second).borderTopColor).not.toBe(CLEAR);
    });

    it("pads nothing around the compact rows; the header takes the rows' inset", () => {
        renderOverlay({ turns: TURNS });
        const panel = header().parentElement as HTMLElement;
        expect(getComputedStyle(panel).paddingLeft).toBe("0px");
        expect(getComputedStyle(panel).paddingRight).toBe("0px");
        expect(getComputedStyle(header()).paddingLeft).not.toBe("0px");
    });
});

describe("the read-only archive", () => {
    it("frames every archived turn in the Bubble, like a live one", () => {
        renderOverlay({ historyMode: "detail", historyDetail: DETAIL });
        expect(rows()).toHaveLength(2);
        for (const row of rows()) expect(row.dataset.bubbleLayout).toBe("compact");
        expect(within(rows()[0]).getByText("What is blocked?")).toBeTruthy();
        expect(within(rows()[1]).getByText("And who owns them?")).toBeTruthy();
        expect(within(rows()[0]).getByText("Two tasks are blocked.")).toBeTruthy();
        expect(within(rows()[1]).getByText("The agent stopped.")).toBeTruthy();
    });

    it("keeps the thumbs in the frame's action row, and only on an answered turn", () => {
        renderOverlay({ historyMode: "detail", historyDetail: DETAIL });
        const [answered, failed] = rows();
        expect(answered.querySelector(".turn-actions")).not.toBeNull();
        expect(failed.querySelector(".turn-actions")).toBeNull();
    });

    it("shows the read-only hint above the turns and keeps no turn above it", () => {
        renderOverlay({ historyMode: "detail", historyDetail: DETAIL });
        const hint = screen.getByText(/read-only/i);
        const first = rows()[0];
        expect(
            hint.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });
});
