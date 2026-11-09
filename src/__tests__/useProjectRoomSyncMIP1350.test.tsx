/**
 * MIP-1350: the socket server is asked to re-check my project rooms when the set
 * of projects I have joined changes, and not otherwise.
 */
import { StrictMode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { joinedProjectKey, useProjectRoomSync } from "../hooks/common/useProjectRoomSync";

type P = { projectId: number; isJoined?: boolean };
const p = (projectId: number, isJoined?: boolean): P => ({ projectId, isJoined });
const fakeSocket = (connected = true) => ({ connected, emit: vi.fn() });

describe("joinedProjectKey", () => {
    it("lists only joined projects, in a stable order", () => {
        expect(joinedProjectKey([p(3, true), p(1, true), p(2, false), p(4)])).toBe("1,3");
    });

    it("is the same however the list is ordered", () => {
        expect(joinedProjectKey([p(2, true), p(1, true)])).toBe(
            joinedProjectKey([p(1, true), p(2, true)])
        );
    });

    it("is empty with nothing joined", () => {
        expect(joinedProjectKey([])).toBe("");
        expect(joinedProjectKey([p(1, false), p(2)])).toBe("");
    });

    it("only a literal true counts as joined", () => {
        expect(joinedProjectKey([{ projectId: 1, isJoined: "true" as never }])).toBe("");
    });
});

describe("useProjectRoomSync", () => {
    const setup = (initial: P[], socket = fakeSocket() as ReturnType<typeof fakeSocket> | null) =>
        renderHook(({ projects, s }) => useProjectRoomSync(s as never, projects), {
            initialProps: { projects: initial, s: socket },
        });

    it("asks nothing for the first list it sees (the connect fetched it)", () => {
        const socket = fakeSocket();
        setup([p(1, true)], socket);
        expect(socket.emit).not.toHaveBeenCalled();
    });

    it("asks when a project is joined", () => {
        const socket = fakeSocket();
        const view = setup([p(1, true), p(2, false)], socket);
        view.rerender({ projects: [p(1, true), p(2, true)], s: socket });
        expect(socket.emit).toHaveBeenCalledTimes(1);
        expect(socket.emit).toHaveBeenCalledWith("sync_project_rooms");
    });

    it("asks when a project is left or the user is removed from it", () => {
        const socket = fakeSocket();
        const view = setup([p(1, true), p(2, true)], socket);
        view.rerender({ projects: [p(1, true), p(2, false)], s: socket });
        expect(socket.emit).toHaveBeenCalledTimes(1);
    });

    it("asks when a project is created", () => {
        const socket = fakeSocket();
        const view = setup([p(1, true)], socket);
        view.rerender({ projects: [p(1, true), p(9, true)], s: socket });
        expect(socket.emit).toHaveBeenCalledTimes(1);
    });

    it("asks when the very first project is created (nothing joined before)", () => {
        const socket = fakeSocket();
        const view = setup([], socket);
        view.rerender({ projects: [p(5, true)], s: socket });
        expect(socket.emit).toHaveBeenCalledTimes(1);
    });

    it("does not ask for a re-render that changes nothing", () => {
        const socket = fakeSocket();
        const view = setup([p(1, true), p(2, true)], socket);
        view.rerender({ projects: [p(2, true), p(1, true)], s: socket }); // same set, new order
        view.rerender({ projects: [p(1, true), p(2, true)], s: socket });
        expect(socket.emit).not.toHaveBeenCalled();
    });

    it("does not ask when only an unjoined project appears or goes", () => {
        const socket = fakeSocket();
        const view = setup([p(1, true)], socket);
        view.rerender({ projects: [p(1, true), p(2, false)], s: socket });
        view.rerender({ projects: [p(1, true)], s: socket });
        expect(socket.emit).not.toHaveBeenCalled();
    });

    it("does not ask while the socket is not connected (its connect will fetch the list)", () => {
        const socket = fakeSocket(false);
        const view = setup([p(1, true)], socket);
        view.rerender({ projects: [p(1, true), p(2, true)], s: socket });
        expect(socket.emit).not.toHaveBeenCalled();
    });

    it("treats a new socket's first list as its baseline", () => {
        const first = fakeSocket();
        const second = fakeSocket();
        const view = setup([p(1, true)], first);
        view.rerender({ projects: [p(1, true), p(2, true)], s: second });
        expect(second.emit).not.toHaveBeenCalled();
        view.rerender({ projects: [p(1, true), p(2, true), p(3, true)], s: second });
        expect(second.emit).toHaveBeenCalledTimes(1);
        expect(first.emit).not.toHaveBeenCalled();
    });

    it("does not ask on mount under StrictMode, which runs every effect twice", () => {
        const socket = fakeSocket();
        renderHook(() => useProjectRoomSync(socket as never, [p(1, true), p(2, true)]), {
            wrapper: StrictMode,
        });
        expect(socket.emit).not.toHaveBeenCalled();
    });

    it("does nothing without a socket", () => {
        const view = setup([p(1, true)], null);
        expect(() => view.rerender({ projects: [p(1, true), p(2, true)], s: null })).not.toThrow();
    });

    it("sends no project ids", () => {
        const socket = fakeSocket();
        const view = setup([p(1, true)], socket);
        view.rerender({ projects: [p(1, true), p(2, true)], s: socket });
        expect(socket.emit.mock.calls[0]).toEqual(["sync_project_rooms"]);
    });
});
