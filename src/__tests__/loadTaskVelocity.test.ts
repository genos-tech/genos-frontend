/**
 * loadTaskVelocity — the endpoint refuses more than 500 ids per request
 * (MIP-845), so a larger set is split into chunks and the series summed.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    loadTaskVelocity,
    VELOCITY_MAX_TASK_IDS,
    type VelocityPoint,
} from "../features/tasks/services/loadTaskVelocity";

const getMock = vi.hoisted(() => vi.fn());
vi.mock("../services/api", () => ({
    authApi: () => ({ get: getMock }),
}));

const ids = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const idsOf = (url: string): number[] =>
    new URLSearchParams(url.split("?")[1]).get("task_ids")!.split(",").map(Number);

const point = (date: string, n: number): VelocityPoint => ({
    date,
    created: n,
    started: n,
    closed: n,
    updated: n,
});

beforeEach(() => {
    getMock.mockReset();
});

describe("loadTaskVelocity", () => {
    it("makes one request when the ids fit", async () => {
        getMock.mockResolvedValue({ data: { velocity: [point("2026-07-01", 2)] } });
        const out = await loadTaskVelocity(
            ids(VELOCITY_MAX_TASK_IDS),
            "a",
            "b",
            "day",
            "t",
            "tok"
        );
        expect(getMock).toHaveBeenCalledTimes(1);
        expect(out).toEqual([point("2026-07-01", 2)]);
    });

    it("splits more ids than the cap into requests no larger than it", async () => {
        getMock.mockResolvedValue({ data: { velocity: [] } });
        await loadTaskVelocity(ids(1201), "a", "b", "day", "t", "tok");
        const sizes = getMock.mock.calls.map((c) => idsOf(c[0]).length);
        expect(sizes).toEqual([500, 500, 201]);
        // Every id is requested exactly once.
        const all = getMock.mock.calls.flatMap((c) => idsOf(c[0]));
        expect(new Set(all).size).toBe(1201);
    });

    it("sums the chunks' series bucket by bucket", async () => {
        getMock
            .mockResolvedValueOnce({
                data: { velocity: [point("2026-07-01", 1), point("2026-07-02", 0)] },
            })
            .mockResolvedValueOnce({
                data: { velocity: [point("2026-07-01", 2), point("2026-07-02", 3)] },
            });
        const out = await loadTaskVelocity(ids(501), "a", "b", "day", "t", "tok");
        expect(out).toEqual([point("2026-07-01", 3), point("2026-07-02", 3)]);
    });

    it("returns null when any chunk fails, rather than a partial sum", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        getMock
            .mockResolvedValueOnce({ data: { velocity: [point("2026-07-01", 1)] } })
            .mockRejectedValueOnce(new Error("boom"));
        expect(await loadTaskVelocity(ids(501), "a", "b", "day", "t", "tok")).toBeNull();
        spy.mockRestore();
    });
});
