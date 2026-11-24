/**
 * `useNoteMentionUnread` hands the notes sidebar one context value (MIP-2379).
 *
 * `markRead` used to depend on the whole `useCM` and on `myself`, both new objects on every
 * render of the app, so the value changed on every render and re-rendered every consumer, the
 * whole sidebar among them. It now reads them through a ref: the value moves only with the
 * unread data and the token, and `markRead` still uses the newest manager when it runs.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useNoteMentionUnread } from "../features/notes/common/hooks/useNoteMentionUnread";
import type { UserProps } from "../types/admin";

vi.mock("../db/workers/channels", () => ({
    activityChannel: { request: vi.fn(async () => []) },
}));

const FEED: never[] = [];
const setActivityMessages = vi.fn();
const makeCM = () => ({ activityMessages: FEED, setActivityMessages });
const makeMe = () => ({ userId: "me", teamId: "t" }) as unknown as UserProps;

describe("useNoteMentionUnread", () => {
    it("keeps one value across renders that bring a new manager and a new user object", () => {
        const { result, rerender } = renderHook(
            ({ cm, me }) => useNoteMentionUnread(cm as never, me, "token"),
            { initialProps: { cm: makeCM(), me: makeMe() } }
        );
        const first = result.current;
        for (let i = 0; i < 5; i += 1) rerender({ cm: makeCM(), me: makeMe() });
        expect(result.current).toBe(first);
    });

    it("moves when the token changes", () => {
        const { result, rerender } = renderHook(
            ({ token }) => useNoteMentionUnread(makeCM() as never, makeMe(), token),
            { initialProps: { token: "a" } }
        );
        const first = result.current;
        rerender({ token: "b" });
        expect(result.current).not.toBe(first);
    });
});
