import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
    AvatarContextProvider,
    resolveDisplayName,
    ResolvedUserName,
    useResolvedUserName,
} from "../components/ui/avatars/AvatarContext";
import { UserProps } from "../types/admin";

// The live-name resolver is the fix for "renames don't propagate": names are
// denormalized at write time (message.sender.userName, comment.senderName,
// mention props, task assigneeName, …), so these must resolve the CURRENT name
// at render, falling back to the stored one.

const me = { userId: "me", userName: "New Me" } as unknown as UserProps;
const other = { userId: "u2", userName: "Fresh Bob" } as unknown as UserProps;
const profiles = { u2: other };

const ctxValue = {
    myself: me,
    setMyself: () => {},
    teamMemberProfiles: profiles,
    setTeamMemberProfiles: () => {},
    socket: null,
    useCM: {} as never,
    useUISM: {} as never,
};

describe("resolveDisplayName (pure)", () => {
    it("returns the signed-in user's CURRENT name over the cached one", () => {
        // A message/comment cached "Old Me" at write time; after a rename the
        // resolver must surface `myself.userName` instead.
        expect(resolveDisplayName("me", "Old Me", me, profiles)).toBe("New Me");
    });

    it("returns another user's current name from teamMemberProfiles", () => {
        expect(resolveDisplayName("u2", "Old Bob", me, profiles)).toBe("Fresh Bob");
    });

    it("falls back to the cached name when the user isn't in either source", () => {
        expect(resolveDisplayName("ghost", "Cached Ghost", me, profiles)).toBe("Cached Ghost");
    });

    it("falls back to the cached name for a missing id or missing sources", () => {
        expect(resolveDisplayName(null, "Cached", me, profiles)).toBe("Cached");
        expect(resolveDisplayName("me", "Cached", undefined, undefined)).toBe("Cached");
    });
});

describe("useResolvedUserName (hook)", () => {
    it("resolves live inside a provider and falls back outside it", () => {
        // Inside the provider: fresh name wins over the stale fallback.
        const inside = renderHook(() => useResolvedUserName("me", "Old Me"), {
            wrapper: ({ children }) => (
                <AvatarContextProvider value={ctxValue}>{children}</AvatarContextProvider>
            ),
        });
        expect(inside.result.current).toBe("New Me");

        // Outside any provider: safely returns the cached fallback (no throw).
        const outside = renderHook(() => useResolvedUserName("me", "Old Me"));
        expect(outside.result.current).toBe("Old Me");
    });

    it("renders the resolved name in the DOM (end-to-end wiring)", () => {
        const Probe = ({ id, cached }: { id: string; cached: string }) => (
            <span>{useResolvedUserName(id, cached)}</span>
        );
        render(
            <AvatarContextProvider value={ctxValue}>
                <Probe cached="Old Me" id="me" />
            </AvatarContextProvider>
        );
        expect(screen.getByText("New Me")).toBeInTheDocument();
        expect(screen.queryByText("Old Me")).toBeNull();
    });
});

describe("ResolvedUserName (component leaf)", () => {
    it("renders the live name so memoized parents (task rows) needn't subscribe", () => {
        render(
            <AvatarContextProvider value={ctxValue}>
                <ResolvedUserName fallbackName="Old Me" userId="me" />
            </AvatarContextProvider>
        );
        expect(screen.getByText("New Me")).toBeInTheDocument();
    });
});
