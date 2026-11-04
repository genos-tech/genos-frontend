/**
 * What a turn knows about its undoable writes, and the words for it.
 *
 * `mergeUndoSteps` is the one place a live turn's tool events, a promoted turn's
 * carried list and a restored turn's server list become the controls a turn shows:
 * once per write, newest first, the run id from wherever it is known.
 */

import { describe, expect, it } from "vitest";

import { sessionTurnToCompleted } from "../features/agentQA/sessionTurns";
import type { ToolEvent } from "../features/agentQA/types";
import { undoOutcomeText, undoRefusalText, undoTooltipText } from "../features/agentQA/undoCopy";
import {
    isPastAvailable,
    mergeUndoSteps,
    NO_UNDO_STEPS,
    undoStepsFromSession,
    type UndoStepRef,
} from "../features/agentQA/undoSteps";
import { getMessages } from "../i18n";
import type { AgentSessionTurn, UndoAnswer, UndoRefusal } from "../services/agentApi";

const ev = (step: number, tool: string, undo?: ToolEvent["undo"], status = "done"): ToolEvent => ({
    step,
    tool_name: tool,
    arguments: {},
    status: status as ToolEvent["status"],
    undo,
});
const UNTIL = "2026-11-11T00:00:00Z";

describe("mergeUndoSteps", () => {
    it("a turn with no undoable write has the ONE shared empty list (its memo holds)", () => {
        expect(mergeUndoSteps([ev(1, "search_workspace")], undefined, "run-1")).toBe(
            NO_UNDO_STEPS
        );
        expect(mergeUndoSteps([], [], null)).toBe(NO_UNDO_STEPS);
    });

    it("takes a write from its tool event, with the run it was approved on", () => {
        const steps = mergeUndoSteps(
            [ev(2, "create_task", { step_id: 4711, available_until: UNTIL, run_id: "run-9" })],
            undefined,
            null
        );
        expect(steps).toEqual([
            {
                stepId: 4711,
                step: 2,
                toolName: "create_task",
                runId: "run-9",
                availableUntil: UNTIL,
                undoneAt: null,
            },
        ]);
    });

    it("falls back to the turn's own run id when the event names none", () => {
        const steps = mergeUndoSteps(
            [ev(2, "create_task", { step_id: 4711, available_until: UNTIL })],
            undefined,
            "run-turn"
        );
        expect(steps[0].runId).toBe("run-turn");
    });

    it("ignores a pending or failed tool event, and a read that has no undo", () => {
        const steps = mergeUndoSteps(
            [
                ev(1, "update_task", { step_id: 1, available_until: UNTIL }, "pending"),
                ev(2, "update_task", { step_id: 2, available_until: UNTIL }, "error"),
                ev(3, "search_workspace"),
            ],
            undefined,
            "r"
        );
        expect(steps).toBe(NO_UNDO_STEPS);
    });

    it("orders several writes NEWEST FIRST, whatever order they arrive in", () => {
        const steps = mergeUndoSteps(
            [
                ev(1, "create_task", { step_id: 4711, available_until: UNTIL }),
                ev(3, "add_comment", { step_id: 4713, available_until: UNTIL }),
                ev(2, "update_task", { step_id: 4712, available_until: UNTIL }),
            ],
            undefined,
            "r"
        );
        expect(steps.map((s) => s.toolName)).toEqual([
            "add_comment",
            "update_task",
            "create_task",
        ]);
        const carried: UndoStepRef[] = [1, 3, 2].map((step) => ({
            stepId: 5000 + step,
            step,
            toolName: `t${step}`,
            runId: "r",
            availableUntil: UNTIL,
            undoneAt: null,
        }));
        expect(mergeUndoSteps([], carried, "r").map((s) => s.step)).toEqual([3, 2, 1]);
    });

    it("a write in both the events and the carried list is ONE control", () => {
        const steps = mergeUndoSteps(
            [ev(2, "update_task", { step_id: 4711, available_until: UNTIL, run_id: "run-9" })],
            [
                {
                    stepId: 4711,
                    step: 2,
                    toolName: "update_task",
                    runId: "run-9",
                    availableUntil: UNTIL,
                    undoneAt: null,
                },
            ],
            "run-9"
        );
        expect(steps).toHaveLength(1);
    });

    it("an entry that says the write was undone wins over one that does not", () => {
        const steps = mergeUndoSteps(
            [ev(2, "update_task", { step_id: 4711, available_until: UNTIL })],
            [
                {
                    stepId: 4711,
                    step: 2,
                    toolName: "update_task",
                    runId: null,
                    availableUntil: UNTIL,
                    undoneAt: "2026-11-04T00:00:00Z",
                },
            ],
            "run-9"
        );
        expect(steps).toHaveLength(1);
        expect(steps[0].undoneAt).toBe("2026-11-04T00:00:00Z");
        expect(steps[0].runId).toBe("run-9");
    });
});

