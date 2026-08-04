/**
 * People from another team, rendering with a name and a face.
 *
 * `teamMemberProfiles` is one team's roster, so it can never contain the
 * host team's people — and cross-team work is made of them: the owner of a
 * shared GM chat, the members listed beside them, the assignee of a task in
 * a shared project. Every one of those resolved to `undefined`, which is a
 * row with a blank name and a "?" avatar.
 *
 * The fix does not widen any fetch (a guest must not get the host's staff
 * list). It keeps the identities that already ride along on payloads the
 * reader is entitled to, so these tests are about precedence and about the
 * store staying quiet when it learns nothing.
 */
import { act } from "react";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AvatarContextProvider, useUserProfile } from "../components/ui/avatars/AvatarContext";
import { forgetEveryone, rememberPeople } from "../components/ui/avatars/userDirectory";
import type { UserProps } from "../types/admin";

const me = { userId: "me", userName: "Me", avatarImgPath: "me.png" } as unknown as UserProps;
const colleague = {
    userId: "u2",
    userName: "Colleague",
    avatarImgPath: "roster.png",
} as unknown as UserProps;

const ctxValue = {
    myself: me,
    setMyself: () => {},
    teamMemberProfiles: { u2: colleague },
    setTeamMemberProfiles: () => {},
    socket: null,
    useCM: {} as never,
    useUISM: {} as never,
};

const profileFor = (userId: string) =>
    renderHook(() => useUserProfile(userId), {
        wrapper: ({ children }) => (
            <AvatarContextProvider value={ctxValue}>{children}</AvatarContextProvider>
        ),
    });

describe("cross-team people", () => {
    afterEach(() => {
        act(() => forgetEveryone());
    });

    it("names somebody who is in no roster we hold", () => {
        rememberPeople([
            {
                userId: "host1",
                userName: "Host Owner",
                userEmail: "o@a.test",
                avatarImgPath: "a.png",
            },
        ]);
        const { result } = profileFor("host1");
        expect(result.current?.userName).toBe("Host Owner");
        expect(result.current?.avatarImgPath).toBe("a.png");
    });

    it("fills in a row that was already on screen when the payload lands", () => {
        // The GM member list renders before its roster fetch resolves, so
        // a store that only answered on mount would leave the blank rows
        // blank until something else re-rendered them.
        const { result } = profileFor("host2");
        expect(result.current).toBeUndefined();
        act(() => rememberPeople([{ userId: "host2", userName: "Late Arrival" }]));
        expect(result.current?.userName).toBe("Late Arrival");
    });

    it("never displaces the team roster, which is the fuller record", () => {
        // The roster is fetched, complete, and carries presence; a
        // denormalized copy on a message is a snapshot of a name.
        rememberPeople([{ userId: "u2", userName: "Stale Copy", avatarImgPath: "stale.png" }]);
        const { result } = profileFor("u2");
        expect(result.current?.userName).toBe("Colleague");
        expect(result.current?.avatarImgPath).toBe("roster.png");
    });

    it("never displaces you, whose local edits are ahead of every payload", () => {
        rememberPeople([{ userId: "me", userName: "Old Me" }]);
        const { result } = profileFor("me");
        expect(result.current?.userName).toBe("Me");
    });

    it("takes an avatar-only or email-only record, and ignores an empty one", () => {
        rememberPeople([
            { userId: "faceless", userEmail: "f@a.test" },
            { userId: "nobody", userName: "", avatarImgPath: null },
        ]);
        expect(profileFor("faceless").result.current?.userEmail).toBe("f@a.test");
        expect(profileFor("nobody").result.current).toBeUndefined();
    });

    it("accepts either spelling of the fields, because both are on the wire", () => {
        // `ChannelMember.user` says `userEmail` / `avatarImgPath`; a
        // share's participants say `email` / `avatarUrl`.
        rememberPeople([
            { userId: "p1", userName: "Party", email: "p@b.test", avatarUrl: "p.png" },
        ]);
        const { result } = profileFor("p1");
        expect(result.current?.userEmail).toBe("p@b.test");
        expect(result.current?.avatarImgPath).toBe("p.png");
    });

    it("does not re-render every avatar on screen when a sync teaches it nothing", () => {
        // A chat sync re-delivers the whole roster constantly. Notifying on
        // an unchanged entry would turn each one into a render of every
        // avatar in the tree.
        rememberPeople([{ userId: "host3", userName: "Same", avatarImgPath: "s.png" }]);
        const { result, rerender } = profileFor("host3");
        const first = result.current;
        act(() => rememberPeople([{ userId: "host3", userName: "Same", avatarImgPath: "s.png" }]));
        rerender();
        expect(result.current).toBe(first);
    });
});
