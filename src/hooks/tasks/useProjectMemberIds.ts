import { useCallback, useRef, useState } from "react";

import { loadProjectMemberIds } from "../../features/tasks/services/loadProjectMemberIds";

// Last answer per project, so the second time a picker opens it can show the
// people at once and refresh behind them. It is never trusted as current: a
// member added since is only listed once the refresh lands, and the picker is
// re-read on every open for that reason.
//
// It belongs to who asked (MIP-1586): the server answers `/project/members/`
// per viewer, and this memory lives as long as the tab, so it is keyed by the
// signed-in user and the team as well as the project. Another user (a logout
// and a new login), or a team switch, starts from "unknown" instead of being
// handed the previous viewer's people. With no token there is no viewer, and
// nothing is remembered or shown. A rotated token of the same person is the
// same viewer, so it keeps what it knows.
const lastKnown = new Map<string, string[]>();
const inFlight = new Map<string, Promise<string[] | null>>();

export type ProjectMemberViewer = { userId?: string | null; teamId?: string | null };

const cacheKey = (projectId: number, viewer: ProjectMemberViewer) =>
    `${viewer.teamId ?? ""}|${viewer.userId ?? ""}|${projectId}`;

const fetchOnce = (key: string, projectId: number, accessToken: string | null) => {
    const running = inFlight.get(key);
    if (running) return running;
    const started = loadProjectMemberIds(projectId, accessToken)
        .then((ids) => {
            if (ids) lastKnown.set(key, ids);
            return ids;
        })
        .finally(() => inFlight.delete(key));
    inFlight.set(key, started);
    return started;
};

/** Test hook: forget what earlier tests learned. */
export const resetProjectMemberIdsCache = () => {
    lastKnown.clear();
    inFlight.clear();
};

export type ProjectMemberIds = {
    /** Who is on the project, or `null` while that is not known (not asked
     *  yet, in flight with nothing remembered, or the request failed). */
    ids: string[] | null;
    /** True while a request is out and there is nothing to show yet. */
    loading: boolean;
    /** Ask (again). Idempotent while a request for the project is running. */
    refresh: () => void;
};

/**
 * Who is on `projectId`, as `viewer` (the signed-in user and team) may see it.
 * Does NOT fetch by itself: the caller says when (`refresh`), so a task that is
 * only being read costs no request.
 */
export const useProjectMemberIds = (
    projectId: number | null | undefined,
    accessToken: string | null,
    viewer: ProjectMemberViewer
): ProjectMemberIds => {
    // No project or no token: no viewer, so no key and nothing to show.
    const key = projectId == null || !accessToken ? null : cacheKey(projectId, viewer);
    // What this hook last heard for `forKey` (a project AND a viewer). Read
    // through `forKey` so an answer for a project the form has since left, or
    // for a viewer who has since signed out, is never shown.
    const [heard, setHeard] = useState<{ forKey: string | null; ids: string[] | null }>({
        forKey: null,
        ids: null,
    });
    const [loadingFor, setLoadingFor] = useState<string | null>(null);
    const keyRef = useRef(key);
    keyRef.current = key;

    const refresh = useCallback(() => {
        if (projectId == null || key === null) return;
        setLoadingFor(key);
        void fetchOnce(key, projectId, accessToken).then((ids) => {
            setLoadingFor((current) => (current === key ? null : current));
            if (keyRef.current !== key) return;
            // A failed refresh keeps what was heard before.
            if (ids) setHeard({ forKey: key, ids });
        });
    }, [projectId, accessToken, key]);

    const ids =
        key === null ? null : heard.forKey === key ? heard.ids : (lastKnown.get(key) ?? null);

    return { ids, loading: key !== null && loadingFor === key && ids === null, refresh };
};
