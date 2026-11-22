/**
 * A mention of a deleted account reads "Deleted user" even when that person is on
 * no roster row and wrote nothing on screen (MIP-1820).
 *
 * The roster now lists `deletedUserIds`. The client files them in the people
 * directory as anonymised profiles (the one place it keeps "deleted"
 * knowledge), so every surface that already resolves a name through the
 * directory (MIP-1797) shows the localised label. A member who only LEFT is not
 * in the list and keeps their name; an empty or missing list changes nothing.
 */
import { act } from "react";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LightMessageBody } from "../components/messageBody/LightMessageBody";
import { AvatarContextProvider, useUserProfile } from "../components/ui/avatars/AvatarContext";
import { resolveDisplayName } from "../components/ui/avatars/avatarContextHelpers";
import {
    forgetEveryone,
    rememberDeletedUsers,
    rememberedPerson,
    rememberPeople,
} from "../components/ui/avatars/userDirectory";
import { usersChannel } from "../db/workers/channels";
import { MessageBody as ChannelMessageBody } from "../features/channel/components/MessageBody";
import { useTeamManagement } from "../hooks/common/useTeamManagement";
import { getMessages, loadLocale } from "../i18n";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";
import type { UserProps } from "../types/admin";
import { isDeletedUser } from "../utils/teamRoster";

vi.mock("../context/authState", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    useAuth: () => ({ accessToken: null }),
}));
vi.mock("../db/workers/channels", () => ({ usersChannel: { request: vi.fn() } }));
vi.mock("../features/admin/services/findTeam", () => ({
    findTeam: vi.fn(async () => ({ exist: false })),
}));
vi.mock("../features/admin/services/loadMyTeams", () => ({ loadMyTeams: vi.fn(async () => []) }));
vi.mock("../features/admin/services/popTeamMembers", () => ({
    popTeamMembers: vi.fn(async () => []),
}));

const me = { userId: "me", userName: "Me", teamId: "t1", teamName: "T" } as unknown as UserProps;
const live = { userId: "live", userName: "Live Lena", userEmail: "l@x.test" } as UserProps;
const DELETED = "Deleted user";

afterEach(() => {
    localStorage.removeItem(LOCALE_STORAGE_KEY);
    act(() => forgetEveryone());
});

describe("rememberDeletedUsers", () => {
    it("files each id as an anonymised profile", () => {
        rememberDeletedUsers(["gone-1", "gone-2"]);
        expect(isDeletedUser(rememberedPerson("gone-1")!)).toBe(true);
        expect(isDeletedUser(rememberedPerson("gone-2")!)).toBe(true);
        expect(rememberedPerson("gone-1")?.userId).toBe("gone-1");
    });

    it("a missing, empty or malformed list changes nothing", () => {
        const { result } = renderHook(() => useUserProfile("someone"), {
            wrapper: ({ children }) => (
                <AvatarContextProvider value={ctxValue({})}>{children}</AvatarContextProvider>
            ),
        });
        rememberDeletedUsers(undefined);
        rememberDeletedUsers(null);
        rememberDeletedUsers([]);
        rememberDeletedUsers("nope" as never);
        rememberDeletedUsers([7, null, ""] as never);
        expect(rememberedPerson("someone")).toBeUndefined();
        expect(result.current).toBeUndefined();
        expect(resolveDisplayName("left", "Lee Leaver", me, { live })).toBe("Lee Leaver");
    });

    it("is idempotent (a 60 s poll does not notify again)", () => {
        rememberDeletedUsers(["gone-1"]);
        const first = rememberedPerson("gone-1");
        rememberDeletedUsers(["gone-1"]);
        expect(rememberedPerson("gone-1")).toBe(first);
    });

    it("a real-name copy of the person arriving later does not put the name back", () => {
        rememberDeletedUsers(["gone-1"]);
        rememberPeople([{ userId: "gone-1", userName: "Real Name", userEmail: "r@x.test" }]);
        expect(isDeletedUser(rememberedPerson("gone-1")!)).toBe(true);
    });
});

const ctxValue = (profiles: Record<string, UserProps>) => ({
    myself: me,
    setMyself: () => {},
    teamMemberProfiles: profiles,
    setTeamMemberProfiles: () => {},
    socket: null,
    useCM: {} as never,
    useUISM: {} as never,
});

