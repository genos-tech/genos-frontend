/**
 * How a Spotlight result row opens.
 *
 * A plain click quick-looks the hit in the preview modal (`onPreview`),
 * keeping Spotlight and the conversation behind it intact — browsing
 * several hits in a row is the common case, and the old behavior threw the
 * search away on the first one. Cmd/Ctrl-click is the escape hatch that
 * navigates to the entity's own page (`onSelect`). Keyboard Enter on a
 * highlighted row matches a plain click.
 *
 * `handleSpotlightPreview` in App.tsx owns the fallback for kinds with no
 * modal view (projects, stored answers), so these only pin the row → which
 * callback routing.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_ASK_STATE } from "../features/agentQA/types";
import { SpotlightOverlay } from "../features/spotlight/SpotlightOverlay";
import type { SpotlightResult } from "../features/spotlight/types";

vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

const result = (over: Partial<SpotlightResult> = {}): SpotlightResult => ({
    entity_type: "task",
    entity_id: "task:1",
    title: "Quarterly planning",
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
    task_id: "1",
    task_display_id: "APL-1",
    note_id: null,
    note_type: null,
    project_id: "7",
    related_entity_ids: [],
    ...over,
});

const TASK = result();
const NOTE = result({ entity_type: "note", entity_id: "note:5", title: "Retro notes" });

const onSelect = vi.fn();
const onPreview = vi.fn();

// `query` is a token that appears in no fixture title: HighlightedText
// splits a matched title across spans, which would break name matching.
const renderResults = (results: SpotlightResult[]) =>
    render(
        <CssVarsProvider>
            <SpotlightOverlay
                aiAnswersEnabled={true}
                ask={{ ...EMPTY_ASK_STATE }}
                backToHistoryList={vi.fn()}
                closeHistory={vi.fn()}
                error={null}
                filterServices={[]}
                historyDetail={null}
                historyIsLoading={false}
                historyMode="closed"
                historySessions={[]}
                isLoading={false}
                isOpen={true}
                openHistory={vi.fn()}
                query="zebra"
                results={results}
                turns={[]}
                viewHistorySession={vi.fn()}
                onApprove={vi.fn()}
                onAsk={vi.fn()}
                onCancel={vi.fn()}
                onClose={vi.fn()}
                onNewConversation={vi.fn()}
                onOpenSettings={vi.fn()}
                onPreview={onPreview}
                onQueryChange={vi.fn()}
                onReject={vi.fn()}
                onSelect={onSelect}
                onToggleFilterService={vi.fn()}
            />
        </CssVarsProvider>
    );

const row = (title: string) => screen.getByRole("button", { name: new RegExp(title) });

describe("Spotlight result activation", () => {
    beforeEach(() => {
        onSelect.mockClear();
        onPreview.mockClear();
    });

    it("opens the preview modal on a plain click", () => {
        renderResults([TASK]);
        fireEvent.click(row("Quarterly planning"));
        expect(onPreview).toHaveBeenCalledWith(TASK);
        expect(onSelect).not.toHaveBeenCalled();
    });

    it("navigates to the page on Cmd-click", () => {
        renderResults([TASK]);
        fireEvent.click(row("Quarterly planning"), { metaKey: true });
        expect(onSelect).toHaveBeenCalledWith(TASK);
        expect(onPreview).not.toHaveBeenCalled();
    });

    it("navigates on Ctrl-click too, so the habit transfers off macOS", () => {
        renderResults([TASK]);
        fireEvent.click(row("Quarterly planning"), { ctrlKey: true });
        expect(onSelect).toHaveBeenCalledWith(TASK);
        expect(onPreview).not.toHaveBeenCalled();
    });

    it("routes each row to its own result", () => {
        renderResults([TASK, NOTE]);
        fireEvent.click(row("Retro notes"));
        expect(onPreview).toHaveBeenCalledWith(NOTE);
    });

    it("previews the highlighted row on Enter, matching a plain click", () => {
        renderResults([TASK, NOTE]);
        const input = screen.getByRole("textbox");
        // ArrowDown highlights the first row; Enter then opens it instead
        // of firing an AI ask.
        fireEvent.keyDown(input, { key: "ArrowDown" });
        fireEvent.keyDown(input, { key: "Enter" });
        expect(onPreview).toHaveBeenCalledWith(TASK);
        expect(onSelect).not.toHaveBeenCalled();
    });
});
