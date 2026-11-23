/**
 * The first-run card as a question the ask flow awaits (MIP-2192): one card at a time, and no host
 * means no run.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
    registerSkillRunCardHost,
    requestSkillRunConfirmation,
    settleSkillRunConfirmation,
    useSkillRunRequest,
} from "../features/genos/skills/skillRunCardStore";

const A = { teamId: "t", skillId: "a", versionNo: 1 };
const B = { teamId: "t", skillId: "b", versionNo: 2 };

describe("requestSkillRunConfirmation", () => {
    it("resolves false at once when no host is mounted (nobody could ask the person)", async () => {
        await expect(requestSkillRunConfirmation(A)).resolves.toBe(false);
    });

    it("resolves with the person's answer and clears the request", async () => {
        const off = registerSkillRunCardHost();
        const { result } = renderHook(() => useSkillRunRequest());
        let answer: Promise<boolean> | undefined;
        act(() => {
            answer = requestSkillRunConfirmation(A);
        });
        expect(result.current).toMatchObject(A);
        act(() => settleSkillRunConfirmation(A, true));
        await expect(answer).resolves.toBe(true);
        expect(result.current).toBeNull();
        off();
    });

    it("a newer request replaces the older one, which resolves false", async () => {
        const off = registerSkillRunCardHost();
        let first: Promise<boolean> | undefined;
        let second: Promise<boolean> | undefined;
        act(() => {
            first = requestSkillRunConfirmation(A);
            second = requestSkillRunConfirmation(B);
        });
        await expect(first).resolves.toBe(false);
        // A stale answer for the replaced request does nothing.
        act(() => settleSkillRunConfirmation(A, true));
        act(() => settleSkillRunConfirmation(B, true));
        await expect(second).resolves.toBe(true);
        off();
    });

    it("an open request resolves false when the last host goes away", async () => {
        const off = registerSkillRunCardHost();
        let answer: Promise<boolean> | undefined;
        act(() => {
            answer = requestSkillRunConfirmation(A);
        });
        act(() => off());
        await expect(answer).resolves.toBe(false);
    });
});
