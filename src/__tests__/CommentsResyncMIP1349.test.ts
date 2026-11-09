/**
 * MIP-1349: an open task asks for its comments again when we may have missed one.
 *
 * A comment is announced once, to whoever is connected at that moment. One
 * announced while the socket was down, or while the device slept, was never
 * replayed, so the open task kept missing it until it was reopened. The app now
 * asks again when the socket CONNECTS AGAIN and when the tab comes back after
 * being hidden for a while.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    installCommentsWakeResync,
    noteSocketConnected,
    WAKE_AFTER_HIDDEN_MS,
} from "../features/tasks/services/commentsResync";
import { onCommentsResync } from "../features/tasks/services/taskEvents";
import {
    cleanupWebSocketHandlers,
    setupWebSocketHandlers,
} from "../hooks/common/handlers/websocket-handlers";
import type { UserProps } from "../types/admin";

describe("which connects count as a reconnect", () => {
    it("the first connect of a socket is not one", () => {
        expect(noteSocketConnected({})).toBe(false);
    });

    it("every later connect of the same socket is", () => {
        const socket = {};
        noteSocketConnected(socket);
        expect(noteSocketConnected(socket)).toBe(true);
        expect(noteSocketConnected(socket)).toBe(true);
    });

    it("another socket starts over (a new socket is made on a team switch)", () => {
        const first = {};
        noteSocketConnected(first);
        noteSocketConnected(first);
        expect(noteSocketConnected({})).toBe(false);
    });
});

describe("returning to the tab", () => {
    // A document stand-in: `hidden` and the one listener the watcher installs.
    const makeDoc = (hidden = false) => {
        let listener: (() => void) | null = null;
        return {
            hidden,
            addEventListener: (_: string, l: () => void) => (listener = l),
            removeEventListener: () => (listener = null),
            fire: () => listener?.(),
            installed: () => listener !== null,
        };
    };
    let clock = 0;
    const now = () => clock;
    const heard = vi.fn();
    let off: () => void;

    beforeEach(() => {
        clock = 1_000_000;
        heard.mockClear();
        off = onCommentsResync(heard);
    });
    afterEach(() => off());

    const away = (doc: ReturnType<typeof makeDoc>, ms: number) => {
        doc.hidden = true;
        doc.fire();
        clock += ms;
        doc.hidden = false;
        doc.fire();
    };

    it("asks again after a long absence", () => {
        const doc = makeDoc();
        installCommentsWakeResync(doc, now);
        away(doc, WAKE_AFTER_HIDDEN_MS);
        expect(heard).toHaveBeenCalledTimes(1);
    });

    it("does nothing for a quick tab switch", () => {
        const doc = makeDoc();
        installCommentsWakeResync(doc, now);
        away(doc, WAKE_AFTER_HIDDEN_MS - 1);
        expect(heard).not.toHaveBeenCalled();
    });

    it("counts from the FIRST hide, not from a repeated one", () => {
        const doc = makeDoc();
        installCommentsWakeResync(doc, now);
        doc.hidden = true;
        doc.fire();
        clock += WAKE_AFTER_HIDDEN_MS - 1000;
        doc.fire(); // hidden again, still away
        clock += 2000;
        doc.hidden = false;
        doc.fire();
        expect(heard).toHaveBeenCalledTimes(1);
    });

    it("a tab that starts hidden counts from when the watcher began", () => {
        const doc = makeDoc(true);
        installCommentsWakeResync(doc, now);
        clock += WAKE_AFTER_HIDDEN_MS + 1;
        doc.hidden = false;
        doc.fire();
        expect(heard).toHaveBeenCalledTimes(1);
    });

    it("a second absence is judged on its own", () => {
        const doc = makeDoc();
        installCommentsWakeResync(doc, now);
        away(doc, WAKE_AFTER_HIDDEN_MS + 5);
        away(doc, 1000);
        expect(heard).toHaveBeenCalledTimes(1);
    });

    it("stops listening when removed", () => {
        const doc = makeDoc();
        const remove = installCommentsWakeResync(doc, now);
        remove();
        expect(doc.installed()).toBe(false);
    });
});

describe("the request caches", () => {
    const me = { userId: "u1" } as UserProps;

    // A cached answer would otherwise be served for 15 s, so a resync that only
    // re-ran the effect would refetch nothing and show the same list.
    it("a resync makes the next comments read a real request", async () => {
        const get = vi.fn().mockResolvedValue({ data: [] });
        vi.doMock("../services/api", () => ({ authApi: () => ({ get }) }));
        vi.resetModules();
        const comments = await import("../features/tasks/services/loadTaskComments");
        const events = await import("../features/tasks/services/taskEvents");

        await comments.loadTaskComments(me, 7, "t");
        await comments.loadTaskComments(me, 7, "t");
        expect(get).toHaveBeenCalledTimes(1); // the second was served from the cache

        events.emitCommentsResync();
        await comments.loadTaskComments(me, 7, "t");
        expect(get).toHaveBeenCalledTimes(2);
        vi.doUnmock("../services/api");
    });

    it("the activity feed too", async () => {
        const get = vi.fn().mockResolvedValue({ data: { results: [], data: [] } });
        vi.doMock("../services/api", () => ({ authApi: () => ({ get }) }));
        vi.resetModules();
        const activities = await import("../features/tasks/services/loadTaskActivities");
        const events = await import("../features/tasks/services/taskEvents");

        await activities.loadTaskActivities(me, 7, "t");
        await activities.loadTaskActivities(me, 7, "t");
        const before = get.mock.calls.length;
        expect(before).toBe(1);

        events.emitCommentsResync();
        await activities.loadTaskActivities(me, 7, "t");
        expect(get.mock.calls.length).toBe(before + 1);
        vi.doUnmock("../services/api");
    });
});

describe("the socket handler", () => {
    // Just enough socket for `setupWebSocketHandlers` to register on.
    const fakeSocket = (connected = false) => {
        const on = new Map<string, Array<(...a: unknown[]) => void>>();
        return {
            connected,
            on: (event: string, fn: (...a: unknown[]) => void) => {
                on.set(event, [...(on.get(event) ?? []), fn]);
            },
            off: (event: string) => {
                on.delete(event);
            },
            fire: (event: string) => (on.get(event) ?? []).forEach((fn) => fn()),
        };
    };
    const setup = (socket: ReturnType<typeof fakeSocket>) =>
        setupWebSocketHandlers(
            socket as never,
            { userId: "u1" } as UserProps,
            "token",
            null,
            -1,
            vi.fn(),
            vi.fn(),
            {} as never,
            {} as never
        );
    const heard = vi.fn();
    let off: () => void;
    beforeEach(() => {
        heard.mockClear();
        off = onCommentsResync(heard);
    });
    afterEach(() => off());

    it("the first connect is silent, a reconnect asks again", () => {
        const socket = fakeSocket();
        setup(socket);
        socket.fire("connect");
        expect(heard).not.toHaveBeenCalled();
        socket.fire("connect");
        expect(heard).toHaveBeenCalledTimes(1);
    });

    it("a setup that runs AFTER the first connect still counts the next connect as a reconnect", () => {
        const socket = fakeSocket(true);
        setup(socket);
        socket.fire("connect");
        expect(heard).toHaveBeenCalledTimes(1);
    });

    it("re-running the setup (it re-runs on chat changes) does not forget the socket", () => {
        const socket = fakeSocket();
        setup(socket);
        socket.fire("connect"); // the first connect
        // What the app does on a chat change: cleanup, then setup on the SAME socket.
        cleanupWebSocketHandlers(socket as never);
        setup(socket);
        socket.fire("connect"); // a reconnect, seen by the second setup's listener
        expect(heard).toHaveBeenCalledTimes(1);
    });
});
