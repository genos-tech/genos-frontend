/**
 * Spotlight result-row metadata chips.
 *
 * Task-related rows carry a task-status chip and their project's label
 * chips. The interesting part is WHICH rows get WHICH chip, and what
 * happens when the data isn't there:
 *
 *   - task / milestone → status + labels
 *   - task-note        → labels only (a note has no status of its own)
 *   - everything else  → neither
 *   - `task_status` absent (older backend, un-reingested milestone) or
 *     the project unknown to `teamProjects` → render nothing, don't throw
 *
 * Rendered through `SpotlightOverlay` rather than the row component so
 * the string `project_id` → numeric `projectId` resolution is covered
 * too — comparing those two directly silently never matches.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EMPTY_ASK_STATE } from "../features/agentQA/types";
import { SpotlightOverlay } from "../features/spotlight/SpotlightOverlay";
import type { SpotlightResult } from "../features/spotlight/types";
import type { ProjectProps } from "../types/tasks";

vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

const APOLLO: ProjectProps = {
    projectId: 7,
    projectName: "Apollo",
    projectTags: [],
    isJoined: true,
    projectLabels: [
        { labelId: 1, name: "Client Work", color: "#2563eb", textColor: "#ffffff" },
        { labelId: 2, name: "Q3", color: "#16a34a", textColor: "#ffffff" },
    ],
};

const UNLABELLED: ProjectProps = {
    projectId: 9,
    projectName: "Bare",
    projectTags: [],
    isJoined: true,
    projectLabels: [],
};

const result = (over: Partial<SpotlightResult> = {}): SpotlightResult => ({
    entity_type: "task",
    entity_id: "task:1",
    title: "Ship the search filter",
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
    // String on the wire — the numeric `projectId` above must still match.
    project_id: "7",
    related_entity_ids: [],
    ...over,
});

const renderResults = (results: SpotlightResult[], projects: ProjectProps[] = [APOLLO]) =>
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
                projects={projects}
                // Non-empty so the results list renders rather than the
                // "start typing" hint, but deliberately a token that
                // appears in NO fixture: `HighlightedText` splits a
                // matched title across <span>s, which would break the
                // plain `getByText` title assertions below.
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

describe("Spotlight result chips", () => {
    it("shows status + project labels on a task row", () => {
        renderResults([result({ task_status: "WIP" })]);

        expect(screen.getByText("WIP")).toBeTruthy();
        expect(screen.getByText("Client Work")).toBeTruthy();
        expect(screen.getByText("Q3")).toBeTruthy();
    });

    it("shows status + project labels on a milestone row", () => {
        renderResults([
            result({
                entity_type: "milestone",
                entity_id: "milestone:3",
                title: "Q3 launch",
                task_status: "Closed",
            }),
        ]);

        expect(screen.getByText("Closed")).toBeTruthy();
        expect(screen.getByText("Client Work")).toBeTruthy();
    });

    it("shows labels but NO status on a task-note row", () => {
        renderResults([
            result({
                entity_type: "note",
                entity_id: "note:task:5",
                note_type: "task",
                title: "Spec notes",
                // Even if the backend ever sent one, a note has no status
                // of its own — the task it hangs off does.
                task_status: "Open",
            }),
        ]);

        expect(screen.getByText("Client Work")).toBeTruthy();
        expect(screen.queryByText("Open")).toBeNull();
    });

    it("shows neither on a non-task row that still has a project", () => {
        // A PM chat carries a project_id, but the chips are there to make
        // TASK results scannable — not to decorate every row.
        renderResults([
            result({
                entity_type: "chat",
                entity_id: "pm:7",
                chat_type: "pm",
                title: "Apollo channel",
                task_id: null,
                task_status: "Open",
            }),
        ]);

        expect(screen.queryByText("Open")).toBeNull();
        expect(screen.queryByText("Client Work")).toBeNull();
    });

    it("renders no status chip when task_status is absent", () => {
        // Older backend, or a milestone whose chunks predate the field.
        renderResults([result({ entity_type: "milestone", entity_id: "milestone:4" })]);

        expect(screen.getByText("Ship the search filter")).toBeTruthy();
        for (const s of ["Open", "WIP", "Blocked", "Pending", "Closed"]) {
            expect(screen.queryByText(s)).toBeNull();
        }
    });

    it("renders no label chips for a project absent from teamProjects", () => {
        // Result from a project the viewer's list hasn't loaded — the row
        // still renders, just without labels.
        renderResults([result({ task_status: "Open", project_id: "999" })]);

        expect(screen.getByText("Open")).toBeTruthy();
        expect(screen.queryByText("Client Work")).toBeNull();
    });

    it("renders no label chips for a project that has none", () => {
        renderResults([result({ task_status: "Open", project_id: "9" })], [APOLLO, UNLABELLED]);

        expect(screen.getByText("Open")).toBeTruthy();
        expect(screen.queryByText("Client Work")).toBeNull();
    });

    it("collapses a third label into +N", () => {
        const threeLabels: ProjectProps = {
            ...APOLLO,
            projectLabels: [
                ...(APOLLO.projectLabels ?? []),
                { labelId: 3, name: "Urgent", color: "#dc2626", textColor: "#ffffff" },
            ],
        };
        renderResults([result({ task_status: "Open" })], [threeLabels]);

        expect(screen.getByText("Client Work")).toBeTruthy();
        expect(screen.getByText("Q3")).toBeTruthy();
        expect(screen.queryByText("Urgent")).toBeNull();
        expect(screen.getByText("+1")).toBeTruthy();
    });
});
