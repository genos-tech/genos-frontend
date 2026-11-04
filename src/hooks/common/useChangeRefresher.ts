import { useEffect, useMemo, useRef } from "react";

import {
    ChangeRefresher,
    createChangeRefresher,
    LoaderGroups,
} from "../../context/changeRefresher";
import {
    createThrottledRefresh,
    NOTE_LIST_POLL_MS,
    ThrottledRefresh,
} from "../../context/hashMentionRefresh";
import { loadChanges } from "../../services/loadChanges";

interface UseChangeRefresherArgs {
    accessToken: string | null | undefined;
    userId: string | number | null | undefined;
    teamId: string | number | null | undefined;
    /** The open project, if any. */
    projectId: number | null | undefined;
    /**
     * The loaders of each collection, from the CURRENT render (they close over
     * that render's state setters). Read through a ref at run time, so the
     * returned `refresh` stays referentially stable.
     */
    buildGroups: (projectId: number | null) => LoaderGroups;
}

/**
 * The one entry point that refreshes the `#` menu lists, the project list and
 * the open project's tasks and sprints: a throttled, change-driven refresh
 * (see `context/changeRefresher`), wired to every trigger there is.
 *
 *   * window `focus`, `visibilitychange` (when visible), a 60 s tick while the
 *     tab is visible, and the returned `refresh` (the `#` menu calls it on every
 *     keystroke) all land on the same throttled function: one `/changes/` call
 *     per 30 s at most, however many fire.
 *   * Identity (user + team) changes reset the tokens, so a token from team A
 *     can never suppress a refresh in team B; so does signing out.
 *
 * Everything this hook keeps is per call site (a ref), not module state: a
 * second mount, a kept-alive Home, gets its own tokens, throttle and listeners,
 * and its own loaders are never skipped on the strength of another host's
 * success.
 */
export const useChangeRefresher = (args: UseChangeRefresherArgs): ThrottledRefresh => {
    const argsRef = useRef(args);
    argsRef.current = args;

    const refresherRef = useRef<ChangeRefresher | null>(null);
    if (refresherRef.current === null) refresherRef.current = createChangeRefresher();
    const refresher = refresherRef.current;

    const refresh = useMemo(
        () =>
            createThrottledRefresh(() => {
                const { accessToken, userId, teamId, projectId, buildGroups } = argsRef.current;
                const open = projectId ?? null;
                const signedIn = Boolean(accessToken) && Boolean(userId) && Boolean(teamId);
                void refresher.run({
                    identity: signedIn ? `${userId}:${teamId}` : null,
                    projectId: open,
                    // No session or team yet: nothing to ask, so a plain full refresh.
                    fetchChanges: signedIn ? () => loadChanges(accessToken, teamId!, open) : null,
                    groups: buildGroups(open),
                });
            }),
        [refresher]
    );

    // Sign-out, sign-in and a team switch each start from nothing. `run` also
    // notices a changed identity by itself; this additionally cancels a run
    // that is mid-flight right now. A rotated access token is NOT an identity
    // change: only whether there is a session is part of the key.
    const signedIn = Boolean(args.accessToken);
    useEffect(() => {
        refresher.reset();
    }, [refresher, signedIn, args.userId, args.teamId]);

    useEffect(() => {
        window.addEventListener("focus", refresh);
        return () => window.removeEventListener("focus", refresh);
    }, [refresh]);

    // `focus` only fires on a blur/focus round trip, so a user parked on the
    // page would never see anything a teammate did. `visibilitychange` catches
    // tab switches inside one window; the tick covers never leaving at all
    // (paused while hidden, so background tabs cost nothing).
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === "visible") refresh();
        };
        document.addEventListener("visibilitychange", onVisible);
        const timer = setInterval(onVisible, NOTE_LIST_POLL_MS);
        return () => {
            document.removeEventListener("visibilitychange", onVisible);
            clearInterval(timer);
        };
    }, [refresh]);

    return refresh;
};