describe("resolveDisplayName with ids from the roster", () => {
    beforeEach(() => localStorage.removeItem(LOCALE_STORAGE_KEY));

    it("a deleted account on no roster row and no message reads 'Deleted user'", () => {
        rememberDeletedUsers(["eve"]);
        expect(resolveDisplayName("eve", "Eve Erased", me, { live })).toBe(DELETED);
    });

    it("a member who left keeps the real name, and so does a live member", () => {
        rememberDeletedUsers(["eve"]);
        expect(resolveDisplayName("left", "Lee Leaver", me, { live })).toBe("Lee Leaver");
        expect(resolveDisplayName("live", "Old Lena", me, { live })).toBe("Live Lena");
    });

    it("is localised", async () => {
        localStorage.setItem(LOCALE_STORAGE_KEY, "ja");
        await loadLocale("ja");
        rememberDeletedUsers(["eve"]);
        expect(resolveDisplayName("eve", "Eve Erased", me, { live })).toBe(
            getMessages("ja").tasks.messageTemplate.deletedUser
        );
    });
});

describe("chips for an id the roster listed as deleted", () => {
    const body = (userId: string, userName: string) => [
        { type: "paragraph", content: [{ type: "mention", props: { userId, userName } }] },
        { type: "paragraph", content: [] },
    ];
    const lightCtx = {
        myself: me,
        setMyself: () => {},
        socket: null,
        useCM: {} as never,
        useTEM: { teamMemberProfiles: {} } as never,
        useUISM: {} as never,
    };

    it("a chip drawn BEFORE the roster lands updates itself", () => {
        render(
            <AvatarContextProvider value={ctxValue({ live })}>
                <LightMessageBody content={body("eve", "Eve Erased")} {...lightCtx} />
            </AvatarContextProvider>
        );
        expect(screen.getByText("@Eve Erased")).toBeInTheDocument();
        act(() => rememberDeletedUsers(["eve"]));
        expect(screen.getByText(`@${DELETED}`)).toBeInTheDocument();
        expect(screen.queryByText(/Eve Erased/)).toBeNull();
    });

    it("chat bubble chip: deleted, left and live", () => {
        rememberDeletedUsers(["eve"]);
        const { unmount } = render(
            <AvatarContextProvider value={ctxValue({ live })}>
                <LightMessageBody content={body("eve", "Eve Erased")} {...lightCtx} />
            </AvatarContextProvider>
        );
        expect(screen.getByText(`@${DELETED}`)).toBeInTheDocument();
        unmount();
        render(
            <AvatarContextProvider value={ctxValue({ live })}>
                <LightMessageBody content={body("left", "Lee Leaver")} {...lightCtx} />
            </AvatarContextProvider>
        );
        expect(screen.getByText("@Lee Leaver")).toBeInTheDocument();
    });

    it("v3 channel body chip", () => {
        rememberDeletedUsers(["eve"]);
        render(
            <AvatarContextProvider value={ctxValue({ live })}>
                <ChannelMessageBody
                    body={body("eve", "Eve Erased") as never}
                    bodyText=""
                    currentUserId="me"
                />
            </AvatarContextProvider>
        );
        expect(screen.getByTestId("message-body-mention-eve")).toHaveTextContent(`@${DELETED}`);
    });
});

describe("useTeamManagement feeds the directory", () => {
    beforeEach(() => vi.mocked(usersChannel.request).mockReset());

    const answerWith = (ids: unknown) =>
        vi.mocked(usersChannel.request).mockImplementation((async (name: string) => {
            if (name === "popDeletedUserIds") return ids;
            if (name === "popTeamUsers") return { live };
            return [];
        }) as never);

    it("on boot, the ids kept by the last roster load reach the directory", async () => {
        answerWith(["eve"]);
        renderHook(() => useTeamManagement(me, "tok"));
        await waitFor(() => expect(rememberedPerson("eve")).toBeDefined());
        expect(isDeletedUser(rememberedPerson("eve")!)).toBe(true);
    });

    it("a worker that answers something else (an older worker, nothing kept) changes nothing", async () => {
        answerWith(undefined);
        renderHook(() => useTeamManagement(me, "tok"));
        await waitFor(() =>
            expect(vi.mocked(usersChannel.request)).toHaveBeenCalledWith(
                "popDeletedUserIds",
                expect.anything()
            )
        );
        expect(rememberedPerson("eve")).toBeUndefined();
    });

    it("a failing read never breaks the roster read", async () => {
        vi.mocked(usersChannel.request).mockImplementation((async (name: string) => {
            if (name === "popDeletedUserIds") throw new Error("idb closed");
            if (name === "popTeamUsers") return { live };
            return [];
        }) as never);
        const { result } = renderHook(() => useTeamManagement(me, "tok"));
        await waitFor(() => expect(result.current.teamMemberProfiles.live).toBeDefined());
    });
});
