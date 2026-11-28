/** The store behind the chat's task cards (MIP-2484): batched, shared, and re-read on a signal. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    installTaskCardSignals,
    noteCardMessageUpdated,
} from "../features/chat/taskCards/installTaskCardSignals";
import {
    ensureTaskCard,
    forgetTaskCards,
    getTaskCard,
    invalidateTaskCards,
    prefetchTaskCards,
    subscribeTaskCard,
} from "../features/chat/taskCards/taskCardStore";
import { emitCommentsResync, emitTaskTouched } from "../features/tasks/services/taskEvents";

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../features/chat/taskCards/taskCardApi", () => ({ fetchTaskCards: api.fetch }));

const who = { accessToken: "tok", userId: "u1" };
const T1 = "2026-11-28T10:00:00Z";
const T2 = "2026-11-28T10:05:00Z";
const cardOf = (taskId: number, kind = "task", title = `t${taskId}`) => ({ taskId, kind, title });
const asked = () => api.fetch.mock.calls.map((c) => c[1] as number[]);

let offs: (() => void)[] = [];
const mount = (id: number, stamp = T1) => {
    const seen = vi.fn();
    offs.push(subscribeTaskCard(id, seen));
    ensureTaskCard(id, stamp, who);
    return seen;
};

describe("task card store", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        forgetTaskCards();
        api.fetch.mockReset();
        api.fetch.mockImplementation(async (_token, ids: number[]) =>
            ids.filter((id) => id < 1000).map((id) => cardOf(id, id === 9 ? "milestone" : "task"))
        );
    });
    afterEach(() => {
        offs.forEach((off) => off());
        offs = [];
        vi.useRealTimers();
    });

    const settle = () => vi.advanceTimersByTimeAsync(1000);

    it("sends the cards mounting together as one request, once each", async () => {
        mount(1);
        mount(2);
        mount(1);
        await settle();
        expect(asked()).toEqual([[1, 2]]);
        expect(getTaskCard(2)).toMatchObject({ status: "ready", data: { title: "t2" } });
    });

    it("splits more than the server takes", async () => {
        prefetchTaskCards(
            Array.from({ length: 60 }, (_, i) => i + 1),
            who
        );
        await settle();
        expect(asked().map((ids) => ids.length)).toEqual([50, 10]);
    });

    it("does not read a prefetched card again when it mounts", async () => {
        prefetchTaskCards([1], who);
        await settle();
        mount(1);
        await settle();
        expect(asked()).toEqual([[1]]);
    });

    it("reads a card again when its message was rewritten, and not otherwise", async () => {
        mount(1);
        await settle();
        ensureTaskCard(1, T1, who);
        await settle();
        expect(api.fetch).toHaveBeenCalledTimes(1);
        ensureTaskCard(1, T2, who);
        await settle();
        expect(api.fetch).toHaveBeenCalledTimes(2);
    });

    it("keeps the same entry, and tells nobody, when the answer did not change", async () => {
        const seen = mount(1);
        await settle();
        const before = getTaskCard(1);
        seen.mockClear();
        invalidateTaskCards([1]);
        await settle();
        expect(getTaskCard(1)).toBe(before);
        expect(seen).not.toHaveBeenCalled();
    });

    it("marks what the server left out as gone, and a failed first read as an error", async () => {
        mount(5000);
        await settle();
        expect(getTaskCard(5000)).toEqual({ status: "gone" });
        api.fetch.mockRejectedValueOnce(new Error("offline"));
        vi.spyOn(console, "warn").mockImplementationOnce(() => {});
        mount(3);
        await settle();
        expect(getTaskCard(3)).toEqual({ status: "error" });
    });

    it("reads again after a change that came while the request was out", async () => {
        let answer: (v: unknown) => void = () => {};
        api.fetch.mockImplementationOnce(() => new Promise((r) => (answer = r)));
        mount(1);
        await settle();
        invalidateTaskCards([1]);
        answer([cardOf(1, "task", "old")]);
        await settle();
        expect(api.fetch).toHaveBeenCalledTimes(2);
        expect(getTaskCard(1)?.data?.title).toBe("t1");
    });

    it("holds one viewer's answers only", async () => {
        prefetchTaskCards([1], who);
        await settle();
        prefetchTaskCards([2], { accessToken: "tok2", userId: "u2" });
        expect(getTaskCard(1)).toBeUndefined();
    });

    it("sends what was asked for before there was a token", async () => {
        ensureTaskCard(1, T1, { accessToken: null, userId: "u1" });
        await settle();
        expect(api.fetch).not.toHaveBeenCalled();
        ensureTaskCard(1, T1, who);
        await settle();
        expect(asked()).toEqual([[1]]);
    });

    it("keeps nothing past sign-out, and reads nothing with the old token", async () => {
        mount(1);
        await settle();
        forgetTaskCards();
        await settle();
        expect(getTaskCard(1)).toBeUndefined();
        expect(api.fetch).toHaveBeenCalledTimes(1);
    });

    it("re-reads on the app's signals", async () => {
        offs.push(installTaskCardSignals());
        mount(1);
        mount(9);
        await settle();

        emitTaskTouched(1, "comment");
        await settle();
        expect(api.fetch).toHaveBeenCalledTimes(1);

        emitTaskTouched(1, "update");
        await settle();
        expect(asked()[1]).toEqual([1]);

        // Another task's card was rewritten: a milestone's progress may have moved.
        noteCardMessageUpdated({ channelKind: 3, taskId: 44 });
        await settle();
        expect(asked()[2]).toEqual([9]);
        noteCardMessageUpdated({ channelKind: 1, taskId: 44 });
        await settle();
        expect(api.fetch).toHaveBeenCalledTimes(3);

        emitCommentsResync();
        await settle();
        expect(asked()[3]).toEqual([1, 9]);
    });
});
