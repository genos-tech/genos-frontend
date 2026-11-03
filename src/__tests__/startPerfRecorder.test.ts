import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    buildPayload,
    detectBuildId,
    FLUSH_AT_QUEUE,
    FLUSH_EVERY_MS,
    sendPerfSamples,
    startPerfRecorder,
} from "../services/perf/startPerfRecorder";

const API = "http://api.test/api/v2";
const TASKS = "/workspace/tasks/project/1";

class FakeObserver {
    static supportedEntryTypes = ["longtask", "resource", "event"];
    static all: FakeObserver[] = [];
    type = "";
    disconnected = false;
    constructor(private readonly cb: (list: { getEntries: () => unknown[] }) => void) {
        FakeObserver.all.push(this);
    }
    observe(o: { type: string }) {
        this.type = o.type;
    }
    disconnect() {
        this.disconnected = true;
    }
    emit(entries: unknown[]) {
        this.cb({ getEntries: () => entries });
    }
}
const observer = (type: string) => FakeObserver.all.find((o) => o.type === type)!;

let now = 0;
const advance = (ms: number) => {
    for (let left = ms; left > 0; left -= 100) {
        now += Math.min(100, left);
        vi.advanceTimersByTime(Math.min(100, left));
    }
};
const press = () => {
    const ev = new Event("pointerdown");
    Object.defineProperty(ev, "timeStamp", { value: now });
    window.dispatchEvent(ev);
};

let fetchMock: ReturnType<typeof vi.fn>;
let enabled = true;
let token: string | null = "tok";

const start = () =>
    startPerfRecorder({
        getToken: () => token,
        getHomesMounted: () => 2,
        apiBase: API,
        isEnabled: () => enabled,
    });

const sentBodies = () =>
    fetchMock.mock.calls.map((c) => JSON.parse((c[1] as { body: string }).body));

beforeEach(() => {
    now = 0;
    enabled = true;
    token = "tok";
    FakeObserver.all = [];
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("PerformanceObserver", FakeObserver);
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.head.innerHTML = "";
});

/** One task click at the current time, with some work after it. */
const clickAndWork = (rec: ReturnType<typeof start>, from: string, to: string) => {
    rec.navigated(from);
    press();
    advance(150);
    rec.navigated(to);
    observer("longtask").emit([{ startTime: now + 50, duration: 300 }]);
    observer("resource").emit([
        {
            name: `${API}/task/getTask/?id=1`,
            initiatorType: "xmlhttprequest",
            startTime: now + 10,
            responseEnd: now + 400,
            duration: 390,
        },
    ]);
    advance(6000);
};

