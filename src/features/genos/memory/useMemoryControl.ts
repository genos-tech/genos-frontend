import { useCallback, useEffect, useRef, useState } from "react";

import {
    fetchOverview,
    fetchTop,
    forget,
    writeMark,
    writeTuning,
    type Failure,
    type ForgetWhat,
    type Forgotten,
    type LevelKey,
    type MarkKey,
    type Overview,
    type SignalKey,
    type TopItem,
    type TopView,
} from "./memoryApi";

/** What a mark needs to know about its task. */
export type Markable = Pick<TopItem, "taskId" | "displayId" | "title">;

export type LoadStatus = "loading" | "ready" | "error";
export type TopState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; view: TopView };

export interface UseMemoryControlArgs {
    accessToken: string | null;
    teamId: string;
    // Bumped by the page when something it can't see changes what is stored (the recording
    // switch, which deletes everything when it goes off).
    refreshKey: number;
}

/**
 * State of "what Genos has stored / noticed / how it weighs things / delete".
 *
 * Request budget: ONE request when the section mounts (the overview carries the switch, the
 * counts, the tuning and the marks). The ranked list is a second request made only when the
 * member opens it (`loadTop`), and never again on its own: a mark or a tuning change marks it
 * `stale` and the member refreshes it. A mark, a level or a delete is one request each and
 * answers with what the page needs, so nothing is refetched afterwards.
 *
 * All state is local to the section: nothing at the app root.
 */
