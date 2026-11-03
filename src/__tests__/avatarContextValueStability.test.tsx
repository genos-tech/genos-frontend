/**
 * The avatar context value must not change identity when `AppBody` re-renders
 * without changing anything an avatar reads (MIP-958).
 *
 * `AppBody` renders about 13 times for one task click. The value used to be an
 * inline object literal, so every avatar in the app re-rendered 13 times.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AvatarContextValue } from "../components/ui/avatars/AvatarContext";
import { useAvatarContextValue } from "../components/ui/avatars/useAvatarContextValue";
import type { UserProps } from "../types/admin";

const me = { userId: "u1", userName: "Me" } as UserProps;
const roster = { u1: me } as Record<string, UserProps>;
const noop = () => {};

const baseInput = (over: Partial<AvatarContextValue> = {}): AvatarContextValue => ({
    myself: me,
    setMyself: noop as AvatarContextValue["setMyself"],
    teamMemberProfiles: roster,
    setTeamMemberProfiles: noop as AvatarContextValue["setTeamMemberProfiles"],
    socket: null,
    // The two managers are brand new objects on every AppBody render.
    useCM: { tag: "cm" } as unknown as AvatarContextValue["useCM"],
    useUISM: { tag: "uism" } as unknown as AvatarContextValue["useUISM"],
    selfNotificationsPaused: false,
    ...over,
});

describe("useAvatarContextValue", () => {
    it("keeps the same value when only the manager objects are new", () => {
        const { result, rerender } = renderHook(
            (p: AvatarContextValue) => useAvatarContextValue(p),
            {
                initialProps: baseInput(),
            }
        );
        const first = result.current;
        for (let i = 0; i < 5; i += 1) rerender(baseInput());
        expect(result.current).toBe(first);
    });

    it("hands out the managers from the latest render, not the first", () => {
        const { result, rerender } = renderHook(
            (p: AvatarContextValue) => useAvatarContextValue(p),
            {
                initialProps: baseInput(),
            }
        );
        const latest = baseInput({
            useCM: { tag: "cm-2" } as unknown as AvatarContextValue["useCM"],
            useUISM: { tag: "uism-2" } as unknown as AvatarContextValue["useUISM"],
        });
        rerender(latest);
        expect((result.current.useCM as unknown as { tag: string }).tag).toBe("cm-2");
        expect((result.current.useUISM as unknown as { tag: string }).tag).toBe("uism-2");
    });

    it.each([
        ["myself", () => ({ myself: { ...me, userName: "Renamed" } as UserProps })],
        ["teamMemberProfiles", () => ({ teamMemberProfiles: { ...roster } })],
        ["selfNotificationsPaused", () => ({ selfNotificationsPaused: true })],
    ])("produces a new value when %s changes", (_name, change) => {
        const { result, rerender } = renderHook(
            (p: AvatarContextValue) => useAvatarContextValue(p),
            {
                initialProps: baseInput(),
            }
        );
        const first = result.current;
        rerender(baseInput(change()));
        expect(result.current).not.toBe(first);
    });

    it("carries every field avatars read", () => {
        const { result } = renderHook(() => useAvatarContextValue(baseInput()));
        expect(result.current.myself).toBe(me);
        expect(result.current.teamMemberProfiles).toBe(roster);
        expect(result.current.socket).toBeNull();
        expect(result.current.selfNotificationsPaused).toBe(false);
        expect(typeof result.current.setMyself).toBe("function");
        expect(typeof result.current.setTeamMemberProfiles).toBe("function");
    });
});
