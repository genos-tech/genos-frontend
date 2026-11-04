/**
 * The author of a comment, looked up through the comments extension's user store
 * (replaces BlockNote's `useUser`, which 0.57 no longer exports).
 *
 * What matters: it is `undefined` until the store has the user, it asks the store
 * to load them, it re-renders when they arrive, it never throws, and it does not
 * ask for nobody.
 */
import { createUserStore, type User } from "@blocknote/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let userStore: ReturnType<typeof createUserStore>;

vi.mock("@blocknote/react", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@blocknote/react")>()),
    useExtension: () => ({ userStore }),
}));

const { useCommentAuthor } = await import("../components/editors/sub/useCommentAuthor");

const user = (id: string): User => ({ id, username: `name-${id}`, avatarUrl: "" });

let resolver: ReturnType<typeof vi.fn>;
beforeEach(() => {
    resolver = vi.fn(async (ids: string[]) => ids.map(user));
    userStore = createUserStore(resolver as never);
});

describe("useCommentAuthor", () => {
    it("is undefined until the store has the user, then returns them", async () => {
        const { result } = renderHook(() => useCommentAuthor("u1"));

        expect(result.current).toBeUndefined();
        await waitFor(() => expect(result.current?.username).toBe("name-u1"));
    });

    it("asks the store to load the user it is shown", async () => {
        renderHook(() => useCommentAuthor("u1"));

        await waitFor(() => expect(resolver).toHaveBeenCalledWith(["u1"], expect.anything()));
    });

    it("returns a user the store already has, without waiting", () => {
        userStore.setUser(user("u2"));

        const { result } = renderHook(() => useCommentAuthor("u2"));

        expect(result.current?.username).toBe("name-u2");
    });

    it("re-renders when the store learns the user later", async () => {
        resolver.mockImplementation(() => new Promise(() => {})); // never resolves
        const { result } = renderHook(() => useCommentAuthor("u3"));
        expect(result.current).toBeUndefined();

        act(() => userStore.setUser(user("u3")));

        expect(result.current?.username).toBe("name-u3");
    });

    it("follows the id it is given", async () => {
        const { result, rerender } = renderHook(({ id }) => useCommentAuthor(id), {
            initialProps: { id: "a" },
        });
        await waitFor(() => expect(result.current?.id).toBe("a"));

        rerender({ id: "b" });

        await waitFor(() => expect(result.current?.id).toBe("b"));
    });

    it("does not ask for nobody", async () => {
        renderHook(() => useCommentAuthor(""));
        await act(async () => {});

        expect(resolver).not.toHaveBeenCalled();
    });

    it("stays undefined and does not throw when the user cannot be loaded", async () => {
        resolver.mockRejectedValue(new Error("lookup failed"));
        const unhandled = vi.fn();
        process.on("unhandledRejection", unhandled);

        const { result } = renderHook(() => useCommentAuthor("u9"));
        await act(async () => {
            await new Promise((r) => setTimeout(r, 20));
        });
        process.off("unhandledRejection", unhandled);

        expect(result.current).toBeUndefined();
        expect(unhandled).not.toHaveBeenCalled();
    });
});
