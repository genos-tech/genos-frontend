import { createContext, useContext } from "react";

import { CONSENT_KEY, readConsent } from "../services/consentStorage";
import { clearPrivateProfile } from "../services/privateProfileStore";

export interface AuthContextType {
    accessToken: string | null;
    setAccessToken: (token: string | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// localStorage keys to wipe when we force the user back to the
// signin screen. Mirrors the list in `sidebar.tsx`'s logout handler
// so a forced sign-out from a missing/expired refresh cookie leaves
// the same clean slate as a manual logout.
//
// `userId` is intentionally NOT in this list: it survives logout as
// a "last signed-in user" marker so the next sign-in can detect a
// user change and decide whether to wipe team-scoped IndexedDB.
//
// Nor are the email, phone, country, location and bio: those are never
// written to localStorage at all (MIP-619). They live in
// `privateProfileStore`, which every sign-out path clears.
export const AUTH_LOCAL_STORAGE_KEYS = [
    "isSigningIn",
    "userName",
    "avatarImgPath",
    "teamId",
    "tsJoined",
    "isOfflineForced",
    "role",
    "locationShared",
    "customStatus",
    "teamName",
    "lastOpenMyNoteId",
    "lastOpenNoteType",
    "lastChatType",
    "lastDMChatId",
    "lastGMChatId",
    "lastPMChatId",
    "lastPinnedChatId",
    "lastPinnedChatType",
    "lastProjectId",
    "lastOpenChatNoteId",
    "lastOpenTaskNoteId",
    "currentMainChatId",
];

// Device-level UI preferences that belong to "this browser for this person"
// rather than to a specific account. Preserved across user-change by
// `clearUserScopedLocalStorage` so signing in as someone else doesn't reset
// theme, locale, or layout choices.
//
// When you add a new preference hook in `hooks/common/`, add its storage
// key here too — otherwise it'll get wiped the next time a different user
// signs in on the same device.
export const DEVICE_PREFERENCE_LOCAL_STORAGE_KEYS = [
    "genos-theme-preference",
    "genos-density-preference",
    // v2 only. This is a PRESERVE list, so the retired
    // `genos-bubble-style-preference` (v1) is deliberately absent —
    // leaving it here would carry the dead key across every user switch
    // forever; omitted, the `localStorage.clear()` below sweeps it.
    "genos-bubble-style-preference-v2",
    "genos-bubble-pinned-actions-v1",
    "genos-locale",
    "genos-spotlight-preferences:v1",
    "genos-analytics-preferences:v1",
    "genos-double-click-todo-preference:v1",
    "genos.sprintBoard.sortTiers.v2",
    "genos.taskTable.sortTiers.v2",
];

// Transient cross-auth handoff state that must survive the user-change
// wipe. A pending team invite is captured BEFORE the user authenticates,
// so it isn't "the previous user's data" — it's intent for the action the
// current sign-in/sign-up is completing. Without preserving it, the
// `localStorage.clear()` in clearUserScopedLocalStorage drops the token
// before the post-auth consume funnel (JoinTeam) can redeem it. Only the
// token: JoinTeam asks the invite preview which address it is for.
export const TRANSIENT_HANDOFF_LOCAL_STORAGE_KEYS = ["pendingInviteToken"];

/**
 * Wipe localStorage of the previously signed-in user's data while keeping
 * device-level UI preferences intact. Called from the sign-in flow when a
 * *different* user signs in on the same device, so things like editor
 * drafts, Spotlight conversation history, last-opened chat/note IDs, and
 * cached profile fields don't leak across user boundaries.
 *
 * Implemented as an allowlist sweep rather than a hardcoded removal list
 * so it transparently handles team-scoped and prefix-keyed storage
 * (`genos-editor-draft:v1:*`, `spotlight:session:v1:<teamId>`,
 * `noteTabs:<teamId>`) without needing to enumerate every variant.
 */
export const clearUserScopedLocalStorage = (): void => {
    const preserved = new Map<string, string>();
    for (const key of [
        ...DEVICE_PREFERENCE_LOCAL_STORAGE_KEYS,
        ...TRANSIENT_HANDOFF_LOCAL_STORAGE_KEYS,
    ]) {
        const val = localStorage.getItem(key);
        if (val !== null) preserved.set(key, val);
    }
    // The analytics consent choice (MIP-1781). A visitor who chose on a marketing page, before
    // any account existed on this browser, is not asked again at their first sign-in, so the
    // choice is kept. When ANOTHER signed-in user was here before (`userId` is still stored:
    // the callers set the new one after this), an "accepted" is that person's, not the new
    // user's, and is dropped so the new user is asked. A "rejected" is kept: it errs towards
    // sending nothing, and the new user can turn analytics on in Settings.
    const consent = localStorage.getItem(CONSENT_KEY);
    const otherUserWasHere = Boolean(localStorage.getItem("userId"));
    if (consent !== null && !(otherUserWasHere && readConsent() === "accepted")) {
        preserved.set(CONSENT_KEY, consent);
    }
    localStorage.clear();
    for (const [key, val] of preserved) {
        localStorage.setItem(key, val);
    }
    // The previous user's private profile is in memory, not storage.
    clearPrivateProfile();
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};

/**
 * The access token, or `null` when there is no provider above — for
 * hooks whose behaviour merely *improves* with a token and must not
 * take the whole subtree down without one.
 *
 * The upload-size guards are the case this exists for: they degrade to
 * a permissive default when they can't resolve the tier, which is
 * strictly better than throwing. `useAuth` keeps throwing, deliberately
 * — anything that actually needs to authenticate a request should fail
 * loudly rather than silently act signed-out.
 */
export const useOptionalAccessToken = (): string | null =>
    useContext(AuthContext)?.accessToken ?? null;
