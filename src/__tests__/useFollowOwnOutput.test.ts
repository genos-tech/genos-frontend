import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useFollowOwnOutput } from "../features/chat/hooks/useFollowOwnOutput";

type Row = { id: string; author: string };

const row = (id: string, author = "them"): Row => ({ author, id });

const setup = (rows: Row[], resetKey = "chat-a") =>
    renderHook(
        ({ resetKey: key, rows: r }: { resetKey: string; rows: Row[] }) =>
            useFollowOwnOutput({
                getKey: (x: Row) => x.id,
                isOwn: (x: Row) => x.author === "me",
                resetKey: key,
                rows: r,
            }),
        { initialProps: { resetKey, rows } }
    );

describe("useFollowOwnOutput", () => {
    it("forces a follow for my own appended row, then stops forcing", () => {
        const { rerender, result } = setup([row("1"), row("2")]);
        // Baseline established; nothing appended yet.
        expect(result.current(false)).toBe(false);

        rerender({ resetKey: "chat-a", rows: [row("1"), row("2"), row("3", "me")] });
        expect(result.current(false)).toBe("auto");

        // One-shot: a second count change that isn't a fresh send of mine
        // (a wider history slice patched in behind the tail) must not
        // inherit the force.
        expect(result.current(false)).toBe(false);
    });

    it("does not force for someone else's appended row while scrolled up", () => {
        const { rerender, result } = setup([row("1"), row("2")]);
        result.current(false);

        rerender({ resetKey: "chat-a", rows: [row("1"), row("2"), row("3")] });
        expect(result.current(false)).toBe(false);
        // ...but still follows when the reader is at the bottom.
        expect(result.current(true)).toBe("auto");
    });

    it("keeps the verdict across a repeated render with identical props", () => {
        const { rerender, result } = setup([row("1")]);
        result.current(false);

        const grown = [row("1"), row("2", "me")];
        rerender({ resetKey: "chat-a", rows: grown });
        rerender({ resetKey: "chat-a", rows: grown });
        expect(result.current(false)).toBe("auto");
    });

    it("does not carry a pending force into another chat", () => {
        const { rerender, result } = setup([row("1"), row("2")]);
        result.current(false);

        // My own send in chat-a, but the pane switches before Virtuoso
        // reports a count change (the flag would otherwise be consumed by
        // the new chat's first sync — throwing away a deep-link jump).
        rerender({ resetKey: "chat-a", rows: [row("1"), row("2"), row("3", "me")] });
        rerender({
            resetKey: "chat-b",
            rows: [row("b1"), row("b2"), row("b3"), row("b4"), row("b5", "me")],
        });
        expect(result.current(false)).toBe(false);
    });

    it("does not read a chat switch itself as my own append", () => {
        // A longer chat whose newest message happens to be mine (sent
        // earlier, from anywhere) looks exactly like "grew + tail is mine"
        // unless the subject change resets the baseline. Forcing here would
        // override the jump `useScrollManagement` performs on a deep link.
        const { rerender, result } = setup([row("1"), row("2")]);
        result.current(false);

        rerender({
            resetKey: "chat-b",
            rows: [row("b1"), row("b2"), row("b3"), row("b4", "me")],
        });
        expect(result.current(false)).toBe(false);
    });

    it("ignores a tail-key change that did not grow the list (echo → server row)", () => {
        const { rerender, result } = setup([row("1"), row("pending", "me")]);
        result.current(false);

        rerender({ resetKey: "chat-a", rows: [row("1"), row("real-42", "me")] });
        expect(result.current(false)).toBe(false);
    });

    it("does not force on the first fill of an empty list", () => {
        const { rerender, result } = setup([]);
        rerender({ resetKey: "chat-a", rows: [row("1", "me"), row("2", "me")] });
        expect(result.current(false)).toBe(false);
    });
});
