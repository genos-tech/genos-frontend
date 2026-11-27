import { getMessages } from "../../i18n";
import { listSchedules, type RunOutcome } from "../../services/schedules";

export const FOLLOW_EVERY_MS = 5000;
/** The server stops a run after 15 minutes; a little more, then stop asking. */
export const FOLLOW_FOR_MS = 16 * 60 * 1000;

const following = new Map<string, number>();

export type FollowOptions = {
    accessToken: string | null;
    teamId: string;
    id: string;
    /** The `startedAt` the run was answered with: its row's `lastRun` once it is recorded. */
    startedAt: string | undefined;
    onEnd: (outcome: RunOutcome) => void;
};

/**
 * Waits for a run the server took into the background (MIP-2457) and says how it went, once.
 *
 * At APP level, like the rest of "Run now": it goes on when the member closes Settings or leaves
 * the page. It reads the member's schedules every few seconds while the tab is visible until no
 * run holds this one. A run that stopped without recording a result is reported as such. A
 * schedule that was deleted, or a run longer than the server allows, ends it quietly.
 */
export const followRun = ({ accessToken, teamId, id, startedAt, onEnd }: FollowOptions) => {
    stopFollowing(id);
    const until = Date.now() + FOLLOW_FOR_MS;
    const next = () => {
        const timer = window.setTimeout(() => void look(timer), FOLLOW_EVERY_MS);
        following.set(id, timer);
    };
    const look = async (timer: number) => {
        if (Date.now() > until) {
            following.delete(id);
            return;
        }
        const list = document.hidden ? null : await listSchedules(accessToken, teamId);
        // A newer press took over while this one was reading.
        if (following.get(id) !== timer) return;
        const row = list?.schedules.find((s) => s.id === id);
        if (list && !row) {
            following.delete(id);
            return;
        }
        if (!row || row.running) {
            next();
            return;
        }
        following.delete(id);
        const recorded = !!startedAt && row.lastRun === startedAt;
        onEnd(
            recorded
                ? {
                      status: row.lastStatus === "ok" ? "ok" : "failed",
                      error: row.lastError ?? "",
                      title: row.lastResult?.title ?? "",
                      items: row.lastResult?.items ?? 0,
                  }
                : {
                      status: "failed",
                      error: getMessages().settings.schedules.runStopped,
                      title: "",
                      items: 0,
                  }
        );
    };
    next();
};

export const stopFollowing = (id: string) => {
    window.clearTimeout(following.get(id));
    following.delete(id);
};
