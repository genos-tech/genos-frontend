/**
 * Naming the space a note result came from.
 *
 * My, Shared and Team notes are one backend type on one endpoint, and
 * the search index stores them identically — every note hit arrives
 * claiming `note_type: "personal"`. The only thing that tells them apart
 * is which meta list loaded the note, which lives on the note manager,
 * several components away from the row that has to print the word.
 *
 * That distance is the whole risk here: nothing type-checks the day
 * someone renders a result list without threading the map, and the
 * symptom is a Team note quietly captioned "My note". So these render
 * through the real overlay rather than calling `entitySubtitle`, to
 * cover the prop path and not just the switch at the end of it.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EMPTY_ASK_STATE } from "../features/agentQA/types";
import { personalNoteScopes } from "../features/notes/common/utils/noteTypeAlias";
import { SpotlightOverlay } from "../features/spotlight/SpotlightOverlay";
import type { SpotlightResult } from "../features/spotlight/types";

vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

const noteResult = (noteId: string, over: Partial<SpotlightResult> = {}): SpotlightResult => ({
    entity_type: "note",
    entity_id: `note:personal:${noteId}`,
    title: `Note ${noteId}`,
    snippet: null,
    score: 1,
    keyword_rank: 1,
    vector_rank: null,
    matched_chunk_types: ["note_body"],
    matched_terms: [],
    updated_at: null,
    chat_type: null,
    chat_id: null,
    thread_id: null,
    message_id: null,
    task_id: null,
    task_display_id: null,
    note_id: noteId,
    // What the index returns for a team note just as much as a My Note —
    // the bug this file exists for.
    note_type: "personal",
    project_id: null,
    related_entity_ids: [],
    ...over,
});

const renderResults = (
    results: SpotlightResult[],
    noteScopes?: ReadonlyMap<number, "shared" | "team">
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
                historyDetail={null}
                historyIsLoading={false}
                historyMode="closed"
                historySessions={[]}
                isLoading={false}
                isOpen={true}
                noteScopes={noteScopes}
                openHistory={vi.fn()}
                // A token in no fixture: a matched title is split across
                // spans by the highlighter, which breaks plain getByText.
                query="zebra"
                results={results}
                turns={[]}
                viewHistorySession={vi.fn()}
                onApprove={vi.fn()}
                onAsk={vi.fn()}
                onCancel={vi.fn()}
                onChangeFilterProjects={vi.fn()}
                onClose={vi.fn()}
                onNewConversation={vi.fn()}
                onOpenSettings={vi.fn()}
                onPreview={vi.fn()}
                onQueryChange={vi.fn()}
                onReject={vi.fn()}
                onSelect={vi.fn()}
                onToggleFilterService={vi.fn()}
            />
        </CssVarsProvider>
    );

describe("Spotlight note-result subtitle", () => {
    it("calls a note in a team folder a Team note", () => {
        renderResults([noteResult("42")], personalNoteScopes([{ noteId: 42 }], []));

        expect(screen.getByText("Team note")).toBeTruthy();
        expect(screen.queryByText("My note")).toBeNull();
    });

    it("calls a note in a shared folder a Shared note", () => {
        renderResults([noteResult("42")], personalNoteScopes([], [{ noteId: 42 }]));

        expect(screen.getByText("Shared note")).toBeTruthy();
        expect(screen.queryByText("My note")).toBeNull();
    });

    it("still calls an actual My Note a My note", () => {
        // The map holds only the exceptions, so an id missing from it has
        // to mean My Notes rather than "unknown".
        renderResults([noteResult("42")], personalNoteScopes([{ noteId: 99 }], []));

        expect(screen.getByText("My note")).toBeTruthy();
    });

    it("labels each row from its own id, not the first one", () => {
        renderResults(
            [noteResult("1"), noteResult("2"), noteResult("3")],
            personalNoteScopes([{ noteId: 2 }], [{ noteId: 3 }])
        );

        expect(screen.getByText("My note")).toBeTruthy();
        expect(screen.getByText("Team note")).toBeTruthy();
        expect(screen.getByText("Shared note")).toBeTruthy();
    });

    it("leaves task and chat notes alone", () => {
        // Those two ARE distinct backend types; the scope map has no say.
        renderResults(
            [
                noteResult("7", { note_type: "task", entity_id: "note:task:7" }),
                noteResult("8", { note_type: "chat", entity_id: "note:chat:8" }),
            ],
            personalNoteScopes([{ noteId: 7 }], [{ noteId: 8 }])
        );

        expect(screen.getByText("Task note")).toBeTruthy();
        expect(screen.getByText("Chat note")).toBeTruthy();
    });

    it("falls back to the old wording when no map is threaded", () => {
        // Note state isn't loaded on every surface Spotlight opens from;
        // a missing map has to degrade, not blank the subtitle.
        renderResults([noteResult("42")]);

        expect(screen.getByText("My note")).toBeTruthy();
    });
});

describe("personalNoteScopes", () => {
    it("reports only the notes that aren't in My Notes", () => {
        const scopes = personalNoteScopes([{ noteId: 1 }], [{ noteId: 2 }]);

        expect(scopes.get(1)).toBe("team");
        expect(scopes.get(2)).toBe("shared");
        expect(scopes.get(3)).toBeUndefined();
        expect(scopes.size).toBe(2);
    });

    it("prefers team for a note reachable both ways", () => {
        // The order every other caller resolves this in — the sidebar's
        // favorites bucketing and the tab-bucket heal both check team
        // first — so a note that is in both lists must not read as
        // "Shared note" here alone.
        expect(personalNoteScopes([{ noteId: 1 }], [{ noteId: 1 }]).get(1)).toBe("team");
    });

    it("is empty when the user has no shared or team notes", () => {
        expect(personalNoteScopes([], []).size).toBe(0);
    });
});
