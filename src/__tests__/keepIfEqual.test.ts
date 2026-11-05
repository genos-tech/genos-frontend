/**
 * keepIfEqual — the identity guard behind the 60 s background refreshes.
 *
 * Idle for two minutes the app re-rendered ~400,000 components, because
 * every refresh wrote a brand-new array into state even when the server's
 * answer was unchanged. `setState((prev) => keepIfEqual(prev, next))` turns
 * an unchanged answer into a no-op. The two failure modes are opposite:
 *
 *   - too STRICT → the churn this exists to remove;
 *   - too LOOSE  → state silently stops updating after a real change.
 *
 * Both are pinned below.
 */

import { describe, expect, it } from "vitest";

import { keepIfEqual } from "../utils/keepIfEqual";

const rows = () => [
    { noteId: 1, title: "Alpha", tsUpdated: "2026-11-03 10:00:00", folderId: null },
    { noteId: 2, title: "Beta", tsUpdated: "2026-11-03 10:05:00", folderId: 7 },
];

describe("keepIfEqual", () => {
    it("returns prev when next is a fresh array with equal content", () => {
        const prev = rows();
        expect(keepIfEqual(prev, rows())).toBe(prev);
    });

    it("returns prev when it is passed itself", () => {
        const prev = rows();
        expect(keepIfEqual(prev, prev)).toBe(prev);
    });

    it("returns next when a field changed", () => {
        const prev = rows();
        const next = rows();
        next[1].title = "Beta renamed";
        expect(keepIfEqual(prev, next)).toBe(next);
    });

    it("returns next when a row was added or removed", () => {
        const prev = rows();
        const added = [...rows(), { noteId: 3, title: "Gamma", tsUpdated: "", folderId: null }];
        expect(keepIfEqual(prev, added)).toBe(added);
        const removed = rows().slice(0, 1);
        expect(keepIfEqual(prev, removed)).toBe(removed);
    });

    it("returns next when only the order changed", () => {
        // Order is meaningful in the lists this guards (server-sorted), so a
        // reorder is a real change and must reach the UI.
        const prev = rows();
        const next = rows().reverse();
        expect(keepIfEqual(prev, next)).toBe(next);
    });

    it("returns next for a changed nested value", () => {
        const prev = [{ id: 1, tags: [{ tagId: 1, name: "a" }] }];
        const next = [{ id: 1, tags: [{ tagId: 1, name: "b" }] }];
        expect(keepIfEqual(prev, next)).toBe(next);
    });

    it("compares keyed records too (the team profile map)", () => {
        const prev = { u1: { userId: "u1", avatarImgPath: "a.png" } };
        expect(keepIfEqual(prev, { u1: { userId: "u1", avatarImgPath: "a.png" } })).toBe(prev);
        const changed = { u1: { userId: "u1", avatarImgPath: "b.png" } };
        expect(keepIfEqual(prev, changed)).toBe(changed);
        const grown = { ...prev, u2: { userId: "u2", avatarImgPath: "" } };
        expect(keepIfEqual(prev, grown)).toBe(grown);
    });

    it("treats empty-to-empty as unchanged and empty-to-filled as changed", () => {
        const prev: unknown[] = [];
        expect(keepIfEqual(prev, [])).toBe(prev);
        const next = [{ id: 1 }];
        expect(keepIfEqual(prev, next)).toBe(next);
    });

    it("does not confuse null / undefined with an empty value", () => {
        const empty: unknown[] = [];
        expect(keepIfEqual<unknown[] | null | undefined>(empty, null)).toBeNull();
        expect(keepIfEqual<unknown[] | null | undefined>(null, empty)).toBe(empty);
        expect(keepIfEqual<unknown[] | undefined>(empty, undefined)).toBeUndefined();
        expect(keepIfEqual<unknown[] | undefined>(undefined, empty)).toBe(empty);
    });

    it("returns next, without throwing, when a value cannot be serialized", () => {
        const cyclic = (): Record<string, unknown> => {
            const o: Record<string, unknown> = { id: 1 };
            o.self = o;
            return o;
        };
        const prev = cyclic();
        const next = cyclic();
        expect(() => keepIfEqual(prev, next)).not.toThrow();
        expect(keepIfEqual(prev, next)).toBe(next);

        const big = { n: BigInt(1) };
        const bigNext = { n: BigInt(1) };
        expect(keepIfEqual(big, bigNext)).toBe(bigNext);
    });

    describe("ignoreKeys", () => {
        const roster = (ts: string, over: Record<string, unknown> = {}) => ({
            u1: { userId: "u1", avatarImgPath: "a.png", isOnline: true, tsLastSeen: ts, ...over },
            u2: { userId: "u2", avatarImgPath: "", isOnline: false, tsLastSeen: "old", ...over },
        });

        it("treats a difference only in an ignored key, at any depth, as equal", () => {
            const prev = roster("2026-11-03 10:00:07");
            expect(keepIfEqual(prev, roster("2026-11-03 10:01:07"), ["tsLastSeen"])).toBe(prev);

            const list = [{ userId: "u1", tsLastSeen: "a", nested: { tsLastSeen: "x" } }];
            const later = [{ userId: "u1", tsLastSeen: "b", nested: { tsLastSeen: "y" } }];
            expect(keepIfEqual(list, later, ["tsLastSeen"])).toBe(list);
        });

        it("still reports every other difference", () => {
            const prev = roster("2026-11-03 10:00:07");
            const avatar = roster("2026-11-03 10:01:07", { avatarImgPath: "b.png" });
            expect(keepIfEqual(prev, avatar, ["tsLastSeen"])).toBe(avatar);
            const presence = roster("2026-11-03 10:00:07", { isOnline: false });
            expect(keepIfEqual(prev, presence, ["tsLastSeen"])).toBe(presence);
        });

        it("does not ignore anything it was not told to", () => {
            const prev = roster("2026-11-03 10:00:07");
            const next = roster("2026-11-03 10:01:07");
            expect(keepIfEqual(prev, next)).toBe(next);
            expect(keepIfEqual(prev, next, [])).toBe(next);
            expect(keepIfEqual(prev, next, ["somethingElse"])).toBe(next);
        });

        it("keeps the previous value, including its stale ignored field", () => {
            const prev = roster("2026-11-03 10:00:07");
            const kept = keepIfEqual(prev, roster("2026-11-03 10:01:07"), ["tsLastSeen"]);
            expect(kept.u1.tsLastSeen).toBe("2026-11-03 10:00:07");
        });
    });

    it("short-circuits arrays of different length without serializing them", () => {
        let serialized = 0;
        const probe = {
            toJSON() {
                serialized += 1;
                return 1;
            },
        };
        const prev = [probe];
        const next = [probe, probe];
        expect(keepIfEqual(prev, next)).toBe(next);
        expect(serialized).toBe(0);
    });

    it("is cheap enough for the largest payloads it guards", () => {
        const make = () =>
            Array.from({ length: 2000 }, (_, i) => ({
                taskId: i,
                title: `Task ${i} `.repeat(4),
                status: "open",
                assignee: { userId: `u${i % 20}`, userName: `User ${i % 20}` },
                tags: [{ tagId: i % 7, name: `tag-${i % 7}` }],
            }));
        const prev = make();
        const started = performance.now();
        const kept = keepIfEqual(prev, make());
        const elapsed = performance.now() - started;
        expect(kept).toBe(prev);
        // Generous bound: it is a few ms on a laptop; this only catches an
        // accidental O(n^2).
        expect(elapsed).toBeLessThan(500);
    });
});
