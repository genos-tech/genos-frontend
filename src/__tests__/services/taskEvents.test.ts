import { afterEach, describe, expect, it, vi } from "vitest";

import {
    emitTaskTouched,
    onTaskTouched,
    TaskTouchedDetail,
} from "../../features/tasks/services/taskEvents";

describe("taskEvents", () => {
    const unsubscribers: (() => void)[] = [];

    afterEach(() => {
        while (unsubscribers.length) unsubscribers.pop()!();
    });

    const subscribe = (cb: (d: TaskTouchedDetail) => void) => {
        const off = onTaskTouched(cb);
        unsubscribers.push(off);
        return off;
    };

    it("delivers taskId and kind to subscribers", () => {
        const seen: TaskTouchedDetail[] = [];
        subscribe((d) => seen.push(d));

        emitTaskTouched(42, "comment");
        emitTaskTouched(7, "update");

        expect(seen).toEqual([
            { taskId: 42, kind: "comment" },
            { taskId: 7, kind: "update" },
        ]);
    });

    it("fans out one emit to every subscriber", () => {
        const a = vi.fn();
        const b = vi.fn();
        subscribe(a);
        subscribe(b);

        emitTaskTouched(1, "children");

        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(1);
    });

    it("stops delivering after the returned unsubscribe runs", () => {
        const cb = vi.fn();
        const off = onTaskTouched(cb);

        emitTaskTouched(5, "comment");
        off();
        emitTaskTouched(5, "comment");

        expect(cb).toHaveBeenCalledTimes(1);
    });

    it("drops invalid task ids instead of emitting", () => {
        const cb = vi.fn();
        subscribe(cb);

        // Number(null|undefined) at producer call sites yields 0/NaN —
        // these must never reach subscribers as bogus refresh signals.
        emitTaskTouched(0, "comment");
        emitTaskTouched(-1, "update");
        emitTaskTouched(Number.NaN, "children");

        expect(cb).not.toHaveBeenCalled();
    });
});
