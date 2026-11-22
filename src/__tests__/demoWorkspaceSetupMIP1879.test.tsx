/**
 * MIP-1879: the demo sign-in returns before the sample workspace is built. The app polls the api
 * while the sign-in's flag is set, reloads once on "ready", and offers a retry on "failed".
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { postDemoWorkspaceStatus } from "../features/admin/services/demoSignin";
import {
    DEMO_WORKSPACE_PENDING_KEY,
    useDemoWorkspaceSetup,
} from "../hooks/common/useDemoWorkspaceSetup";

vi.mock("../features/admin/services/demoSignin", () => ({
    postDemoWorkspaceStatus: vi.fn(),
}));
const status = vi.mocked(postDemoWorkspaceStatus);

const reload = vi.fn();

beforeEach(() => {
    vi.useFakeTimers();
    status.mockReset();
    reload.mockReset();
    Object.defineProperty(window, "location", {
        configurable: true,
        value: { ...window.location, reload },
    });
    window.sessionStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe("useDemoWorkspaceSetup", () => {
    it("does nothing without the sign-in's flag", async () => {
        const { result } = renderHook(() => useDemoWorkspaceSetup("tok"));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
        expect(result.current.state).toBe("idle");
        expect(status).not.toHaveBeenCalled();
    });

    it("polls while pending, then clears the flag and reloads once on ready", async () => {
        window.sessionStorage.setItem(DEMO_WORKSPACE_PENDING_KEY, "1");
        status.mockResolvedValueOnce("pending").mockResolvedValueOnce("ready");
        const { result } = renderHook(() => useDemoWorkspaceSetup("tok"));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(result.current.state).toBe("pending");
        expect(reload).not.toHaveBeenCalled();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1600);
        });
        expect(reload).toHaveBeenCalledTimes(1);
        expect(window.sessionStorage.getItem(DEMO_WORKSPACE_PENDING_KEY)).toBeNull();
    });

    it("shows failed on the api's word and retries on demand", async () => {
        window.sessionStorage.setItem(DEMO_WORKSPACE_PENDING_KEY, "1");
        status.mockResolvedValueOnce("failed");
        const { result } = renderHook(() => useDemoWorkspaceSetup("tok"));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(result.current.state).toBe("failed");
        status.mockResolvedValueOnce("ready");
        await act(async () => {
            result.current.retry();
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("gives up after 90 seconds of pending", async () => {
        window.sessionStorage.setItem(DEMO_WORKSPACE_PENDING_KEY, "1");
        status.mockResolvedValue("pending");
        const { result } = renderHook(() => useDemoWorkspaceSetup("tok"));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(92_000);
        });
        expect(result.current.state).toBe("failed");
    });

    it("a 404 (no demo team for this user) just ends the wait", async () => {
        window.sessionStorage.setItem(DEMO_WORKSPACE_PENDING_KEY, "1");
        status.mockResolvedValueOnce("gone");
        const { result } = renderHook(() => useDemoWorkspaceSetup("tok"));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(result.current.state).toBe("idle");
        expect(reload).not.toHaveBeenCalled();
    });
});
