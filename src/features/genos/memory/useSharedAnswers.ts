import { useCallback, useEffect, useState } from "react";

import {
    fetchSharedAnswers,
    withdrawSharedAnswer,
    type SharedAnswer,
} from "../../../services/agentApi";

export interface UseSharedAnswersArgs {
    accessToken: string | null;
    teamId: string;
    // Bumped by the page when something it can't see changes the list (a
    // deleted conversation takes its answer with it).
    refreshKey: number;
}

export type SharedAnswersStatus = "loading" | "ready" | "error";

/**
 * The answers the person currently has shared with this team.
 *
 * `status` is three-valued on purpose: "error" must not render as an empty
 * list. "None of your answers are shared" is the claim this whole page
 * exists to make trustworthy, and an outage that said it would be a lie.
 */
export const useSharedAnswers = ({ accessToken, teamId, refreshKey }: UseSharedAnswersArgs) => {
    const [status, setStatus] = useState<SharedAnswersStatus>("loading");
    const [answers, setAnswers] = useState<SharedAnswer[]>([]);
    const [hasMore, setHasMore] = useState(false);
    // The account-wide sharing preference as the list endpoint last saw it.
    // `null` until a fetch lands. The page prefers the preference endpoint's
    // answer and falls back to this, so one of the two requests failing
    // doesn't leave the switch dead.
    const [sharePref, setSharePref] = useState<boolean | null>(null);
    // Bumped by `reload` to refetch without the page's key changing.
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!accessToken || !teamId) {
            setAnswers([]);
            setHasMore(false);
            setStatus("ready");
            return;
        }
        let cancelled = false;
        setStatus("loading");
        void fetchSharedAnswers({ accessToken, teamId }).then((res) => {
            if (cancelled) return;
            if (!res) {
                setStatus("error");
                return;
            }
            setAnswers(res.answers);
            setHasMore(res.has_more);
            setSharePref(res.share_answers_with_team);
            setStatus("ready");
        });
        return () => {
            cancelled = true;
        };
    }, [accessToken, teamId, refreshKey, reloadKey]);

    const reload = useCallback(() => setReloadKey((k) => k + 1), []);

    // After the sharing switch goes OFF the server holds none of them; drop
    // them now rather than leave rows up that the next fetch would remove.
    const clear = useCallback(() => {
        setAnswers([]);
        setHasMore(false);
    }, []);

    // Resolves to whether the answer is no longer shared. A 404 counts: the
    // answer was already gone, which is the outcome asked for.
    const stopSharing = useCallback(
        async (runId: string): Promise<boolean> => {
            if (!accessToken) return false;
            const result = await withdrawSharedAnswer({ accessToken, runId });
            if (result.kind === "error") return false;
            setAnswers((prev) => prev.filter((a) => a.run_id !== runId));
            return true;
        },
        [accessToken]
    );

    return { status, answers, hasMore, sharePref, reload, clear, stopSharing };
};
