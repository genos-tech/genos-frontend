/**
 * The signed-in user's email, phone, country, location and bio are kept in
 * memory, never in localStorage (MIP-619). genos-api encrypts those columns
 * at rest; a plain-text copy in the browser profile, outliving every
 * sign-out as an empty-or-not key, would undo the point on the device.
 *
 * What has to hold for that to be both private and usable:
 *   - no sign-in path writes them to storage, and boot deletes old copies;
 *   - a reload, which empties memory, refills them from `/user/me/`;
 *   - a sign-out clears them, and a reply to a request made before the
 *     sign-out can't bring them back;
 *   - `useMyself` picks up the refill without discarding what other hooks
 *     put on `myself` in the meantime.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, clearUserScopedLocalStorage, useAuth } from "../context/AuthContext";
import { AcceptInviteHandler } from "../features/admin/components/AcceptInviteHandler";
import { SignInForm } from "../features/admin/components/SignInForm";
import { previewInvite } from "../features/admin/services/teamInvite";
import { useMyself } from "../hooks/common/useAuth";
import { authApi, nonAuthApi } from "../services/api";
import {
    clearPrivateProfile,
    ensurePrivateProfile,
    getPrivateProfile,
    PRIVATE_PROFILE_STORAGE_KEYS,
    setPrivateProfile,
} from "../services/privateProfileStore";

vi.mock("../services/api", () => ({
    authApi: vi.fn(),
    nonAuthApi: vi.fn(),
}));

// IndexedDB has no jsdom implementation; the sign-in form wipes it on a
// user change and AuthProvider sweeps it 30 s after a token arrives.
vi.mock("../db/utils", () => ({
    DatabaseUtils: {
        clearTeamScopedStores: vi.fn(async () => undefined),
        sweepOrphanYjsDatabases: vi.fn(async () => undefined),
    },
}));
vi.mock("../db/utils/database", () => ({
    DatabaseUtils: { sweepOrphanYjsDatabases: vi.fn(async () => undefined) },
}));

vi.mock("../features/admin/services/teamInvite", () => ({
    previewInvite: vi.fn(),
}));

const PROFILE_WIRE = {
    email: "alice@example.com",
    phone_number: "+81 90-1234-5678",
    base_country: "JP",
    current_location: "Asia/Tokyo",
    about_me: "Ships things.",
};

const PROFILE = {
    userEmail: "alice@example.com",
    phoneNumber: "+81 90-1234-5678",
    baseCountry: "JP",
    currentLocation: "Asia/Tokyo",
    aboutMe: "Ships things.",
};

const storedPii = () =>
    PRIVATE_PROFILE_STORAGE_KEYS.map((key) => localStorage.getItem(key)).filter(
        (value) => value !== null
    );

/** A `/user/me/` whose reply the test releases by hand. */
const deferredMe = () => {
    let resolve: (data: unknown) => void = () => {};
    const get = vi.fn(
        () =>
            new Promise((r) => {
                resolve = (data) => r({ data });
            })
    );
    vi.mocked(authApi).mockReturnValue({ get } as never);
    return { get, reply: (data: unknown) => resolve(data) };
};

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearPrivateProfile();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("ensurePrivateProfile", () => {
    it("loads /user/me/ once for concurrent callers", async () => {
        const { get, reply } = deferredMe();

        const first = ensurePrivateProfile("tok");
        const second = ensurePrivateProfile("tok");
        reply(PROFILE_WIRE);

        expect(await first).toEqual(PROFILE);
        expect(await second).toEqual(PROFILE);
        expect(get).toHaveBeenCalledTimes(1);
        expect(get).toHaveBeenCalledWith("/user/me/");
        expect(getPrivateProfile()).toEqual(PROFILE);
    });

    it("does not ask again once the profile is in memory", async () => {
        setPrivateProfile(PROFILE);
        const { get } = deferredMe();

        expect(await ensurePrivateProfile("tok")).toEqual(PROFILE);
        expect(get).not.toHaveBeenCalled();
    });

    it("drops a reply that lands after a sign-out", async () => {
        // Otherwise the previous user's details reappear on a signed-out
        // device (or under the next user) a moment after the clear.
        const { reply } = deferredMe();
        const pending = ensurePrivateProfile("tok");

        clearPrivateProfile();
        reply(PROFILE_WIRE);

        expect(await pending).toBeNull();
        expect(getPrivateProfile().userEmail).toBe("");
    });

    it("keeps a fresher sign-in over a slower reload's reply", async () => {
        const { reply } = deferredMe();
        const pending = ensurePrivateProfile("tok");

        const fresh = { ...PROFILE, aboutMe: "Newer." };
        setPrivateProfile(fresh);
        reply(PROFILE_WIRE);

        expect(await pending).toEqual(fresh);
        expect(getPrivateProfile()).toEqual(fresh);
    });

    it("resolves to null, not an empty profile, when it can't tell", async () => {
        // Callers compare the email (the invite flow); "unknown" must not
        // read as "this user has no email".
        vi.mocked(authApi).mockReturnValue(null);
        expect(await ensurePrivateProfile(null)).toBeNull();

        vi.mocked(authApi).mockReturnValue({
            get: vi.fn().mockRejectedValue(new Error("offline")),
        } as never);
        expect(await ensurePrivateProfile("tok")).toBeNull();
    });
});