describe("a restored session turn", () => {
    const turn = (undo?: unknown): AgentSessionTurn =>
        ({
            run_id: "run-77",
            query: "q",
            answer: "a",
            status: "done",
            error: null,
            started_at: "2026-11-04T00:00:00Z",
            sources: [],
            undo,
        }) as unknown as AgentSessionTurn;

    it("keeps the server's list, with the turn's run id on every entry", () => {
        const steps = undoStepsFromSession(
            turn([
                {
                    step_id: 4711,
                    step: 1,
                    tool_name: "create_task",
                    available_until: UNTIL,
                    undone_at: null,
                },
                {
                    step_id: 4712,
                    step: 2,
                    tool_name: "update_task",
                    available_until: UNTIL,
                    undone_at: "2026-11-04T00:00:00Z",
                },
            ])
        );
        expect(steps.map((s) => [s.stepId, s.runId, s.undoneAt])).toEqual([
            [4711, "run-77", null],
            [4712, "run-77", "2026-11-04T00:00:00Z"],
        ]);
    });

    it("an older backend (no `undo`) or garbage in it gives no list, and the turn maps as before", () => {
        expect(undoStepsFromSession(turn(undefined))).toEqual([]);
        expect(undoStepsFromSession(turn("nope"))).toEqual([]);
        expect(undoStepsFromSession(turn([null, { step_id: "x" }, {}]))).toEqual([]);
        const mapped = sessionTurnToCompleted(turn(undefined), 0);
        expect("undo" in mapped).toBe(false);
        expect(mapped.toolEvents).toEqual([]);
    });

    it("sessionTurnToCompleted carries the list (a restored turn has no tool events)", () => {
        const mapped = sessionTurnToCompleted(
            turn([
                {
                    step_id: 4711,
                    step: 1,
                    tool_name: "create_task",
                    available_until: UNTIL,
                    undone_at: null,
                },
            ]),
            0
        );
        expect(mapped.undo).toEqual([
            {
                stepId: 4711,
                step: 1,
                toolName: "create_task",
                runId: "run-77",
                availableUntil: UNTIL,
                undoneAt: null,
            },
        ]);
        expect(mapped.toolEvents).toEqual([]);
    });
});

describe("isPastAvailable", () => {
    it("is about THIS clock and only decides whether to offer the button", () => {
        const until = "2026-11-11T00:00:00Z";
        expect(isPastAvailable(until, Date.parse(until) - 1)).toBe(false);
        expect(isPastAvailable(until, Date.parse(until))).toBe(true);
        expect(isPastAvailable(until, Date.parse(until) + 86_400_000)).toBe(true);
    });
    it("a date that does not parse is not past: the server decides", () => {
        expect(isPastAvailable("not a date", Date.now())).toBe(false);
    });
});

