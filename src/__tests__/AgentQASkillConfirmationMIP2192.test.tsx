/**
 * An ask that needs the person's yes first (MIP-2192): the 409 ends the turn quietly, the first-run
 * card is requested for that skill version, and on "Run this skill" the SAME ask goes out again,
 * exactly once. On Cancel nothing is sent and nothing is shown as an error.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentQA, type AgentMentionRef } from "../features/agentQA";
import { requestSkillRunConfirmation } from "../features/genos/skills/skillRunCardStore";
import { askAgentStream } from "../services/agentApi";

vi.mock("../services/agentApi", () => ({
    askAgentStream: vi.fn(async () => {}),
    decideAgent: vi.fn(async () => {}),
    submitAgentFeedback: vi.fn(async () => true),
}));
vi.mock("../features/genos/skills/skillRunCardStore", () => ({
    requestSkillRunConfirmation: vi.fn(),
}));

type AskArgs = Parameters<typeof askAgentStream>[0];
const ask = (n: number): AskArgs => vi.mocked(askAgentStream).mock.calls[n][0];

const SKILL: AgentMentionRef = { kind: "skill", skillId: "s1", label: "weekly", version: 4 };
const TASK: AgentMentionRef = { kind: "task", taskId: 7, label: "Fix login" };
const NEEDS = {
    skillId: "s1",
    versionNo: 4,
    outside: true,
    harmful: false,
    message: "Confirm this skill before you run it.",
};

const mount = (onRunComplete = vi.fn()) =>
    renderHook(() => useAgentQA({ accessToken: "tok", teamId: "team-1", onRunComplete }));

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(askAgentStream).mockImplementation(async () => {});
});

describe("skill_needs_confirmation in the ask flow", () => {
    it("ends the turn quietly and asks the card for that skill version", () => {
        vi.mocked(requestSkillRunConfirmation).mockReturnValue(new Promise(() => {}));
        const onRunComplete = vi.fn();
        const { result } = mount(onRunComplete);
        act(() => {
            result.current.onAsk("/weekly report", [SKILL]);
        });
        expect(result.current.ask.isStreaming).toBe(true);
        act(() => {
            ask(0).onSkillNeedsConfirmation?.(NEEDS);
        });
        expect(requestSkillRunConfirmation).toHaveBeenCalledWith({
            teamId: "team-1",
            skillId: "s1",
            versionNo: 4,
        });
        expect(result.current.ask.isStreaming).toBe(false);
        expect(result.current.ask.askError).toBeNull();
        expect(result.current.turns).toEqual([]);
        // No terminal "run completed" event either: nothing ran.
        expect(onRunComplete).not.toHaveBeenCalled();
    });

    it("sends the same ask again, once, after the person confirms", async () => {
        vi.mocked(requestSkillRunConfirmation).mockResolvedValue(true);
        const { result } = mount();
        act(() => {
            result.current.onAsk("/weekly report", [SKILL, TASK]);
        });
        await act(async () => {
            ask(0).onSkillNeedsConfirmation?.(NEEDS);
        });
        await waitFor(() => expect(askAgentStream).toHaveBeenCalledTimes(2));
        const [first, second] = [ask(0), ask(1)];
        expect(second.query).toBe(first.query);
        expect(second.teamId).toBe(first.teamId);
        expect(second.skill).toEqual(first.skill);
        expect(second.skill).toEqual({ id: "s1", version_no: 4 });
        expect(second.mentions).toEqual(first.mentions);
        expect(second.signal).not.toBe(first.signal);
        // The turn is live again, as a new turn.
        expect(result.current.ask.isStreaming).toBe(true);
        expect(result.current.ask.askedQuery).toBe("/weekly report");
        expect(requestSkillRunConfirmation).toHaveBeenCalledTimes(1);
    });

    it("never loops: a second refusal after the confirmation is an ordinary error", async () => {
        vi.mocked(requestSkillRunConfirmation).mockResolvedValue(true);
        const { result } = mount();
        act(() => {
            result.current.onAsk("/weekly", [SKILL]);
        });
        await act(async () => {
            ask(0).onSkillNeedsConfirmation?.(NEEDS);
        });
        await waitFor(() => expect(askAgentStream).toHaveBeenCalledTimes(2));
        await act(async () => {
            ask(1).onSkillNeedsConfirmation?.(NEEDS);
        });
        expect(askAgentStream).toHaveBeenCalledTimes(2);
        expect(requestSkillRunConfirmation).toHaveBeenCalledTimes(1);
        expect(result.current.turns[0]?.askError).toBe("Confirm this skill before you run it.");
    });

    it("sends nothing and shows no error when the person cancels, and gives the draft back", async () => {
        vi.mocked(requestSkillRunConfirmation).mockResolvedValue(false);
        const { result } = mount();
        act(() => {
            result.current.setQuery("/weekly report");
        });
        act(() => {
            result.current.onAsk(undefined, [SKILL]);
        });
        expect(result.current.query).toBe("");
        await act(async () => {
            ask(0).onSkillNeedsConfirmation?.(NEEDS);
        });
        expect(askAgentStream).toHaveBeenCalledTimes(1);
        expect(result.current.ask.askError).toBeNull();
        expect(result.current.turns).toEqual([]);
        expect(result.current.ask.isStreaming).toBe(false);
        expect(result.current.query).toBe("/weekly report");
    });

    it("can ask again after a cancel, and shows the card again", async () => {
        vi.mocked(requestSkillRunConfirmation).mockResolvedValue(false);
        const { result } = mount();
        act(() => {
            result.current.onAsk("/weekly", [SKILL]);
        });
        await act(async () => {
            ask(0).onSkillNeedsConfirmation?.(NEEDS);
        });
        act(() => {
            result.current.onAsk("/weekly", [SKILL]);
        });
        await act(async () => {
            ask(1).onSkillNeedsConfirmation?.(NEEDS);
        });
        expect(requestSkillRunConfirmation).toHaveBeenCalledTimes(2);
    });
});
