import { describe, expect, it } from "vitest";

import { classifyNavigation } from "../services/perf/classifyNavigation";
import {
    FINALIZE_AFTER_MS,
    IDLE_WINDOW_MS,
    PerfRecorderCore,
    RECENT_INPUT_MS,
    WINDOW_MS,
    type PerfSample,
} from "../services/perf/perfRecorderCore";

const TASKS = "/workspace/tasks/project/1";
const make = (start = 0) => {
    const out: PerfSample[] = [];
    const core = new PerfRecorderCore((s) => out.push(s), start, classifyNavigation);
    return { core, out };
};

/** A click at `t` that leads to a route change 150 ms later. */
const click = (core: PerfRecorderCore, t: number, from: string, to: string) => {
    core.navigated(from, t - 1); // seeds the previous path
    core.input(t);
    core.navigated(to, t + 150);
};

describe("PerfRecorderCore: interactions", () => {
    it("reports paint, settle, blocked time, worst freeze and requests for one click", () => {
        const { core, out } = make();
        click(core, 1000, `${TASKS}/task/4`, `${TASKS}/task/5`);
        core.paint(1000, 120);
        core.longTask(1200, 300); // 1200-1500
        core.longTask(1800, 200); // 1800-2000
        core.longTask(4100, 500); // after the window
        core.request(1160, 1400);
        core.request(1170, 2600);
        core.request(4200, 4300); // after the window
        core.tick(1000 + FINALIZE_AFTER_MS);
        expect(out).toEqual([
            {
                kind: "task_switch",
                paint_ms: 120,
                settle_ms: 1600, // the response that ended at 2600, minus the click at 1000
                content_ms: 1600, // nothing here is background traffic: the same
                blocked_ms: 500,
                longest_ms: 300,
                requests: 2,
                window_ms: WINDOW_MS,
            },
        ]);
    });

    it("waits for slow responses: nothing is emitted before the finalize delay", () => {
        const { core, out } = make();
        click(core, 1000, TASKS, `${TASKS}/task/5`);
        core.tick(1000 + FINALIZE_AFTER_MS - 1);
        expect(out).toEqual([]);
        core.tick(1000 + FINALIZE_AFTER_MS);
        expect(out).toHaveLength(1);
        expect(out[0].kind).toBe("task_open");
    });

    it("leaves paint and settle null when the browser reported nothing", () => {
        const { core, out } = make();
        click(core, 1000, "/workspace/notes", "/workspace/notes/my/9");
        core.tick(1000 + FINALIZE_AFTER_MS);
        expect(out[0]).toMatchObject({
            kind: "note_open",
            paint_ms: null,
            settle_ms: null,
            content_ms: null,
            blocked_ms: 0,
            longest_ms: 0,
            requests: 0,
        });
    });

    it("ignores a route change that no input caused (a redirect)", () => {
        const { core, out } = make();
        core.navigated(TASKS, 0);
        core.input(1000);
        core.navigated(`${TASKS}/task/5`, 1000 + RECENT_INPUT_MS + 1);
        core.tick(60_000);
        expect(out.filter((s) => s.kind !== "idle_minute")).toEqual([]);
    });

    it("ignores route changes that are not an interaction we time", () => {
        const { core, out } = make();
        click(core, 1000, "/workspace/chat/dm/a", "/workspace/chat/dm/b");
        core.tick(10_000);
        expect(out).toEqual([]);
    });

    it("closes the earlier window when the next interaction starts", () => {
        const { core, out } = make();
        click(core, 1000, `${TASKS}/task/4`, `${TASKS}/task/5`);
        click(core, 2200, `${TASKS}/task/5`, `${TASKS}/task/6`);
        core.longTask(1300, 200); // belongs to the first click
        core.longTask(2500, 400); // belongs to the second
        core.tick(1000 + FINALIZE_AFTER_MS);
        core.tick(2200 + FINALIZE_AFTER_MS);
        expect(out).toHaveLength(2);
        expect(out[0]).toMatchObject({ window_ms: 1200, blocked_ms: 200, longest_ms: 200 });
        expect(out[1]).toMatchObject({ window_ms: WINDOW_MS, blocked_ms: 400, longest_ms: 400 });
    });

    it("counts only the part of a long task that is inside the window", () => {
        const { core, out } = make();
        click(core, 1000, `${TASKS}/task/4`, `${TASKS}/task/5`);
        core.longTask(3800, 900); // starts inside, runs 700 ms past the window end (4000)
        core.tick(1000 + FINALIZE_AFTER_MS);
        expect(out[0].blocked_ms).toBe(200);
        expect(out[0].longest_ms).toBe(900);
    });

    it("clamps absurd values to the contract's 0..600000", () => {
        const { core, out } = make();
        click(core, 1000, `${TASKS}/task/4`, `${TASKS}/task/5`);
        core.paint(1000, 9e9);
        core.request(1100, 1100 + 9e9);
        core.tick(1000 + FINALIZE_AFTER_MS);
        expect(out[0].paint_ms).toBe(600_000);
        expect(out[0].settle_ms).toBe(600_000);
        expect(out[0].content_ms).toBe(600_000);
    });

    it("says when it next has work to do", () => {
        const { core } = make(0);
        expect(core.nextDueAt()).toBe(IDLE_WINDOW_MS);
        click(core, 1000, `${TASKS}/task/4`, `${TASKS}/task/5`);
        expect(core.nextDueAt()).toBe(1000 + FINALIZE_AFTER_MS);
    });
});

