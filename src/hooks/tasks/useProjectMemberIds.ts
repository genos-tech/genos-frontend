import { useCallback, useRef, useState } from "react";

import { loadProjectMemberIds } from "../../features/tasks/services/loadProjectMemberIds";

// Last answer per project, so the second time a picker opens it can show the
// people at once and refresh behind them. It is never trusted as current: a
// member added since is only listed once the refresh lands, and the picker is
// re-read on every open for that reason.
const lastKnown = new Map<number, string[]>();
const inFlight = new Map<number, Promise<string[] | null>>();

const fetchOnce = (projectId: number, accessToken: string | null) => {
    const running = inFlight.get(projectId);
    if (running) return running;
    const started = loadProjectMemberIds(projectId, accessToken)
        .then((ids) => {
            if (ids) lastKnown.set(projectId, ids);
            return ids;
        })
        .finally(() => inFlight.delete(projectId));
    inFlight.set(projectId, started);
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
 * Who is on `projectId`. Does NOT fetch by itself: the caller says when
 * (`refresh`), so a task that is only being read costs no request.
 */
export const useProjectMemberIds = (
    projectId: number | null | undefined,
    accessToken: string | null
): ProjectMemberIds => {
    // What this hook last heard for `forProject`. Read through `forProject`
    // so an answer for a project the form has since left is never shown.
    const [heard, setHeard] = useState<{ forProject: number | null; ids: string[] | null }>({
        forProject: null,
        ids: null,
    });
    const [loadingFor, setLoadingFor] = useState<number | null>(null);
    const projectRef = useRef(projectId);
    projectRef.current = projectId;

    const refresh = useCallback(() => {
        if (projectId == null) return;
        setLoadingFor(projectId);
        void fetchOnce(projectId, accessToken).then((ids) => {
            setLoadingFor((current) => (current === projectId ? null : current));
            if (projectRef.current !== projectId) return;
            // A failed refresh keeps what was heard before.
            if (ids) setHeard({ forProject: projectId, ids });
        });
    }, [projectId, accessToken]);

    const ids =
        projectId == null
            ? null
            : heard.forProject === projectId
              ? heard.ids
              : (lastKnown.get(projectId) ?? null);

    return { ids, loading: loadingFor === projectId && ids === null, refresh };
};