export const useMemoryControl = ({ accessToken, teamId, refreshKey }: UseMemoryControlArgs) => {
    const [status, setStatus] = useState<LoadStatus>("loading");
    const [overview, setOverview] = useState<Overview | null>(null);
    const [top, setTop] = useState<TopState>({ status: "idle" });
    // The list on screen no longer matches the member's marks or levels.
    const [stale, setStale] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    // An overview response that has been replaced by a newer request is dropped.
    const generation = useRef(0);
    // The team the answers on screen belong to, so a write or a ranking that finishes after a team
    // switch is dropped instead of merged into the other team's page.
    const teamRef = useRef(teamId);
    teamRef.current = teamId;
    // The team the overview on screen was read for: a re-read for the SAME team (the recording
    // switch moved) updates in place, so an open dialog or an expanded list is not unmounted.
    const loadedTeam = useRef<string | null>(null);
    // Counts the changes that make a ranking out of date, so a ranking that was already on its way
    // when the member changed something does not clear the "out of date" note.
    const changes = useRef(0);
    const markStale = useCallback(() => {
        changes.current += 1;
        setStale(true);
    }, []);

    useEffect(() => {
        if (!accessToken || !teamId) {
            loadedTeam.current = null;
            setOverview(null);
            setStatus("error");
            return;
        }
        const mine = ++generation.current;
        const sameTeam = loadedTeam.current === teamId;
        if (sameTeam) {
            // What the ranking showed may have been purged (the switch deletes): say it is old.
            markStale();
        } else {
            setStatus("loading");
            setOverview(null);
            setTop({ status: "idle" });
            setStale(false);
        }
        void fetchOverview(accessToken, teamId).then((res) => {
            if (generation.current !== mine) return;
            if (!res.ok) {
                loadedTeam.current = null;
                setOverview(null);
                setStatus("error");
                return;
            }
            loadedTeam.current = teamId;
            setOverview(res.data);
            setStatus("ready");
        });
        return () => {
            generation.current += 1;
        };
    }, [accessToken, teamId, refreshKey, reloadKey, markStale]);

    const reload = useCallback(() => setReloadKey((k) => k + 1), []);

    const loadTop = useCallback(async () => {
        if (!accessToken || !teamId) return;
        const startedAt = changes.current;
        setTop({ status: "loading" });
        const res = await fetchTop(accessToken, teamId);
        if (teamRef.current !== teamId) return;
        if (!res.ok) {
            // A refusal for "recording is off" is a state, not an outage.
            if (res.reason === "recording_off") {
                setTop({ status: "ready", view: { enabled: false } });
                setOverview((o) => (o ? { ...o, recording: false } : o));
            } else setTop({ status: "error" });
            return;
        }
        setTop({ status: "ready", view: res.data });
        // Something changed while this was on its way: it is already out of date.
        setStale(changes.current !== startedAt);
    }, [accessToken, teamId]);

    // Recording turned out to be off (another tab flipped the switch): say so, once.
    const noteRecordingOff = useCallback((res: Failure) => {
        if (res.reason === "recording_off")
            setOverview((o) => (o ? { ...o, recording: false } : o));
    }, []);

    /** Mark a task (or clear its mark with `null`). Resolves to the failure, or null when saved. */
    const mark = useCallback(
        async (item: Markable, next: MarkKey | null): Promise<Failure | null> => {
            const res = await writeMark(accessToken, teamId, item.taskId, next);
            if (teamRef.current !== teamId) return null;
            if (!res.ok) {
                noteRecordingOff(res);
                return res;
            }
            setOverview((o) => {
                if (!o) return o;
                const others = o.marks.filter((m) => m.taskId !== item.taskId);
                const marks =
                    next === null
                        ? others
                        : [
                              ...others,
                              {
                                  taskId: item.taskId,
                                  displayId: item.displayId,
                                  title: item.title,
                                  mark: next,
                              },
                          ];
                return {
                    ...o,
                    marks,
                    // Marks are counted account-wide on the server; the page's own count moves
                    // by the one this team just gained or lost.
                    stored: {
                        ...o.stored,
                        importance: {
                            ...o.stored.importance,
                            marks: Math.max(
                                0,
                                o.stored.importance.marks + marks.length - o.marks.length
                            ),
                        },
                    },
                };
            });
            return null;
        },
        [accessToken, teamId, noteRecordingOff]
    );

    /** Clear a mark from the marked list (not from the ranked list). */
    const clearMark = useCallback(
        async (item: Markable): Promise<Failure | null> => {
            const res = await mark(item, null);
            if (res === null) markStale();
            return res;
        },
        [mark, markStale]
    );

    const setLevel = useCallback(
        async (signal: SignalKey, level: LevelKey): Promise<Failure | null> => {
            const res = await writeTuning(accessToken, teamId, { signal, level });
            if (teamRef.current !== teamId) return null;
            if (!res.ok) {
                noteRecordingOff(res);
                return res;
            }
            setOverview((o) => (o ? withTuning(o, res.data) : o));
            markStale();
            return null;
        },
        [accessToken, teamId, noteRecordingOff, markStale]
    );

    const resetTuning = useCallback(async (): Promise<Failure | null> => {
        const res = await writeTuning(accessToken, teamId, null);
        if (teamRef.current !== teamId) return null;
        if (!res.ok) {
            noteRecordingOff(res);
            return res;
        }
        setOverview((o) => (o ? withTuning(o, res.data) : o));
        markStale();
        return null;
    }, [accessToken, teamId, noteRecordingOff, markStale]);

    const remove = useCallback(
        async (what: ForgetWhat): Promise<Forgotten | Failure> => {
            const res = await forget(accessToken, what);
            if (!res.ok) return res;
            // A delete is account-wide: it happened whichever team is on screen, but only this
            // team's page may be updated from it.
            if (teamRef.current !== teamId) return res.data;
            const { stored } = res.data;
            setOverview((o) => {
                if (!o) return o;
                const clearsImportance = what === "importance" || what === "everything";
                return {
                    ...o,
                    stored,
                    // Marks and levels are deleted in every team, this one included.
                    marks: clearsImportance ? [] : o.marks,
                    tuning: clearsImportance
                        ? o.tuning.map((row) => ({ ...row, level: "normal" }))
                        : o.tuning,
                };
            });
            markStale();
            return res.data;
        },
        [accessToken, teamId, markStale]
    );

    return {
        status,
        overview,
        top,
        stale,
        reload,
        loadTop,
        mark,
        clearMark,
        setLevel,
        resetTuning,
        remove,
    };
};

const withTuning = (o: Overview, tuning: Overview["tuning"]): Overview => {
    const tuned = tuning.filter((row) => row.level !== "normal").length;
    return {
        ...o,
        tuning,
        stored: {
            ...o.stored,
            // The page counts what is stored in every team; this team's own change moves it by
            // the difference it made.
            importance: {
                ...o.stored.importance,
                tunedSignals: Math.max(
                    0,
                    o.stored.importance.tunedSignals +
                        tuned -
                        o.tuning.filter((row) => row.level !== "normal").length
                ),
            },
        },
    };
};