describe("PerfRecorderCore: content_ms", () => {
    const sampleOf = (feed: (core: PerfRecorderCore) => void): PerfSample => {
        const { core, out } = make();
        click(core, 1000, `${TASKS}/task/4`, `${TASKS}/task/5`);
        feed(core);
        core.tick(1000 + FINALIZE_AFTER_MS);
        return out[0];
    };

    it("leaves a background request out, and still counts it in settle_ms and requests", () => {
        const s = sampleOf((core) => {
            core.request(1160, 1400); // the content
            core.request(1100, 3900, true); // GitHub: ends much later
        });
        expect(s.settle_ms).toBe(2900);
        expect(s.content_ms).toBe(400);
        expect(s.requests).toBe(2);
    });

    it("counts a long task even when only background traffic ended before it", () => {
        const s = sampleOf((core) => {
            core.request(1100, 3500, true);
            core.longTask(2000, 400); // 2000-2400
        });
        expect(s.content_ms).toBe(1400);
        expect(s.settle_ms).toBe(2500);
    });

    it("is the last foreground request or long task, whichever ends later", () => {
        const later = sampleOf((core) => {
            core.request(1100, 1900);
            core.longTask(1800, 500); // ends 2300
        });
        expect(later.content_ms).toBe(1300);
        const earlier = sampleOf((core) => {
            core.request(1100, 2600);
            core.longTask(1800, 200); // ends 2000
        });
        expect(earlier.content_ms).toBe(1600);
    });

    it("is null, with settle_ms and requests still reported, when only background traffic ran", () => {
        const s = sampleOf((core) => {
            core.request(1100, 2500, true);
            core.request(1200, 2600, true);
        });
        expect(s.content_ms).toBeNull();
        expect(s.settle_ms).toBe(1600);
        expect(s.requests).toBe(2);
    });

    it("equals settle_ms when no request is flagged", () => {
        const s = sampleOf((core) => {
            core.request(1100, 2200);
            core.request(1300, 2700);
            core.longTask(1200, 300);
        });
        expect(s.content_ms).toBe(s.settle_ms);
    });

    it("treats a request as foreground unless it is flagged", () => {
        const s = sampleOf((core) => core.request(1100, 2200));
        expect(s.content_ms).toBe(1200);
    });

    it("still only counts requests that started inside the window", () => {
        const s = sampleOf((core) => {
            core.request(1100, 1500);
            core.request(1000 + WINDOW_MS + 1, 1000 + WINDOW_MS + 900); // starts after it
        });
        expect(s.content_ms).toBe(500);
    });

    it("clamps a background-only absurd value to nothing, and a foreground one to the contract", () => {
        const background = sampleOf((core) => core.request(1100, 1100 + 9e9, true));
        expect(background.content_ms).toBeNull();
        expect(background.settle_ms).toBe(600_000);
        const foreground = sampleOf((core) => core.request(1100, 1100 + 9e9));
        expect(foreground.content_ms).toBe(600_000);
    });
});

describe("PerfRecorderCore: idle minutes", () => {
    it("reports the long tasks and requests of a minute with no input", () => {
        const { core, out } = make(0);
        core.longTask(10_000, 400);
        core.longTask(30_000, 900);
        core.request(20_000, 20_300);
        core.request(25_000, 25_500, true);
        core.tick(IDLE_WINDOW_MS);
        expect(out).toEqual([
            {
                kind: "idle_minute",
                paint_ms: null,
                settle_ms: null,
                content_ms: null,
                blocked_ms: 1300,
                longest_ms: 900,
                requests: 2, // a background request is still a request in an idle minute
                window_ms: IDLE_WINDOW_MS,
            },
        ]);
    });

    it("skips a minute in which the user did anything", () => {
        const { core, out } = make(0);
        core.input(30_000);
        core.tick(IDLE_WINDOW_MS);
        expect(out).toEqual([]);
        // ...and measures the next one.
        core.tick(2 * IDLE_WINDOW_MS);
        expect(out).toHaveLength(1);
    });

    it("skips a minute in which the tab was hidden, then measures a full minute from when it is shown", () => {
        const { core, out } = make(0);
        core.setVisible(false, 10_000);
        core.tick(IDLE_WINDOW_MS);
        expect(out).toEqual([]);
        core.setVisible(true, 70_000);
        core.tick(70_000 + IDLE_WINDOW_MS - 1);
        expect(out).toEqual([]);
        core.tick(70_000 + IDLE_WINDOW_MS);
        expect(out).toHaveLength(1);
        expect(out[0].kind).toBe("idle_minute");
    });

    it("does not count a click's burst as idle", () => {
        const { core, out } = make(0);
        click(core, 59_000, `${TASKS}/task/4`, `${TASKS}/task/5`);
        core.tick(IDLE_WINDOW_MS);
        expect(out.filter((s) => s.kind === "idle_minute")).toEqual([]);
    });

    it("does not report activity from an earlier minute", () => {
        const { core, out } = make(0);
        core.longTask(5_000, 700);
        core.tick(IDLE_WINDOW_MS);
        core.tick(2 * IDLE_WINDOW_MS);
        expect(out[0].blocked_ms).toBe(700);
        expect(out[1].blocked_ms).toBe(0);
    });
});
