/**
 * MIP-1995: the agent pickers no longer get the team task list at sign-in. They ask for it when
 * a `#` trigger opens, and not for plain text or an `@`.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAgentMentionDraft } from "../features/agentQA/mentions/useAgentMentionDraft";

const setup = (value: string) => {
    const onHashOpen = vi.fn();
    const hook = renderHook(
        ({ v }: { v: string }) =>
            useAgentMentionDraft({
                value: v,
                onChange: () => {},
                members: [],
                entities: [],
                onHashOpen,
            }),
        { initialProps: { v: value } }
    );
    return { onHashOpen, hook };
};

describe("agent mention draft: lazy team tasks", () => {
    it("does not load anything for plain text", () => {
        const { onHashOpen, hook } = setup("hello");
        act(() => hook.result.current.setCaret(5));
        expect(onHashOpen).not.toHaveBeenCalled();
    });

    it("does not load for an @ mention", () => {
        const { onHashOpen, hook } = setup("@al");
        act(() => hook.result.current.setCaret(3));
        expect(onHashOpen).not.toHaveBeenCalled();
    });

    it("asks once when a # trigger opens", () => {
        const { onHashOpen, hook } = setup("see #la");
        act(() => hook.result.current.setCaret(7));
        expect(onHashOpen).toHaveBeenCalledTimes(1);
        hook.rerender({ v: "see #lau" });
        act(() => hook.result.current.setCaret(8));
        expect(onHashOpen).toHaveBeenCalledTimes(1);
    });
});
