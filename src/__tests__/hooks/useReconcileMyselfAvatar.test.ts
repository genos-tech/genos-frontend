import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useReconcileMyselfAvatar } from "../../hooks/common/useReconcileMyselfAvatar";
import type { UserProps } from "../../types/admin";

const mkUser = (over: Partial<UserProps> = {}): UserProps => ({
    userId: "u-me",
    userName: "Me",
    userEmail: "me@example.test",
    teamId: "t1",
    teamName: "Team",
    avatarImgPath: "",
    tsLastSeen: "",
    tsJoined: "",
    ...over,
});

describe("useReconcileMyselfAvatar", () => {
    beforeEach(() => localStorage.clear());

    it("adopts the store's avatar into myself + localStorage when it differs (the fix)", () => {
        const setMyself = vi.fn();
        const myself = mkUser({ avatarImgPath: "" }); // stale/blank in this session
        const profiles = { "u-me": mkUser({ avatarImgPath: "avatars/new.png" }) };

        renderHook(() => useReconcileMyselfAvatar(myself, setMyself, profiles));

        expect(setMyself).toHaveBeenCalledWith(
            expect.objectContaining({ avatarImgPath: "avatars/new.png" })
        );
        expect(localStorage.getItem("avatarImgPath")).toBe("avatars/new.png");
    });

    it("no-ops when the store already matches myself", () => {
        const setMyself = vi.fn();
        const myself = mkUser({ avatarImgPath: "avatars/same.png" });
        const profiles = { "u-me": mkUser({ avatarImgPath: "avatars/same.png" }) };

        renderHook(() => useReconcileMyselfAvatar(myself, setMyself, profiles));

        expect(setMyself).not.toHaveBeenCalled();
    });

    it("never blanks a local avatar when the store entry has no path", () => {
        const setMyself = vi.fn();
        const myself = mkUser({ avatarImgPath: "avatars/local.png" });
        const profiles = { "u-me": mkUser({ avatarImgPath: "" }) };

        renderHook(() => useReconcileMyselfAvatar(myself, setMyself, profiles));

        expect(setMyself).not.toHaveBeenCalled();
    });

    it("no-ops when the store has no entry for the user", () => {
        const setMyself = vi.fn();
        const myself = mkUser({ avatarImgPath: "" });

        renderHook(() => useReconcileMyselfAvatar(myself, setMyself, {}));

        expect(setMyself).not.toHaveBeenCalled();
    });
});