describe("startPerfRecorder", () => {
    it("records a click and uploads it when the tab is hidden", () => {
        const rec = start();
        clickAndWork(rec, `${TASKS}/task/4`, `${TASKS}/task/5`);
        expect(fetchMock).not.toHaveBeenCalled();

        Object.defineProperty(document, "visibilityState", {
            value: "hidden",
            configurable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${API}/client-perf/`);
        expect(init.method).toBe("POST");
        expect(init.keepalive).toBe(true);
        expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
        const body = sentBodies()[0];
        expect(body.samples).toHaveLength(1);
        expect(body.samples[0]).toMatchObject({
            kind: "task_switch",
            blocked_ms: 300,
            longest_ms: 300,
            requests: 1,
        });
        expect(body.ctx).toMatchObject({ homes_mounted: 2 });
        Object.defineProperty(document, "visibilityState", {
            value: "visible",
            configurable: true,
        });
        rec.stop();
    });

    it("does not count its own upload or non-API traffic as requests", () => {
        const rec = start();
        rec.navigated(`${TASKS}/task/4`);
        press();
        advance(150);
        rec.navigated(`${TASKS}/task/5`);
        observer("resource").emit([
            {
                name: `${API}/client-perf/`,
                initiatorType: "fetch",
                startTime: now,
                responseEnd: now + 5,
                duration: 5,
            },
            {
                name: "http://cdn.test/img.png",
                initiatorType: "img",
                startTime: now,
                responseEnd: now + 5,
                duration: 5,
            },
            {
                name: "http://other.test/x",
                initiatorType: "fetch",
                startTime: now,
                responseEnd: now + 5,
                duration: 5,
            },
        ]);
        advance(6000);
        Object.defineProperty(document, "visibilityState", {
            value: "hidden",
            configurable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
        expect(sentBodies()[0].samples[0].requests).toBe(0);
        Object.defineProperty(document, "visibilityState", {
            value: "visible",
            configurable: true,
        });
        rec.stop();
    });

    it("uploads when enough samples have queued", () => {
        const rec = start();
        for (let i = 0; i < FLUSH_AT_QUEUE; i += 1) {
            clickAndWork(rec, `${TASKS}/task/${2 * i}`, `${TASKS}/task/${2 * i + 1}`);
        }
        const sent = sentBodies().flatMap((b) => b.samples);
        expect(sent.length).toBeGreaterThanOrEqual(FLUSH_AT_QUEUE);
        rec.stop();
    });

    it("uploads a waiting sample after the flush interval", () => {
        const rec = start();
        clickAndWork(rec, `${TASKS}/task/4`, `${TASKS}/task/5`);
        expect(fetchMock).not.toHaveBeenCalled();
        advance(FLUSH_EVERY_MS);
        expect(fetchMock).toHaveBeenCalled();
        rec.stop();
    });

    it("sends nothing when the user has opted out of analytics, and forgets the samples", () => {
        enabled = false;
        const rec = start();
        clickAndWork(rec, `${TASKS}/task/4`, `${TASKS}/task/5`);
        advance(FLUSH_EVERY_MS);
        expect(fetchMock).not.toHaveBeenCalled();
        // Re-enabled later: what was recorded while opted out is gone, only
        // what is measured from now on goes out.
        enabled = true;
        advance(FLUSH_EVERY_MS);
        const kinds = sentBodies().flatMap((b) => b.samples.map((x: { kind: string }) => x.kind));
        expect(kinds).not.toContain("task_switch");
        rec.stop();
    });

    it("sends nothing while signed out", () => {
        token = null;
        const rec = start();
        clickAndWork(rec, `${TASKS}/task/4`, `${TASKS}/task/5`);
        advance(FLUSH_EVERY_MS);
        expect(fetchMock).not.toHaveBeenCalled();
        rec.stop();
    });

    it("stops observing and listening when stopped", () => {
        const rec = start();
        rec.stop();
        expect(FakeObserver.all.every((o) => o.disconnected)).toBe(true);
        press();
        rec.navigated(`${TASKS}/task/9`);
        advance(FLUSH_EVERY_MS);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does nothing in a browser without PerformanceObserver", () => {
        vi.stubGlobal("PerformanceObserver", undefined);
        const rec = start();
        expect(() => rec.navigated(`${TASKS}/task/9`)).not.toThrow();
        expect(() => rec.stop()).not.toThrow();
    });

    it("keeps working when an observer entry type is unsupported", () => {
        FakeObserver.supportedEntryTypes = ["resource"];
        const rec = start();
        expect(FakeObserver.all.map((o) => o.type)).toEqual(["resource"]);
        rec.stop();
        FakeObserver.supportedEntryTypes = ["longtask", "resource", "event"];
    });
});

describe("sendPerfSamples", () => {
    const sample = {
        kind: "task_open" as const,
        paint_ms: 10,
        settle_ms: 20,
        blocked_ms: 30,
        longest_ms: 40,
        requests: 5,
        window_ms: 3000,
    };
    const ctx = { cores: 8, homes_mounted: 2, viewport_w: 1500, build: "abc" };

    it("never surfaces a failed upload", async () => {
        fetchMock.mockRejectedValue(new Error("offline"));
        expect(() => sendPerfSamples(API, "t", [sample], ctx)).not.toThrow();
        await Promise.resolve();
    });

    it("never throws when fetch itself throws", () => {
        fetchMock.mockImplementation(() => {
            throw new Error("boom");
        });
        expect(() => sendPerfSamples(API, "t", [sample], ctx)).not.toThrow();
    });

    it("matches the contract the API accepts", () => {
        expect(buildPayload([sample], ctx)).toEqual({ samples: [sample], ctx });
        expect(Object.keys(sample).sort()).toEqual([
            "blocked_ms",
            "kind",
            "longest_ms",
            "paint_ms",
            "requests",
            "settle_ms",
            "window_ms",
        ]);
    });
});

describe("detectBuildId", () => {
    it("reads the entry script's content hash", () => {
        document.head.innerHTML =
            '<script type="module" src="http://x.test/assets/index-DS7qp-tW.js"></script>';
        expect(detectBuildId()).toBe("DS7qp-tW");
    });

    it("is empty when there is no entry script", () => {
        document.head.innerHTML = "";
        expect(detectBuildId()).toBe("");
    });
});
