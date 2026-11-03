/**
 * `useTaskDeliveries` refreshes a task's delivery links when the window gets
 * focus (a PR's state moves on GitHub with no local signal: "merge it,
 * alt-tab back"). That refresh skips the cache on purpose.
 *
 * The skip used to be `forceRefresh: focusNonce > 0`. The nonce only ever
 * grows, so after the FIRST focus of the page's life, every later load
 * (every task switch) skipped the cache too, and, since a forced load never
 * joins one in flight, every switch burst sent duplicate requests. Only the
 * load that a focus causes may skip the cache.
 */
import { act } from "react";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTaskDeliveries } from "../../features/tasks/hooks/useTaskDeliveries";

const calls = vi.hoisted(() => ({ urls: [] as string[] }));

vi.mock("../../services/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../services/api")>()),
    authApi: () => ({
        get: (url: string) => {
            calls.urls.push(url);
            return Promise.resolve({ data: [] });
        },
    }),
}));
vi.mock("../../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));

const ME = { userId: "u1", teamId: "t1" } as never;
// Ids nobody else in this file's module-level cache has seen.
const A = 7101;
const B = 7102;

const requestsFor = (id: number) => calls.urls.filter((u) => u.includes(`task_id=${id}`)).length;
const flush = () =>
    act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });

beforeEach(() => {
    calls.urls.length = 0;
});

describe("useTaskDeliveries cache use", () => {
    it("a task switch after the window has been focused once still uses the cache", async () => {
        const view = renderHook(({ id }) => useTaskDeliveries(ME, id), {
            initialProps: { id: A },
        });
        await flush();
        view.rerender({ id: B });
        await flush();
        expect([requestsFor(A), requestsFor(B)]).toEqual([1, 1]);

        // The window is focused: the shown task's links are re-read, cache or not.
        act(() => {
            window.dispatchEvent(new Event("focus"));
        });
        await flush();
        expect([requestsFor(A), requestsFor(B)]).toEqual([1, 2]);

        // Switching back and forth inside the 15 s cache lifetime sends nothing.
        view.rerender({ id: A });
        await flush();
        view.rerender({ id: B });
        await flush();
        view.rerender({ id: A });
        await flush();
        expect([requestsFor(A), requestsFor(B)]).toEqual([1, 2]);
    });

    it("every focus refreshes the shown task, not only the first", async () => {
        const view = renderHook(({ id }) => useTaskDeliveries(ME, id), {
            initialProps: { id: 7103 },
        });
        await flush();
        for (let i = 1; i <= 3; i += 1) {
            act(() => {
                window.dispatchEvent(new Event("focus"));
            });
            await flush();
            expect(requestsFor(7103)).toBe(1 + i);
        }
        view.unmount();
    });

    it("a task that is not open loads nothing", async () => {
        renderHook(() => useTaskDeliveries(ME, null));
        await flush();
        expect(calls.urls).toEqual([]);
    });
});
