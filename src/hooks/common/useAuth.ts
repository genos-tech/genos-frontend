import { useEffect, useRef, useState } from "react";

import { UserProps } from "../../types/admin";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";

// localStorage keys that `fetchUserData` reads into `myself`. The
// cross-tab `storage` listener only re-pulls when one of these (or
// `null`, meaning a full `localStorage.clear()`) changed — every other
// write is noise (PostHog, draft caches, history bucket, etc.).
const WATCHED_STORAGE_KEYS = new Set<string>([
    "teamId",
    "teamName",
    "userId",
    "userName",
    "userEmail",
    "tsJoined",
    "isOfflineForced",
    "role",
    "baseCountry",
    "phoneNumber",
    "currentLocation",
    "locationShared",
    "aboutMe",
    "customStatus",
    "avatarImgPath",
]);

export const useMyself = (accessToken: string | null) => {
    const [myself, setMyself] = useState<UserProps>({
        teamId: "",
        teamName: "",
        userId: "",
        userName: "",
        userEmail: "",
        tsLastSeen: "",
        tsJoined: "",
        customStatus: "",
        avatarImgPath: "",
    });

    // The team that took over the browser session from another tab, or
    // null while this tab is still the active session. The browser holds
    // exactly ONE session (the refresh cookie is singular per origin), so
    // a fresh sign-in / team-switch in another tab orphans this one. When
    // that happens we FREEZE this tab (see below) and surface the winning
    // team's name so App can render a "reload to continue" banner. Sticky
    // — once set, the tab stays frozen until the user reloads.
    const [supersededByTeamName, setSupersededByTeamName] = useState<string | null>(null);
    const supersededRef = useRef(false);
    // Mirrors the latest `myself` so the storage listener compares the
    // incoming localStorage identity against this tab's CURRENT team/user
    // (which an in-app team switch updates via `setMyself`), not a stale
    // boot-time capture — otherwise switching teams in THIS tab and then
    // a third tab switching again would misfire.
    const myselfRef = useRef(myself);
    useEffect(() => {
        myselfRef.current = myself;
    }, [myself]);

    useEffect(() => {
        const fetchUserData = () => {
            // Once superseded the tab is frozen — never re-pull identity
            // (a token refresh re-runs this effect, and localStorage now
            // holds the winning team, which would un-freeze the tab and
            // resume the leaky in-place migration we're avoiding).
            if (supersededRef.current) return;
            const newMyself: UserProps = {
                teamId: localStorage.getItem("teamId") || "",
                teamName: localStorage.getItem("teamName") || "",
                userId: localStorage.getItem("userId") || "",
                userName: localStorage.getItem("userName") || "",
                userEmail: localStorage.getItem("userEmail") || "",
                tsLastSeen: getLocalCurrentTimestamp(),
                tsJoined: localStorage.getItem("tsJoined") || "",
                isOfflineForced: localStorage.getItem("isOfflineForced") || "false",
                role: localStorage.getItem("role") || "",
                baseCountry: localStorage.getItem("baseCountry") || "",
                phoneNumber: localStorage.getItem("phoneNumber") || "",
                currentLocation: localStorage.getItem("currentLocation") || "",
                // Stored as the string "false" only when the user opted out;
                // absent (pre-feature) or "true" both mean shared, matching
                // the server default. Drives the profile editor's toggle on
                // the owner's own card — the server has already gated what
                // OTHER people's rows disclose.
                locationShared: localStorage.getItem("locationShared") !== "false",
                // `timezone` is deliberately absent, and not because your
                // own card doesn't need one — it does, and gets it from
                // `resolveZone`, which reads this browser directly when
                // the subject is the viewer. Mirroring the server's copy
                // into localStorage as well would add a second, staler
                // answer to a question the browser can answer exactly.
                aboutMe: localStorage.getItem("aboutMe") || "",
                customStatus: localStorage.getItem("customStatus") || "",
                avatarImgPath: localStorage.getItem("avatarImgPath") || "",
            };

            setMyself(newMyself);
        };

        // Add a small delay to ensure localStorage is updated. Must be
        // cleared on cleanup: unmounting (or a token refresh re-running
        // this effect) within the 50ms window otherwise leaves an orphan
        // timer that fires after teardown — a stale setMyself in prod,
        // and in vitest a crash when it outlives the jsdom environment.
        const hydrationTimer = setTimeout(fetchUserData, 50);

        // Listen for cross-document storage updates. Filter by key —
        // PostHog (and likely other third-party libs) re-writes its own
        // localStorage entries from a separate document context, which
        // fires `storage` events here. Re-pulling `myself` on those
        // events generated a new `tsLastSeen` every time and forced
        // every consumer of `myself` to churn — `useWebSocket`
        // reconnected on every fire. Only react to keys this hook
        // actually reads. `evt.key === null` covers `localStorage.clear()`,
        // which wipes our keys too.
        const onStorage = (evt: StorageEvent) => {
            // Already frozen behind the reload banner — ignore everything
            // until the user reloads.
            if (supersededRef.current) return;
            if (evt.key !== null && !WATCHED_STORAGE_KEYS.has(evt.key)) return;

            // Detect another tab taking over the session with a DIFFERENT
            // team or user. Only meaningful once THIS tab is itself signed
            // into a team (empty identity = a signed-out/booting tab, which
            // just hydrates normally). A different non-empty teamId/userId
            // means "latest login wins" has moved the browser elsewhere.
            const boundTeamId = myselfRef.current.teamId;
            const boundUserId = myselfRef.current.userId;
            if (boundTeamId || boundUserId) {
                const nextTeamId = localStorage.getItem("teamId") || "";
                const nextUserId = localStorage.getItem("userId") || "";
                const teamSwitched = nextTeamId !== "" && nextTeamId !== boundTeamId;
                const userSwitched = nextUserId !== "" && nextUserId !== boundUserId;
                if (teamSwitched || userSwitched) {
                    // Do NOT migrate `myself` in place: this tab's React
                    // state, in-flight requests and the shared IndexedDB
                    // cache are all scoped to the OLD team, so silently
                    // flipping the id here is exactly what combines data
                    // across teams. Freeze instead; the reload reboots the
                    // tab cleanly onto the winning team.
                    supersededRef.current = true;
                    setSupersededByTeamName(localStorage.getItem("teamName") || "");
                    return;
                }
            }
            fetchUserData();
        };
        window.addEventListener("storage", onStorage);

        return () => {
            clearTimeout(hydrationTimer);
            window.removeEventListener("storage", onStorage);
        };
    }, [accessToken]);

    return { myself, setMyself, supersededByTeamName };
};
