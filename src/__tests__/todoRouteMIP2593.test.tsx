import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTodoRoute } from "../hooks/common/useTodoRoute";

type Props = { pathname: string; selfDmId: string | undefined };

const mount = (initial: Props) => {
    const openSelfDm = vi.fn();
    const view = renderHook((p: Props) => useTodoRoute({ ...p, openSelfDm }), {
        initialProps: initial,
    });
    return { openSelfDm, ...view };
};

const events: unknown[] = [];
const record = (e: Event) => events.push((e as CustomEvent).detail);

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    events.length = 0;
    window.addEventListener("openTodoPane", record);
});
afterEach(() => window.removeEventListener("openTodoPane", record));

describe("useTodoRoute", () => {
    it("opens the list on an in-app navigation to /workspace/todo", () => {
        const view = mount({ pathname: "/workspace/chat/dm/abc", selfDmId: "me" });
        expect(view.openSelfDm).not.toHaveBeenCalled();
        view.rerender({ pathname: "/workspace/todo", selfDmId: "me" });
        expect(view.openSelfDm).toHaveBeenCalledWith("me");
        expect(localStorage.getItem("isToDoVisible")).toBe("true");
        expect(sessionStorage.getItem("todoDeepLinkTarget")).toBeNull();
    });

    it("hands the dated form's item to the pane, again once the chat page is up", () => {
        const view = mount({ pathname: "/workspace/todo/2026-08-16/item/42", selfDmId: "me" });
        const target = { itemId: 42, localDate: "2026-08-16" };
        expect(JSON.parse(sessionStorage.getItem("todoDeepLinkTarget")!)).toEqual(target);
        // Not while the chat page is still hidden: its list could not scroll.
        expect(events).toEqual([]);
        view.rerender({ pathname: "/workspace/chat/dm/me", selfDmId: "me" });
        view.rerender({ pathname: "/workspace/chat/dm/me/thread/1", selfDmId: "me" });
        expect(events).toEqual([target]);
    });

    it("forgets the item when the reader goes elsewhere before the chat page is up", () => {
        const view = mount({ pathname: "/workspace/todo/2026-08-16", selfDmId: "me" });
        view.rerender({ pathname: "/workspace/inbox", selfDmId: "me" });
        expect(events).toEqual([]);
        expect(sessionStorage.getItem("todoDeepLinkTarget")).toBeNull();
    });

    it("drops a stale item target when the whole list is asked for", () => {
        sessionStorage.setItem("todoDeepLinkTarget", '{"localDate":"2026-01-01"}');
        mount({ pathname: "/workspace/todo/", selfDmId: "me" });
        expect(sessionStorage.getItem("todoDeepLinkTarget")).toBeNull();
    });

    it("waits for the self-DM, then opens once", () => {
        const view = mount({ pathname: "/workspace/todo", selfDmId: undefined });
        expect(view.openSelfDm).not.toHaveBeenCalled();
        view.rerender({ pathname: "/workspace/todo", selfDmId: "me" });
        view.rerender({ pathname: "/workspace/todo", selfDmId: "me" });
        expect(view.openSelfDm).toHaveBeenCalledTimes(1);
    });

    it("opens again on every later navigation, the same link included", () => {
        const view = mount({ pathname: "/workspace/todo", selfDmId: "me" });
        view.rerender({ pathname: "/workspace/chat/dm/me", selfDmId: "me" });
        view.rerender({ pathname: "/workspace/todo", selfDmId: "me" });
        expect(view.openSelfDm).toHaveBeenCalledTimes(2);
    });

    it("leaves other paths alone", () => {
        const view = mount({ pathname: "/workspace/todos", selfDmId: "me" });
        view.rerender({ pathname: "/workspace/tasks", selfDmId: "me" });
        expect(view.openSelfDm).not.toHaveBeenCalled();
        expect(localStorage.getItem("isToDoVisible")).toBeNull();
    });
});
