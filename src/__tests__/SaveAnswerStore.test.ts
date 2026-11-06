/**
 * The store behind "Save as note / task" (`saveAnswerStore.ts`).
 *
 * The component test cannot reach the guard in `beginSave`: after the first click React
 * swaps the button for a disabled one, so a second DOM click never arrives. The guard is
 * for a second CALL in the same tick (the bar's button and the status line's "Try again",
 * or two surfaces), which only the store sees.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
    beginSave,
    cancelSave,
    failSave,
    finishSave,
    getSaveState,
    resetSaveStore,
    subscribeSave,
    turnKeyOf,
} from "../features/agentQA/saveAnswer/saveAnswerStore";
import { savedNoteSource } from "../features/agentQA/saveAnswer/syntheticSource";

afterEach(resetSaveStore);

describe("beginSave: one save at a time, one save ever once it worked", () => {
    it("claims the save once and refuses a second claim in the same tick", () => {
        expect(beginSave("run:1", "note")).toBe(true);
        expect(beginSave("run:1", "note")).toBe(false);
        expect(beginSave("run:1", "note")).toBe(false);
        expect(getSaveState("run:1", "note").status).toBe("saving");
    });

    it("refuses once the save worked", () => {
        beginSave("run:1", "note");
        finishSave("run:1", "note", savedNoteSource(5, "t"));
        expect(getSaveState("run:1", "note").status).toBe("saved");
        expect(beginSave("run:1", "note")).toBe(false);
    });

    it("allows a retry after a failure, and after the person backed out", () => {
        beginSave("run:1", "note");
        failSave("run:1", "note", "failed");
        expect(getSaveState("run:1", "note")).toEqual({ status: "error", failure: "failed" });
        expect(beginSave("run:1", "note")).toBe(true);
        failSave("run:1", "note", "tooLong");
        cancelSave("run:1", "note");
        expect(getSaveState("run:1", "note").status).toBe("idle");
        expect(beginSave("run:1", "note")).toBe(true);
    });

    it("keeps notes and tasks, and different answers, apart", () => {
        beginSave("run:1", "note");
        expect(getSaveState("run:1", "task").status).toBe("idle");
        expect(getSaveState("run:2", "note").status).toBe("idle");
        expect(beginSave("run:1", "task")).toBe(true);
        expect(beginSave("run:2", "note")).toBe(true);
    });
});

describe("what useSyncExternalStore needs", () => {
    it("hands back the very same snapshot until something changes", () => {
        const a = getSaveState("run:1", "note");
        expect(getSaveState("run:1", "note")).toBe(a);
        beginSave("run:1", "note");
        const b = getSaveState("run:1", "note");
        expect(b).not.toBe(a);
        expect(getSaveState("run:1", "note")).toBe(b);
    });

    it("tells a subscriber of that answer, only, and stops after unsubscribe", () => {
        const mine = vi.fn();
        const other = vi.fn();
        const off = subscribeSave("run:1", mine);
        subscribeSave("run:2", other);
        beginSave("run:1", "note");
        finishSave("run:1", "task");
        expect(mine).toHaveBeenCalledTimes(2);
        expect(other).not.toHaveBeenCalled();
        off();
        failSave("run:1", "note", "failed");
        expect(mine).toHaveBeenCalledTimes(2);
    });
});

describe("turnKeyOf", () => {
    it("is the run when there is one, else the text", () => {
        expect(turnKeyOf("abc", "q", "a")).toBe("run:abc");
        expect(turnKeyOf(null, "q", "a")).toBe(turnKeyOf(undefined, "q", "a"));
        expect(turnKeyOf(null, "q", "a")).not.toBe(turnKeyOf(null, "q", "b"));
    });
});