describe("the words (English catalog)", () => {
    const t = getMessages();
    const answer = (over: Partial<UndoAnswer>): UndoAnswer => ({
        run_id: "r",
        step_id: 1,
        tool_name: "update_task",
        undone_at: "x",
        action: "restored",
        restored: [],
        skipped: [],
        entity: null,
        summary: "SERVER ENGLISH",
        ...over,
    });
    const refusal = (over: Partial<UndoRefusal>): UndoRefusal => ({
        code: "unknown",
        status: 409,
        message: null,
        skipped: [],
        detail: null,
        retryable: false,
        ...over,
    });

    it("says what was put back with the person's field names, and what was left", () => {
        expect(undoOutcomeText(t, answer({ restored: ["status", "due_date"] }))).toBe(
            "Undone. Put back: Status, Due."
        );
        expect(
            undoOutcomeText(
                t,
                answer({
                    restored: ["title", "body"],
                    skipped: [{ field: "priority", reason: "changed_since" }],
                })
            )
        ).toBe(
            "Undone. Put back: Title, Content. Left as they are, because they changed since: Priority."
        );
    });

    it("names what a delete removed", () => {
        const task = { kind: "task", task_id: 1, project_id: 2, display_id: "PRJ-12" } as const;
        expect(undoOutcomeText(t, answer({ action: "deleted", entity: task }))).toBe(
            "Undone. Task PRJ-12 was deleted."
        );
        expect(
            undoOutcomeText(
                t,
                answer({
                    action: "deleted",
                    entity: { kind: "note", note_type: "personal", note_id: 1, title: "Plan" },
                })
            )
        ).toBe("Undone. The note “Plan” was deleted.");
        expect(
            undoOutcomeText(
                t,
                answer({
                    action: "deleted",
                    entity: { ...task, kind: "comment", comment_id: 3 },
                })
            )
        ).toBe("Undone. The comment was deleted.");
    });

    it("never shows the server's English summary when it can say it itself", () => {
        for (const a of [
            answer({ restored: ["status"] }),
            answer({ action: "deleted" }),
            answer({}),
        ]) {
            expect(undoOutcomeText(t, a)).not.toContain("SERVER ENGLISH");
        }
    });

    it.each([
        "not_found",
        "not_undoable",
        "already_undone",
        "changed_since",
        "expired",
        "permission_lost",
        "throttled",
        "unauthorized",
        "network",
        "server",
    ] as const)("has its own sentence for %s, not the server's", (code) => {
        const text = undoRefusalText(t, refusal({ code, message: "SERVER ENGLISH" }));
        expect(text).not.toContain("SERVER ENGLISH");
        expect(text.length).toBeGreaterThan(10);
    });

    it("changed_since names the fields that had changed, when the server says which", () => {
        expect(
            undoRefusalText(
                t,
                refusal({
                    code: "changed_since",
                    skipped: [
                        { field: "status", reason: "changed_since" },
                        { field: "body", reason: "changed_since" },
                        { field: "status", reason: "changed_since" },
                    ],
                })
            )
        ).toContain("Status, Content");
        expect(undoRefusalText(t, refusal({ code: "changed_since" }))).toBe(
            t.agentApproval.undo.refused.changed_since
        );
    });

    it("an unknown code falls back to the server's words, then to a generic sentence", () => {
        expect(undoRefusalText(t, refusal({ code: "unknown", message: "Server says no." }))).toBe(
            "Server says no."
        );
        expect(undoRefusalText(t, refusal({ code: "unknown" }))).toBe(
            t.agentApproval.undo.refused.unknown
        );
    });

    it("the tooltip says what the click does for the tool, then that sent things stay sent", () => {
        expect(undoTooltipText(t, "create_task")).toBe(
            "Deletes the task Genos created. Anything already sent, such as notifications, isn't recalled."
        );
        expect(undoTooltipText(t, "update_task")).toContain("Puts back the earlier values.");
        expect(undoTooltipText(t, "some_future_tool")).toContain("Reverses this change.");
    });
});
