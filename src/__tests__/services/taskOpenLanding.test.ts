/**
 * The landing of a task open's side loaders (MIP-968): the writes of the
 * loaders that took part in an open run together, once all of them have
 * answered, or after 800 ms, and everything else writes at once.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    createOpenLanding,
    OPEN_LANDING_WAIT_MS,
    passThroughTicket,
} from "../../features/tasks/services/taskOpenLanding";

const open = (id = 1) => {
    const landing = createOpenLanding();
    landing.arm(id);
    return landing;
};

beforeEach(() => {
    vi.useFakeTimers();
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("OpenLanding", () => {
    it("waits at most 800 ms", () => {
        expect(OPEN_LANDING_WAIT_MS).toBe(800);
    });

    it("runs the writes together once the open is sealed and every loader has answered", () => {
        const landing = open();
        const log: string[] = [];
        const a = landing.join(1, "a");
        const b = landing.join(1, "b");
        landing.seal(1);

        a.land(() => log.push("a"));
        expect(log).toEqual([]);
        b.land(() => log.push("b"));
        expect(log).toEqual(["a", "b"]);
    });

    it("does not run anything before the seal, even when every loader has answered", () => {
        const landing = open();
        const log: string[] = [];
        // A warm switch: the cached answers are in before the other blocks joined.
        landing.join(1, "a").land(() => log.push("a"));
        expect(log).toEqual([]);
        const late = landing.join(1, "b");
        landing.seal(1);
        expect(log).toEqual([]);
        late.land(() => log.push("b"));
        expect(log).toEqual(["a", "b"]);
    });

    it("runs what has landed after 800 ms; a loader that is still out writes on its own later", () => {
        const landing = open();
        const log: string[] = [];
        const a = landing.join(1, "a");
        const slow = landing.join(1, "slow");
        landing.seal(1);
        a.land(() => log.push("a"));

        vi.advanceTimersByTime(OPEN_LANDING_WAIT_MS - 1);
        expect(log).toEqual([]);
        vi.advanceTimersByTime(1);
        expect(log).toEqual(["a"]);

        slow.land(() => log.push("slow"));
        expect(log).toEqual(["a", "slow"]);
    });

    it("runs at the timeout even when the open was never sealed", () => {
        const landing = open();
        const log: string[] = [];
        landing.join(1, "a").land(() => log.push("a"));
        vi.advanceTimersByTime(OPEN_LANDING_WAIT_MS);
        expect(log).toEqual(["a"]);
    });

    it("a loader that cancels does not keep the others waiting", () => {
        const landing = open();
        const log: string[] = [];
        const a = landing.join(1, "a");
        const gone = landing.join(1, "gone");
        landing.seal(1);
        a.land(() => log.push("a"));
        expect(log).toEqual([]);
        gone.cancel();
        expect(log).toEqual(["a"]);
    });

    it("an answer after a cancel is ignored", () => {
        const landing = open();
        const log: string[] = [];
        const a = landing.join(1, "a");
        a.cancel();
        a.land(() => log.push("a"));
        landing.seal(1);
        expect(log).toEqual([]);
    });

    it("sealing an open nobody joined ends it: later loaders write at once", () => {
        const landing = open();
        landing.seal(1);
        const log: string[] = [];
        landing.join(1, "a").land(() => log.push("a"));
        expect(log).toEqual(["a"]);
    });

    it("loaders that join after the seal, or for another task, write at once", () => {
        const landing = open(1);
        const held = landing.join(1, "held");
        landing.seal(1);
        const log: string[] = [];
        landing.join(1, "refresh").land(() => log.push("refresh"));
        landing.join(2, "other").land(() => log.push("other"));
        expect(log).toEqual(["refresh", "other"]);
        // ... and they did not become part of the wait.
        held.land(() => log.push("held"));
        expect(log).toEqual(["refresh", "other", "held"]);
    });

    it("a loader of another task joins nothing, even before the seal", () => {
        const landing = open(1);
        const log: string[] = [];
        const held = landing.join(1, "held");
        // The outgoing task's own refresh, while the new open is waiting.
        landing.join(2, "other").land(() => log.push("other"));
        expect(log).toEqual(["other"]);
        landing.seal(1);
        held.land(() => log.push("held"));
        expect(log).toEqual(["other", "held"]);
    });

    it("a new open throws away what the previous one had queued", () => {
        const landing = open(1);
        const log: string[] = [];
        landing.join(1, "a").land(() => log.push("old a"));
        const pending = landing.join(1, "b");
        landing.arm(2);

        // The old open's slow answer is not part of the new open: it writes at once.
        pending.land(() => log.push("old b"));
        landing.join(2, "a").land(() => log.push("new a"));
        landing.seal(2);
        expect(log).toEqual(["old b", "new a"]);
        vi.advanceTimersByTime(OPEN_LANDING_WAIT_MS * 2);
        expect(log).not.toContain("old a");
    });

    it("the old open's timer does not flush the new open early", () => {
        const landing = open(1);
        vi.advanceTimersByTime(OPEN_LANDING_WAIT_MS - 100);
        landing.arm(2);
        const log: string[] = [];
        landing.join(2, "a").land(() => log.push("a"));
        vi.advanceTimersByTime(200);
        expect(log).toEqual([]);
        vi.advanceTimersByTime(OPEN_LANDING_WAIT_MS);
        expect(log).toEqual(["a"]);
    });

    it("the same loader joining twice in one open replaces its first ticket", () => {
        const landing = open();
        const log: string[] = [];
        const first = landing.join(1, "a"); // never answers (its effect re-ran)
        const second = landing.join(1, "a");
        landing.seal(1);
        second.land(() => log.push("second"));
        expect(log).toEqual(["second"]);
        first.land(() => log.push("first"));
        expect(log).toEqual(["second"]);
    });

    it("one write that throws does not stop the others", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const landing = open();
        const log: string[] = [];
        const a = landing.join(1, "a");
        const b = landing.join(1, "b");
        landing.seal(1);
        a.land(() => {
            throw new Error("boom");
        });
        b.land(() => log.push("b"));
        expect(log).toEqual(["b"]);
        expect(error).toHaveBeenCalledTimes(1);
    });

    it("arm(null) and dispose end the wait: nothing joins, nothing is held", () => {
        const landing = open();
        const held: string[] = [];
        landing.join(1, "a").land(() => held.push("a"));
        landing.dispose();
        vi.advanceTimersByTime(OPEN_LANDING_WAIT_MS * 2);
        expect(held).toEqual([]);

        const log: string[] = [];
        landing.join(1, "b").land(() => log.push("b"));
        landing.arm(null);
        landing.join(1, "c").land(() => log.push("c"));
        expect(log).toEqual(["b", "c"]);
    });

    it("a ticket without a landing writes at once", () => {
        const log: string[] = [];
        passThroughTicket.land(() => log.push("x"));
        passThroughTicket.cancel();
        expect(log).toEqual(["x"]);
    });
});
