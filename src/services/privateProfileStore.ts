import { authApi } from "./api";

// Module-singleton holding the signed-in user's own private profile fields:
// the ones genos-api encrypts at rest (MIP-619). They used to be mirrored
// into localStorage at sign-in, where they outlived the session, survived
// sign-out as empty-string keys, and sat in plain text on disk for anything
// with access to the browser profile. Now they live in memory only: the
// sign-in flows fill this store from their response, and after a reload
// `AuthProvider` refills it from `/user/me/` once it has a token.
//
// A plain module rather than a context for the same reason as
// `teamEmojiStore`: non-React code (`handleV3Activity`, the socket query
// builders) reads it synchronously. `useMyself` subscribes so `myself`
// picks up a refill that lands after the first render.

export type PrivateProfile = {
    userEmail: string;
    phoneNumber: string;
    baseCountry: string;
    currentLocation: string;
    aboutMe: string;
};

/** The snake_case fields of the sign-in, demo sign-in and `/user/me/`
 *  responses that this store keeps. */
export type PrivateProfileWire = {
    email?: string | null;
    phone_number?: string | null;
    base_country?: string | null;
    current_location?: string | null;
    about_me?: string | null;
};

// Where these fields used to be cached. Swept on boot so a device that
// signed in before this change doesn't keep the old copy forever.
// `pendingInviteEmail` is the invitee's address, stashed by the invite
// landing page; JoinTeam now asks the invite preview for it instead.
export const PRIVATE_PROFILE_STORAGE_KEYS = [
    "userEmail",
    "phoneNumber",
    "baseCountry",
    "currentLocation",
    "aboutMe",
    "pendingInviteEmail",
];

const EMPTY: PrivateProfile = {
    userEmail: "",
    phoneNumber: "",
    baseCountry: "",
    currentLocation: "",
    aboutMe: "",
};

let current: PrivateProfile = EMPTY;
// Whether `current` is a whole profile from the server, as opposed to
// the empty default or a few fields patched in by an editor.
let loaded = false;
// Bumped by every write, so a `/user/me/` answer that lands after a
// sign-out (or a fresher sign-in) is dropped instead of reinstating the
// previous state.
let version = 0;
let inflight: Promise<PrivateProfile | null> | null = null;
const listeners = new Set<() => void>();

const write = (next: PrivateProfile, isLoaded: boolean): void => {
    current = next;
    loaded = isLoaded;
    version += 1;
    listeners.forEach((cb) => cb());
};

export const privateProfileFromWire = (wire: PrivateProfileWire): PrivateProfile => ({
    userEmail: wire.email || "",
    phoneNumber: wire.phone_number || "",
    baseCountry: wire.base_country || "",
    currentLocation: wire.current_location || "",
    aboutMe: wire.about_me || "",
});

/** Synchronous snapshot. Every field is "" until the store is filled. */
export const getPrivateProfile = (): PrivateProfile => current;

/** Replace the whole profile, e.g. from a sign-in response. */
export const setPrivateProfile = (next: PrivateProfile): void => write(next, true);

/** Change some fields after a successful profile edit. */
export const patchPrivateProfile = (patch: Partial<PrivateProfile>): void =>
    write({ ...current, ...patch }, loaded);

/** Forget everything. Every sign-out path calls this. */
export const clearPrivateProfile = (): void => {
    inflight = null;
    write(EMPTY, false);
};

export const subscribePrivateProfile = (cb: () => void): (() => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
};

const load = async (
    api: NonNullable<ReturnType<typeof authApi>>,
    startedAt: number
): Promise<PrivateProfile | null> => {
    try {
        const res = await api.get<PrivateProfileWire>("/user/me/");
        // Something wrote while we waited: a sign-in already filled the
        // store (keep that), or a sign-out cleared it (stay cleared).
        if (version !== startedAt) return loaded ? current : null;
        write(privateProfileFromWire(res.data), true);
        return current;
    } catch (err) {
        console.warn("[auth] loading the private profile failed", err);
        return null;
    }
};

/**
 * The profile, fetched from `/user/me/` if this page hasn't got it yet.
 * Concurrent callers share one request. Resolves to `null` when there is
 * no token, the request fails, or the session ended while it was in
 * flight, so a caller can tell "unknown" apart from "empty".
 */
export const ensurePrivateProfile = (
    accessToken: string | null | undefined
): Promise<PrivateProfile | null> => {
    if (loaded) return Promise.resolve(current);
    if (inflight) return inflight;
    const api = authApi(accessToken);
    if (!api) return Promise.resolve(null);

    const request: Promise<PrivateProfile | null> = load(api, version).finally(() => {
        if (inflight === request) inflight = null;
    });
    inflight = request;
    return request;
};

/** Delete the copies earlier releases left in localStorage. */
export const purgeStoredPrivateProfile = (): void => {
    try {
        PRIVATE_PROFILE_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch {
        // Storage can be unavailable (some embedded contexts); nothing to purge.
    }
};