describe("AuthProvider", () => {
    const stubRefresh = (access: string) =>
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(JSON.stringify({ access }), { status: 200 }))
        );

    it("deletes the copies earlier releases cached in localStorage", () => {
        for (const key of PRIVATE_PROFILE_STORAGE_KEYS) localStorage.setItem(key, "stale");
        localStorage.setItem("userName", "Alice");
        stubRefresh("tok");

        renderHook(() => useAuth(), { wrapper: AuthProvider });

        expect(storedPii()).toEqual([]);
        // Only those keys: the rest of the session survives.
        expect(localStorage.getItem("userName")).toBe("Alice");
    });

    it("refills the profile from /user/me/ after a reload", async () => {
        stubRefresh("tok");
        vi.mocked(authApi).mockReturnValue({
            get: vi.fn().mockResolvedValue({ data: PROFILE_WIRE }),
        } as never);

        renderHook(() => useAuth(), { wrapper: AuthProvider });

        await waitFor(() => expect(getPrivateProfile()).toEqual(PROFILE));
        expect(authApi).toHaveBeenCalledWith("tok");
        expect(storedPii()).toEqual([]);
    });

    it("forgets the profile when the user changes on this device", () => {
        setPrivateProfile(PROFILE);
        clearUserScopedLocalStorage();
        expect(getPrivateProfile().userEmail).toBe("");
    });
});

describe("SignInForm", () => {
    it("keeps the profile in memory and writes none of it to localStorage", async () => {
        const post = vi.fn().mockResolvedValue({
            data: {
                access: "tok",
                user_id: "user-1",
                username: "Alice",
                ...PROFILE_WIRE,
            },
        });
        vi.mocked(nonAuthApi).mockReturnValue({ post } as never);
        const user = userEvent.setup();

        render(
            <CssVarsProvider>
                <MemoryRouter initialEntries={["/signin"]}>
                    <AuthProvider>
                        <SignInForm />
                    </AuthProvider>
                </MemoryRouter>
            </CssVarsProvider>
        );
        await user.type(screen.getByPlaceholderText("Enter your email"), "alice@example.com");
        await user.type(screen.getByPlaceholderText("Enter your password"), "pw");
        await user.click(screen.getByRole("button", { name: "Sign In" }));

        await waitFor(() => expect(localStorage.getItem("userName")).toBe("Alice"));
        expect(getPrivateProfile()).toEqual(PROFILE);
        expect(storedPii()).toEqual([]);
    });
});

describe("useMyself", () => {
    it("takes a refill that lands after the first render", async () => {
        localStorage.setItem("userId", "user-1");
        localStorage.setItem("teamId", "team-1");
        const { result } = renderHook(() => useMyself("tok"));
        await waitFor(() => expect(result.current.myself.userId).toBe("user-1"));
        expect(result.current.myself.userEmail).toBe("");

        act(() => setPrivateProfile(PROFILE));

        expect(result.current.myself).toMatchObject(PROFILE);
    });

    it("merges the refill rather than re-reading everything", async () => {
        // A re-read would also reset fields other hooks set in memory since
        // the first pull, such as a custom status expiry.
        localStorage.setItem("userId", "user-1");
        const { result } = renderHook(() => useMyself("tok"));
        await waitFor(() => expect(result.current.myself.userId).toBe("user-1"));

        act(() =>
            result.current.setMyself({
                ...result.current.myself,
                customStatusExpiry: "2026-10-21T09:00:00Z",
            })
        );
        act(() => setPrivateProfile(PROFILE));

        expect(result.current.myself.customStatusExpiry).toBe("2026-10-21T09:00:00Z");
        expect(result.current.myself.userEmail).toBe(PROFILE.userEmail);
    });
});

describe("AcceptInviteHandler", () => {
    const renderHandler = () =>
        render(
            <CssVarsProvider>
                <MemoryRouter initialEntries={["/accept-invite?token=inv-1"]}>
                    <AuthProvider>
                        <AcceptInviteHandler />
                    </AuthProvider>
                </MemoryRouter>
            </CssVarsProvider>
        );

    beforeEach(() => {
        vi.mocked(previewInvite).mockResolvedValue({
            valid: true,
            status: "account_exists",
            team_name: "Alpha",
            invited_email: "bob@example.com",
        });
        localStorage.setItem("isSigningIn", "yes");
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(JSON.stringify({ access: "tok" }), { status: 200 }))
        );
    });

    it("learns the signed-in email from the server to spot a wrong account", async () => {
        vi.mocked(authApi).mockReturnValue({
            get: vi.fn().mockResolvedValue({ data: PROFILE_WIRE }),
        } as never);

        renderHandler();

        expect(await screen.findByText("Wrong account")).toBeInTheDocument();
        expect(screen.getByText(/alice@example\.com/)).toBeInTheDocument();
        // The token is stashed for the sign-in round-trip; the address isn't.
        expect(localStorage.getItem("pendingInviteToken")).toBe("inv-1");
        expect(storedPii()).toEqual([]);
    });
});
