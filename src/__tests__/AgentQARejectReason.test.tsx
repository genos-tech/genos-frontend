/**
 * `useAgentQA.decide` with a reason on reject (MIP-889): the ONE decision path
 * every host shares. A reason is only ever a string, trimmed and capped; no
 * reason is exactly the old request; one approval token is one decision.
 */

import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentQA } from "../features/agentQA";
import { askAgentStream, decideAgent, type PendingApprovalPayload } from "../services/agentApi";
import { REJECT_REASON_MAX } from "../services/agentRejectReason";

vi.mock("../services/agentApi", () => ({
    askAgentStream: vi.fn(async () => {}),
    decideAgent: vi.fn(async () => {}),
    submitAgentFeedback: vi.fn(async () => true),
}));

type AskArgs = Parameters<typeof askAgentStream>[0];
type DecideArgs = Parameters<typeof decideAgent>[0];

const lastAsk = (): AskArgs => vi.mocked(askAgentStream).mock.calls.at(-1)![0];
const lastDecide = (): DecideArgs => vi.mocked(decideAgent).mock.calls.at(-1)![0];

const PENDING: PendingApprovalPayload = {
    step: 1,
    tool_name: "create_task",
    arguments: { title: "Ship it" },
    approval_token: "tok-r",
    run_id: "run-r",
};

const pause = (strict = false) => {
    const hook = renderHook(() => useAgentQA({ accessToken: "tok", teamId: "team-1" }), {
        wrapper: strict ? StrictMode : undefined,
    });
    act(() => {
        hook.result.current.onAsk("q");
    });
    act(() => lastAsk().onPendingApproval?.(PENDING));
    return hook;
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("what a reject sends", () => {
    it("no reason: no `reason` key at all, as before", () => {
        const { result } = pause();
        act(() => result.current.onReject());
        expect(decideAgent).toHaveBeenCalledTimes(1);
        expect(lastDecide()).toMatchObject({
            decision: "reject",
            runId: "run-r",
            approvalToken: "tok-r",
        });
        expect(lastDecide()).not.toHaveProperty("reason");
        expect(lastDecide()).not.toHaveProperty("editedArgs");
    });

    it("a reason goes through trimmed", () => {
        const { result } = pause();
        act(() => result.current.onReject("  Wrong project.  "));
        expect(lastDecide()).toMatchObject({ decision: "reject", reason: "Wrong project." });
    });

    it("a blank reason is no reason", () => {
        const { result } = pause();
        act(() => result.current.onReject("   \n "));
        expect(lastDecide()).not.toHaveProperty("reason");
    });

    it("anything that is not a string is no reason (a click event, an edit patch)", () => {
        const { result } = pause();
        const loose = result.current.onReject as unknown as (e: unknown) => void;
        act(() => loose(new MouseEvent("click", { bubbles: true })));
        expect(lastDecide()).not.toHaveProperty("reason");
        expect(lastDecide()).not.toHaveProperty("editedArgs");
    });

    it("never sends more than the server's cap", () => {
        const { result } = pause();
        act(() => result.current.onReject("y".repeat(REJECT_REASON_MAX + 50)));
        expect(lastDecide().reason).toHaveLength(REJECT_REASON_MAX);
    });

    it("an approve never carries a reason", () => {
        const { result } = pause();
        const loose = result.current.onApprove as unknown as (a?: unknown, b?: unknown) => void;
        act(() => loose(undefined, "a reason"));
        expect(lastDecide()).toMatchObject({ decision: "approve" });
        expect(lastDecide()).not.toHaveProperty("reason");
    });
});

describe("one decision per approval", () => {
    it("two rejects in the same tick send one request", () => {
        const { result } = pause();
        act(() => {
            result.current.onReject("first");
            result.current.onReject("second");
        });
        expect(decideAgent).toHaveBeenCalledTimes(1);
        expect(lastDecide().reason).toBe("first");
    });

    it("sends one decision under StrictMode", () => {
        const { result } = pause(true);
        act(() => result.current.onReject("Wrong project."));
        expect(decideAgent).toHaveBeenCalledTimes(1);
    });

    it("flips to streaming at once: the card is replaced by the spinner", () => {
        const { result } = pause();
        act(() => result.current.onReject("Wrong project."));
        expect(result.current.ask).toMatchObject({ isStreaming: true, pendingApproval: null });
    });
});
